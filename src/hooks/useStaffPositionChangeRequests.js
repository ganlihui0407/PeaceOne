import { useCallback, useEffect, useState } from 'react'
import { isAbortError } from '../api/esco.js'
import {
  createStaffPositionChangeRequest,
  fetchStaffPositionChangeRequests,
  userFacingPositionChangeError,
} from '../api/positionChangeRequests.js'

export function useStaffPositionChangeRequests() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    fetchStaffPositionChangeRequests({ signal: controller.signal })
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
        setError(userFacingPositionChangeError(loadError))
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

  const submit = useCallback(async ({ requestedPosition, reason }) => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const created = await createStaffPositionChangeRequest({ requestedPosition, reason })
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)])
      return created
    } catch (submitErr) {
      setSubmitError(userFacingPositionChangeError(submitErr))
      return null
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { items, loading, error, submitting, submitError, retry, submit, setSubmitError }
}
