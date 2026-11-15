import { useCallback, useEffect, useState } from 'react'
import {
  fetchCandidateDashboard,
  userFacingDashboardError,
} from '../api/candidateDashboard.js'
import { isAbortError } from '../api/esco.js'

export function useCandidateDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    fetchCandidateDashboard({ signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) {
          return
        }
        setData(next)
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setData(null)
        setError(userFacingDashboardError(loadError))
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

  return { data, loading, error, retry }
}
