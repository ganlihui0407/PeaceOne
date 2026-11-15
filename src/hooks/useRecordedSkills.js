import { useEffect, useState } from 'react'
import { isAbortError } from '../api/esco.js'
import {
  clearRecordedSkillsCache,
  readRecordedSkillsCache,
  writeRecordedSkillsCache,
} from '../api/recordedSkillsCache.js'
import { fetchSavedSkills, userFacingSkillError } from '../api/userSkills.js'

export function useRecordedSkills({ enabled = true } = {}) {
  const cached = readRecordedSkillsCache()
  const [items, setItems] = useState(cached)
  const [loading, setLoading] = useState(enabled && cached == null)
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    if (!enabled) {
      return undefined
    }
    const existing = readRecordedSkillsCache()
    if (existing) {
      setItems(existing)
      setLoading(false)
      setError('')
      return undefined
    }

    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchSavedSkills({ signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) {
          return
        }
        writeRecordedSkillsCache(next)
        setItems(next)
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setItems(null)
        setError(userFacingSkillError(loadError))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [enabled, retryNonce])

  return {
    items,
    loading,
    error,
    retry() {
      clearRecordedSkillsCache()
      setItems(null)
      setRetryNonce((current) => current + 1)
    },
  }
}
