import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import {
  fetchMeProfile,
  isAbortError,
  updateMeProfile,
  userFacingMeProfileError,
} from '../api/me.js'
import {
  emptyProfileForm,
  profileFormToUpdate,
  profileToFormValues,
  validateProfileForm,
} from '../api/meForm.js'

export function useMeProfileForm() {
  const { applySessionUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(() => emptyProfileForm())
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

    fetchMeProfile({ signal: controller.signal })
      .then((loaded) => {
        if (controller.signal.aborted) {
          return
        }
        setProfile(loaded)
        setForm(profileToFormValues(loaded))
        setFieldErrors({})
        setSaveError('')
      })
      .catch((error) => {
        if (isAbortError(error) || controller.signal.aborted) {
          return
        }
        setProfile(null)
        setLoadError(userFacingMeProfileError(error))
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
    if (!profile) {
      return false
    }

    const errors = validateProfileForm(profile.role, form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setSaveError('Please correct the highlighted fields.')
      return false
    }

    setSaving(true)
    setSaveError('')
    try {
      const updated = await updateMeProfile(profileFormToUpdate(profile.role, form))
      setProfile(updated)
      setForm(profileToFormValues(updated))
      setFieldErrors({})
      applySessionUser?.(updated)
      return true
    } catch (error) {
      if (isAbortError(error)) {
        return false
      }
      setSaveError(userFacingMeProfileError(error))
      return false
    } finally {
      setSaving(false)
    }
  }, [applySessionUser, form, profile])

  return {
    profile,
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
