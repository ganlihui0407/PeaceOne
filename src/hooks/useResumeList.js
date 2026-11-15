import { useCallback, useEffect, useState } from 'react'
import { isAbortError } from '../api/esco.js'
import {
  atResumeLimit,
  createResume,
  deleteResume,
  deleteResumeFile,
  downloadResumeFile,
  fetchResumes,
  saveBlobAsFile,
  setPrimaryResume,
  uploadResumeFile,
  userFacingResumeError,
  userFacingResumeFileError,
} from '../api/resumes.js'

export function useResumeList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    fetchResumes({ signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) {
          return
        }
        setItems(next)
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setItems([])
        setError(userFacingResumeError(loadError))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [retryNonce])

  const retry = useCallback(() => {
    setRetryNonce((current) => current + 1)
  }, [])

  const create = useCallback(async (title) => {
    setBusy(true)
    setActionError('')
    try {
      const created = await createResume({ title })
      setItems((current) => {
        const without = current.filter((item) => item.id !== created.id)
        const summary = {
          id: created.id,
          title: created.title,
          templateKey: created.templateKey,
          isPrimary: created.isPrimary,
          fullName: created.fullName,
          educationCount: created.education.length,
          experienceCount: created.experience.length,
          skillCount: created.skills.length,
          certificationCount: created.certifications.length,
          file: created.file ?? null,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        }
        return created.isPrimary ? [summary, ...without] : [...without, summary]
      })
      return created
    } catch (submitError) {
      setActionError(userFacingResumeError(submitError))
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const setPrimary = useCallback(async (id) => {
    setBusy(true)
    setActionError('')
    try {
      const updated = await setPrimaryResume(id)
      setItems((current) =>
        current
          .map((item) => ({
            ...item,
            isPrimary: item.id === updated.id,
            updatedAt: item.id === updated.id ? updated.updatedAt : item.updatedAt,
          }))
          .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary)),
      )
      return updated
    } catch (primaryError) {
      setActionError(userFacingResumeError(primaryError))
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const remove = useCallback(async (id) => {
    setBusy(true)
    setActionError('')
    try {
      await deleteResume(id)
      setItems((current) => current.filter((item) => item.id !== id))
      return true
    } catch (deleteError) {
      setActionError(userFacingResumeError(deleteError))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const uploadFile = useCallback(async (id, file) => {
    setBusy(true)
    setActionError('')
    try {
      const uploaded = await uploadResumeFile(id, file)
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, file: uploaded.file } : item)),
      )
      return uploaded
    } catch (uploadError) {
      setActionError(userFacingResumeFileError(uploadError, 'upload'))
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const downloadFile = useCallback(async (id) => {
    setBusy(true)
    setActionError('')
    try {
      const downloaded = await downloadResumeFile(id)
      saveBlobAsFile(downloaded.blob, downloaded.filename)
      return downloaded
    } catch (downloadError) {
      setActionError(userFacingResumeFileError(downloadError, 'download'))
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const removeFile = useCallback(async (id) => {
    setBusy(true)
    setActionError('')
    try {
      await deleteResumeFile(id)
      setItems((current) => current.map((item) => (item.id === id ? { ...item, file: null } : item)))
      return true
    } catch (removeError) {
      setActionError(userFacingResumeFileError(removeError, 'remove'))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  return {
    items,
    loading,
    error,
    busy,
    actionError,
    atLimit: atResumeLimit(items),
    retry,
    create,
    setPrimary,
    remove,
    uploadFile,
    downloadFile,
    removeFile,
    setActionError,
  }
}
