import { useCallback, useEffect, useState } from 'react'
import {
  fetchCompanyProfile,
  isAbortError,
  saveCompanyProfile,
  userFacingCompanyError,
} from '../api/company.js'
import {
  companyFormToUpdate,
  companyToFormValues,
  emptyCompanyForm,
  validateCompanyForm,
} from '../api/companyForm.js'

export function useCompanyProfileForm() {
  const [company, setCompany] = useState(null)
  const [form, setForm] = useState(() => emptyCompanyForm())
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')

    fetchCompanyProfile({ signal: controller.signal })
      .then((loaded) => {
        if (controller.signal.aborted) {
          return
        }
        setCompany(loaded)
        setForm(companyToFormValues(loaded))
        setFieldErrors({})
        setSaveError('')
      })
      .catch((error) => {
        if (isAbortError(error) || controller.signal.aborted) {
          return
        }
        setCompany(null)
        setLoadError(userFacingCompanyError(error))
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

  const save = useCallback(async () => {
    const errors = validateCompanyForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setSaveError('Please correct the highlighted fields.')
      return false
    }

    setSaving(true)
    setSaveError('')
    try {
      const updated = await saveCompanyProfile(companyFormToUpdate(form))
      setCompany(updated)
      setForm(companyToFormValues(updated))
      setFieldErrors({})
      return true
    } catch (error) {
      if (isAbortError(error)) {
        return false
      }
      setSaveError(userFacingCompanyError(error))
      return false
    } finally {
      setSaving(false)
    }
  }, [form])

  return {
    company,
    form,
    fieldErrors,
    loading,
    saving,
    loadError,
    saveError,
    retry,
    updateField,
    save,
  }
}
