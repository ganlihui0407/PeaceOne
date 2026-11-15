import { useCallback, useEffect, useMemo, useState } from 'react'
import { isAbortError } from '../api/esco.js'
import {
  EXTRACTION_STAGES,
  confirmResumeSkills,
  extractResumeSkills,
  userFacingExtractionError,
} from '../api/resumeExtraction.js'

export function useResumeExtraction(resumeId, fileSha256) {
  const [stageIndex, setStageIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [extraction, setExtraction] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const reset = useCallback(() => {
    setExtraction(null)
    setSelectedIds(new Set())
    setError('')
    setSuccess('')
    setStageIndex(0)
  }, [])

  useEffect(() => {
    reset()
  }, [resumeId, fileSha256, reset])

  useEffect(() => {
    if (!busy) {
      return undefined
    }
    const timer = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % EXTRACTION_STAGES.length)
    }, 1200)
    return () => window.clearInterval(timer)
  }, [busy])

  const identify = useCallback(async () => {
    if (!resumeId || busy || confirming) {
      return null
    }
    setBusy(true)
    setError('')
    setSuccess('')
    setStageIndex(0)
    try {
      const result = await extractResumeSkills(resumeId)
      setExtraction(result)
      setSelectedIds(new Set(result.suggestions.map((item) => item.skillId)))
      return result
    } catch (identifyError) {
      if (!isAbortError(identifyError)) {
        setExtraction(null)
        setError(userFacingExtractionError(identifyError, 'extract'))
      }
      return null
    } finally {
      setBusy(false)
    }
  }, [resumeId, busy, confirming])

  const toggle = useCallback((skillId) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(skillId)) {
        next.delete(skillId)
      } else {
        next.add(skillId)
      }
      return next
    })
  }, [])

  const cancel = useCallback(() => {
    reset()
  }, [reset])

  const confirm = useCallback(async () => {
    if (!resumeId || !extraction?.reviewToken || confirming || busy) {
      return null
    }
    const skillIds = extraction.suggestions
      .map((item) => item.skillId)
      .filter((skillId) => selectedIds.has(skillId))
    setConfirming(true)
    setError('')
    setSuccess('')
    try {
      const result = await confirmResumeSkills(resumeId, {
        reviewToken: extraction.reviewToken,
        skillIds,
      })
      setSuccess(
        result.saved.length === 0
          ? 'No new skills were added. Existing recorded skills were kept.'
          : `Saved ${result.saved.length} confirmed skill${result.saved.length === 1 ? '' : 's'} to your profile.`,
      )
      setExtraction((current) => {
        if (!current) {
          return current
        }
        const savedIds = new Set(result.saved.map((item) => item.skill.preferredLabel))
        return {
          ...current,
          suggestions: current.suggestions.map((item) => ({
            ...item,
            alreadySaved: item.alreadySaved || savedIds.has(item.preferredLabel) || selectedIds.has(item.skillId),
          })),
        }
      })
      setSelectedIds(new Set())
      return result
    } catch (confirmError) {
      if (!isAbortError(confirmError)) {
        setError(userFacingExtractionError(confirmError, 'confirm'))
      }
      return null
    } finally {
      setConfirming(false)
    }
  }, [resumeId, extraction, selectedIds, confirming, busy])

  const statusLabel = useMemo(() => {
    if (busy) {
      return EXTRACTION_STAGES[stageIndex]
    }
    if (extraction && !extraction.unreadable && extraction.suggestions.length > 0) {
      return 'Review ready'
    }
    return ''
  }, [busy, stageIndex, extraction])

  return {
    busy,
    confirming,
    error,
    success,
    extraction,
    selectedIds,
    statusLabel,
    identify,
    toggle,
    cancel,
    confirm,
    reset,
  }
}
