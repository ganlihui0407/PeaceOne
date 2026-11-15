import { useCallback, useEffect, useState } from 'react'
import { isAbortError } from '../api/esco.js'
import {
  fetchAdminDashboard,
  fetchStaffDashboard,
  userFacingDashboardError,
} from '../api/staffAdminDashboard.js'

function useOwnDashboard(loadDashboard) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    loadDashboard({ signal: controller.signal })
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
  }, [loadDashboard, retryNonce])

  const retry = useCallback(() => {
    setRetryNonce((current) => current + 1)
  }, [])

  return { data, loading, error, retry }
}

export function useStaffDashboard() {
  return useOwnDashboard(fetchStaffDashboard)
}

export function useAdminDashboard() {
  return useOwnDashboard(fetchAdminDashboard)
}
