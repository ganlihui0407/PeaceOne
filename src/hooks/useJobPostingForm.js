import { useCallback, useEffect, useState } from 'react'
import { fetchCompanyProfile, isAbortError as isCompanyAbort, userFacingCompanyError } from '../api/company.js'
import {
  createStaffJob,
  fetchStaffJob,
  isAbortError,
  updateStaffJob,
  userFacingJobError,
} from '../api/jobs.js'
import {
  emptyJobForm,
  jobFormToWriteBody,
  jobToFormValues,
  validateJobForm,
} from '../api/jobForm.js'

export function useJobPostingForm(jobId) {
  const isEdit = Boolean(jobId)
  const [company, setCompany] = useState(null)
  const [job, setJob] = useState(null)
  const [form, setForm] = useState(() => emptyJobForm())
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    setNotFound(false)

    const companyRequest = fetchCompanyProfile({ signal: controller.signal })
    const jobRequest = isEdit
      ? fetchStaffJob(jobId, { signal: controller.signal })
      : Promise.resolve(null)

    Promise.all([companyRequest, jobRequest])
      .then(([loadedCompany, loadedJob]) => {
        if (controller.signal.aborted) {
          return
        }
        setCompany(loadedCompany)
        setJob(loadedJob)
        setForm(loadedJob ? jobToFormValues(loadedJob) : emptyJobForm())
        setFieldErrors({})
        setSaveError('')
      })
      .catch((error) => {
        if (isAbortError(error) || isCompanyAbort(error) || controller.signal.aborted) {
          return
        }
        setCompany(null)
        setJob(null)
        if (error.status === 404) {
          setNotFound(true)
          setLoadError('')
          return
        }
        setLoadError(userFacingJobError(error) || userFacingCompanyError(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [isEdit, jobId, retryNonce])

  const retry = useCallback(() => {
    setRetryNonce((current) => current + 1)
  }, [])

  const updateField = useCallback((name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => {
      if (!current[name]) {
        return current
      }
      const next = { ...current }
      delete next[name]
      return next
    })
    setSaveError('')
  }, [])

  const setRequiredSkills = useCallback((nextSkills) => {
    setForm((current) => ({ ...current, requiredSkills: nextSkills }))
    setFieldErrors((current) => {
      if (!current.requiredSkills) {
        return current
      }
      const next = { ...current }
      delete next.requiredSkills
      return next
    })
    setSaveError('')
  }, [])

  const save = useCallback(async () => {
    const errors = validateJobForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setSaveError('Please correct the highlighted fields.')
      return null
    }
    if (!company) {
      setSaveError('Save a company profile before creating or managing job postings.')
      return null
    }
    setSaving(true)
    setSaveError('')
    try {
      const body = jobFormToWriteBody(form)
      const saved = isEdit
        ? await updateStaffJob(jobId, body)
        : await createStaffJob(body)
      setJob(saved)
      setForm(jobToFormValues(saved))
      return saved
    } catch (error) {
      setSaveError(userFacingJobError(error))
      return null
    } finally {
      setSaving(false)
    }
  }, [company, form, isEdit, jobId])

  return {
    isEdit,
    company,
    job,
    form,
    fieldErrors,
    loading,
    saving,
    loadError,
    saveError,
    notFound,
    retry,
    updateField,
    setRequiredSkills,
    save,
  }
}
