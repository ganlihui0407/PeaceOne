import { useCallback, useEffect, useMemo, useState } from 'react'
import { isAbortError } from '../api/esco.js'
import {
  canAddSection,
  customSkillItem,
  emptyCertificationItem,
  emptyEducationItem,
  emptyExperienceItem,
  emptyResumeFormErrors,
  formToUpdate,
  hasEscoSkill,
  hasResumeFormErrors,
  moveItemByKey,
  resumeFormSnapshot,
  resumeToForm,
  skillFromCatalogue,
  skillFromSavedRecord,
  validateResumeForm,
} from '../api/resumeForm.js'
import { isResumeTemplateKey } from '../api/resumeTemplates.js'
import {
  RESUME_PDF_UNSAVED_COPY,
  RESUME_SECTION_LIMITS,
  RESUME_UNSAVED_COPY,
  deleteResumeFile,
  downloadResumeFile,
  downloadResumePdf,
  fetchResume,
  isResumeId,
  saveBlobAsFile,
  updateResume,
  uploadResumeFile,
  userFacingResumeEditorError,
  userFacingResumeFileError,
  userFacingResumePdfError,
} from '../api/resumes.js'
import { fetchSavedSkills, userFacingSkillError } from '../api/userSkills.js'

const EMPTY_ITEMS = {
  education: emptyEducationItem,
  experience: emptyExperienceItem,
  certifications: emptyCertificationItem,
}

export function useResumeEditor(resumeId) {
  const [resume, setResume] = useState(null)
  const [form, setForm] = useState(null)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState(emptyResumeFormErrors())
  const [skillNotice, setSkillNotice] = useState('')
  const [savedSkills, setSavedSkills] = useState([])
  const [savedSkillsLoading, setSavedSkillsLoading] = useState(false)
  const [savedSkillsError, setSavedSkillsError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)
  const [savedSkillsNonce, setSavedSkillsNonce] = useState(0)
  const [fileBusy, setFileBusy] = useState(false)
  const [fileError, setFileError] = useState('')
  const [fileSuccess, setFileSuccess] = useState('')
  const [uploadProgress, setUploadProgress] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [pdfSuccess, setPdfSuccess] = useState('')

  const dirty = Boolean(form) && resumeFormSnapshot(form) !== savedSnapshot

  useEffect(() => {
    if (!isResumeId(resumeId)) {
      setResume(null)
      setForm(null)
      setSavedSnapshot('')
      setLoading(false)
      setLoadError('This resume is not available.')
      return undefined
    }

    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    setSaveError('')
    setSaveSuccess('')
    setSkillNotice('')
    setFileError('')
    setFileSuccess('')
    setUploadProgress(null)
    setPdfError('')
    setPdfSuccess('')
    setFieldErrors(emptyResumeFormErrors())

    fetchResume(resumeId, { signal: controller.signal })
      .then((record) => {
        if (controller.signal.aborted) {
          return
        }
        const nextForm = resumeToForm(record)
        setResume(record)
        setForm(nextForm)
        setSavedSnapshot(resumeFormSnapshot(nextForm))
      })
      .catch((error) => {
        if (isAbortError(error) || controller.signal.aborted) {
          return
        }
        setResume(null)
        setForm(null)
        setSavedSnapshot('')
        setLoadError(userFacingResumeEditorError(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [resumeId, retryNonce])

  useEffect(() => {
    const controller = new AbortController()
    setSavedSkillsLoading(true)
    setSavedSkillsError('')
    fetchSavedSkills({ signal: controller.signal })
      .then((items) => {
        if (controller.signal.aborted) {
          return
        }
        setSavedSkills(items)
      })
      .catch((error) => {
        if (isAbortError(error) || controller.signal.aborted) {
          return
        }
        setSavedSkills([])
        setSavedSkillsError(userFacingSkillError(error) || 'Saved skills are unavailable right now.')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSavedSkillsLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [retryNonce, savedSkillsNonce])

  useEffect(() => {
    function onBeforeUnload(event) {
      if (!dirty) {
        return
      }
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [dirty])

  const retry = useCallback(() => {
    setRetryNonce((current) => current + 1)
  }, [])

  const setField = useCallback((name, value) => {
    setSaveSuccess('')
    setSaveError('')
    setForm((current) => (current ? { ...current, [name]: value } : current))
  }, [])

  const updateItem = useCallback((section, key, patch) => {
    setSaveSuccess('')
    setSaveError('')
    setForm((current) => {
      if (!current) {
        return current
      }
      return {
        ...current,
        [section]: current[section].map((item) => (item.key === key ? { ...item, ...patch } : item)),
      }
    })
  }, [])

  const addItem = useCallback((section) => {
    const factory = EMPTY_ITEMS[section]
    if (!factory) {
      return false
    }
    const item = factory()
    setSaveSuccess('')
    setSaveError('')
    setForm((current) => {
      if (!current || !canAddSection(current, section)) {
        return current
      }
      return { ...current, [section]: [...current[section], item] }
    })
    return true
  }, [])

  const removeItem = useCallback((section, key) => {
    setSaveSuccess('')
    setSaveError('')
    setForm((current) => {
      if (!current) {
        return current
      }
      return {
        ...current,
        [section]: current[section].filter((item) => item.key !== key),
      }
    })
  }, [])

  const moveItem = useCallback((section, key, offset) => {
    setSaveSuccess('')
    setSaveError('')
    setForm((current) => {
      if (!current) {
        return current
      }
      return {
        ...current,
        [section]: moveItemByKey(current[section], key, offset),
      }
    })
  }, [])

  const addSkillItem = useCallback(
    (item, duplicateMessage) => {
      setSaveSuccess('')
      setSaveError('')
      if (!form) {
        return false
      }
      if (item.skillId && hasEscoSkill(form, item.skillId)) {
        setSkillNotice(duplicateMessage || 'This ESCO skill is already on the resume.')
        return false
      }
      if (!canAddSection(form, 'skills')) {
        setSkillNotice(`You can save up to ${RESUME_SECTION_LIMITS.skills} skills.`)
        return false
      }
      setForm((current) => {
        if (!current) {
          return current
        }
        if (item.skillId && hasEscoSkill(current, item.skillId)) {
          return current
        }
        if (!canAddSection(current, 'skills')) {
          return current
        }
        return { ...current, skills: [...current.skills, item] }
      })
      setSkillNotice('')
      return true
    },
    [form],
  )

  const addCustomSkill = useCallback(
    (label, proficiencyLevel = '') => {
      const trimmed = typeof label === 'string' ? label.trim() : ''
      if (!trimmed) {
        setSkillNotice('Enter a skill name.')
        return false
      }
      return addSkillItem(customSkillItem(trimmed, proficiencyLevel))
    },
    [addSkillItem],
  )

  const addCatalogueSkill = useCallback(
    (skill, proficiencyLevel = '') => {
      if (!skill?.id) {
        setSkillNotice('Select an official ESCO skill.')
        return false
      }
      return addSkillItem(skillFromCatalogue(skill, proficiencyLevel), 'This ESCO skill is already on the resume.')
    },
    [addSkillItem],
  )

  const importSavedSkills = useCallback(() => {
    setSaveSuccess('')
    setSaveError('')
    if (!form) {
      return 0
    }
    const existingIds = new Set(form.skills.map((item) => item.skillId).filter(Boolean))
    const additions = []
    let skipped = 0
    for (const record of savedSkills) {
      const item = skillFromSavedRecord(record)
      if (!item.skillId) {
        continue
      }
      if (existingIds.has(item.skillId)) {
        skipped += 1
        continue
      }
      if (form.skills.length + additions.length >= RESUME_SECTION_LIMITS.skills) {
        break
      }
      existingIds.add(item.skillId)
      additions.push(item)
    }
    if (additions.length > 0) {
      setForm((current) => (current ? { ...current, skills: [...current.skills, ...additions] } : current))
      setSkillNotice(`Copied ${additions.length} recorded skill${additions.length === 1 ? '' : 's'} onto this resume.`)
    } else if (skipped > 0) {
      setSkillNotice('All recorded skills are already on this resume.')
    } else {
      setSkillNotice('No recorded skills are available to import.')
    }
    return additions.length
  }, [form, savedSkills])

  const persistTemplate = useCallback(
    async (templateKey) => {
      if (!form || !resume || saving || pdfBusy) {
        return false
      }
      if (!isResumeTemplateKey(templateKey)) {
        return false
      }
      if (form.templateKey === templateKey && resume.templateKey === templateKey) {
        return true
      }
      const previousKey = form.templateKey
      setForm((current) => (current ? { ...current, templateKey } : current))
      setSaving(true)
      setSaveError('')
      setSaveSuccess('')
      try {
        const updated = await updateResume(resume.id, { templateKey })
        setResume((current) =>
          current
            ? { ...current, templateKey: updated.templateKey, updatedAt: updated.updatedAt }
            : current,
        )
        setSavedSnapshot((current) => {
          if (!current) {
            return current
          }
          const parsed = JSON.parse(current)
          parsed.templateKey = updated.templateKey
          return JSON.stringify(parsed)
        })
        setSaveSuccess('Template saved.')
        return true
      } catch (error) {
        setForm((current) => (current ? { ...current, templateKey: previousKey } : current))
        setSaveError(userFacingResumeEditorError(error))
        return false
      } finally {
        setSaving(false)
      }
    },
    [form, pdfBusy, resume, saving],
  )

  const downloadPdf = useCallback(async () => {
    if (!resume || pdfBusy || fileBusy) {
      return null
    }
    if (dirty) {
      setPdfError(RESUME_PDF_UNSAVED_COPY)
      setPdfSuccess('')
      return null
    }
    setPdfBusy(true)
    setPdfError('')
    setPdfSuccess('')
    try {
      const downloaded = await downloadResumePdf(resume.id)
      saveBlobAsFile(downloaded.blob, downloaded.filename)
      setPdfSuccess('Resume PDF downloaded.')
      return downloaded
    } catch (error) {
      setPdfError(userFacingResumePdfError(error))
      return null
    } finally {
      setPdfBusy(false)
    }
  }, [dirty, fileBusy, pdfBusy, resume])

  const save = useCallback(async () => {
    if (!form || !resume || saving) {
      return false
    }
    const errors = validateResumeForm(form)
    setFieldErrors(errors)
    if (hasResumeFormErrors(errors)) {
      setSaveError('Fix the highlighted fields before saving.')
      setSaveSuccess('')
      return false
    }

    const previousForm = form
    setSaving(true)
    setSaveError('')
    setSaveSuccess('')
    try {
      const updated = await updateResume(resume.id, formToUpdate(form))
      const nextForm = resumeToForm(updated)
      setResume(updated)
      setForm(nextForm)
      setSavedSnapshot(resumeFormSnapshot(nextForm))
      setFieldErrors(emptyResumeFormErrors())
      setPdfError('')
      setSaveSuccess('Resume saved.')
      return true
    } catch (error) {
      setForm(previousForm)
      setSaveError(userFacingResumeEditorError(error))
      return false
    } finally {
      setSaving(false)
    }
  }, [form, resume, saving])

  const uploadDocument = useCallback(
    async (file) => {
      if (!resume || fileBusy) {
        return null
      }
      const replacing = Boolean(resume.file)
      setFileBusy(true)
      setFileError('')
      setFileSuccess('')
      setUploadProgress(0)
      try {
        const uploaded = await uploadResumeFile(resume.id, file)
        setUploadProgress(100)
        setResume((current) => (current ? { ...current, file: uploaded.file } : current))
        if (uploaded.unchanged) {
          setFileSuccess('This file is already uploaded.')
        } else {
          setFileSuccess(replacing ? 'Resume file replaced.' : 'Resume file uploaded.')
        }
        return uploaded
      } catch (error) {
        setFileError(userFacingResumeFileError(error, 'upload'))
        return null
      } finally {
        setFileBusy(false)
        setUploadProgress(null)
      }
    },
    [resume, fileBusy],
  )

  const downloadDocument = useCallback(async () => {
    if (!resume || fileBusy) {
      return null
    }
    setFileBusy(true)
    setFileError('')
    setFileSuccess('')
    try {
      const downloaded = await downloadResumeFile(resume.id)
      saveBlobAsFile(downloaded.blob, downloaded.filename)
      setFileSuccess('Uploaded file downloaded.')
      return downloaded
    } catch (error) {
      setFileError(userFacingResumeFileError(error, 'download'))
      return null
    } finally {
      setFileBusy(false)
    }
  }, [resume, fileBusy])

  const removeDocument = useCallback(async () => {
    if (!resume || fileBusy) {
      return false
    }
    setFileBusy(true)
    setFileError('')
    setFileSuccess('')
    try {
      await deleteResumeFile(resume.id)
      setResume((current) => (current ? { ...current, file: null } : current))
      setFileSuccess('Uploaded file removed.')
      return true
    } catch (error) {
      setFileError(userFacingResumeFileError(error, 'remove'))
      return false
    } finally {
      setFileBusy(false)
    }
  }, [resume, fileBusy])

  const confirmLeave = useCallback(() => {
    if (!dirty) {
      return true
    }
    return window.confirm(RESUME_UNSAVED_COPY)
  }, [dirty])

  const availableSavedSkills = useMemo(() => {
    if (!form) {
      return savedSkills
    }
    return savedSkills.filter((record) => !hasEscoSkill(form, record.skill?.id))
  }, [form, savedSkills])

  return {
    resume,
    form,
    loading,
    loadError,
    saving,
    saveError,
    saveSuccess,
    fieldErrors,
    skillNotice,
    savedSkills,
    savedSkillsLoading,
    savedSkillsError,
    availableSavedSkills,
    dirty,
    retry,
    setField,
    updateItem,
    addItem,
    removeItem,
    moveItem,
    addCustomSkill,
    addCatalogueSkill,
    importSavedSkills,
    save,
    confirmLeave,
    setSkillNotice,
    fileBusy,
    fileError,
    fileSuccess,
    uploadProgress,
    uploadDocument,
    downloadDocument,
    removeDocument,
    setFileError,
    persistTemplate,
    downloadPdf,
    pdfBusy,
    pdfError,
    pdfSuccess,
    setPdfError,
    reloadSavedSkills: () => setSavedSkillsNonce((current) => current + 1),
  }
}
