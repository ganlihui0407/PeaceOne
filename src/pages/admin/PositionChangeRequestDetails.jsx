import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import {
  REVIEW_NOTE_MAX,
  approvePositionChangeRequest,
  fetchAdminPositionChangeRequest,
  formatPositionChangeStatus,
  formatRequestDate,
  isAbortError,
  isPositionChangeRequestId,
  positionChangeRequestsPath,
  positionChangeStatusTone,
  rejectPositionChangeRequest,
  userFacingPositionChangeError,
} from '../../api/positionChangeRequests.js'

function BackToRequests() {
  return (
    <Button variant="secondary" to={positionChangeRequestsPath()}>
      Back to requests
    </Button>
  )
}

function PositionChangeRequestDetails() {
  const { requestId } = useParams()
  return <PositionChangeRequestDetailsView key={requestId} requestId={requestId} />
}

function PositionChangeRequestDetailsView({ requestId }) {
  const validId = isPositionChangeRequestId(requestId)
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(validId)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [toast, setToast] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    if (!validId) {
      return undefined
    }

    const controller = new AbortController()
    setLoading(true)
    setError('')
    setNotFound(false)

    fetchAdminPositionChangeRequest(requestId, { signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) {
          return
        }
        setRecord(next)
        setReviewNote(next.reviewNote ?? '')
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setRecord(null)
        if (loadError.status === 404) {
          setNotFound(true)
          setError('')
          return
        }
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
  }, [requestId, retryNonce, validId])

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function review(action) {
    if (!record || record.status !== 'PENDING' || reviewing) {
      return
    }
    setReviewing(true)
    setReviewError('')
    const note = reviewNote.trim()
    try {
      const updated =
        action === 'approve'
          ? await approvePositionChangeRequest(record.id, { reviewNote: note || null })
          : await rejectPositionChangeRequest(record.id, { reviewNote: note || null })
      setRecord(updated)
      setReviewNote(updated.reviewNote ?? '')
      showToast(action === 'approve' ? 'Position change approved.' : 'Position change rejected.')
    } catch (reviewErr) {
      setReviewError(userFacingPositionChangeError(reviewErr))
    } finally {
      setReviewing(false)
    }
  }

  if (!validId) {
    return (
      <PageContent title="Position Change Request" actions={<BackToRequests />}>
        <QueryStatus empty emptyTitle="Invalid request" emptyDescription="This request id is not valid." />
      </PageContent>
    )
  }

  return (
    <PageContent title="Position Change Request" actions={<BackToRequests />}>
      <QueryStatus
        loading={loading}
        error={error}
        empty={notFound}
        loadingLabel="Loading request…"
        emptyTitle="Position change request not found"
        emptyDescription="This request may have been removed, or the link is incorrect."
        onRetry={() => setRetryNonce((current) => current + 1)}
      >
        {record ? (
          <div className="space-y-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="po-section-title">{record.user?.fullName ?? 'Staff member'}</h2>
                  <p className="po-helper mt-1">{record.user?.email}</p>
                </div>
                <Badge tone={positionChangeStatusTone(record.status)} className="normal-case">
                  {formatPositionChangeStatus(record.status)}
                </Badge>
              </div>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailItem label="Current position" value={record.currentPosition || 'Not set'} />
                <DetailItem label="Requested position" value={record.requestedPosition} />
                <DetailItem label="Submitted" value={formatRequestDate(record.createdAt)} />
                <DetailItem label="Reviewed" value={formatRequestDate(record.reviewedAt)} />
                <DetailItem label="Reviewer" value={record.reviewer?.fullName || '—'} />
                <DetailItem label="Reviewer email" value={record.reviewer?.email || '—'} />
              </dl>
              <div className="mt-5">
                <p className="po-label">Reason</p>
                <p className="po-secondary mt-1 whitespace-pre-wrap">{record.reason}</p>
              </div>
              {record.reviewNote ? (
                <div className="mt-5">
                  <p className="po-label">Review note</p>
                  <p className="po-secondary mt-1 whitespace-pre-wrap">{record.reviewNote}</p>
                </div>
              ) : null}
            </Card>

            {record.status === 'PENDING' ? (
              <Card>
                <h2 className="po-section-title">Review this request</h2>
                <p className="po-secondary mt-2">
                  Approving updates this staff member's stored position to the requested title. Rejecting
                  leaves the current position unchanged.
                </p>
                <div className="mt-5">
                  <TextArea
                    id="review-note"
                    label="Review note"
                    value={reviewNote}
                    maxLength={REVIEW_NOTE_MAX}
                    disabled={reviewing}
                    onChange={(event) => {
                      setReviewNote(event.target.value)
                      if (reviewError) {
                        setReviewError('')
                      }
                    }}
                    helperText="Optional. This note is visible to the staff member."
                  />
                </div>
                {reviewError ? (
                  <p className="po-helper po-helper-error mt-4" role="alert">
                    {reviewError}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button disabled={reviewing} onClick={() => review('approve')}>
                    {reviewing ? 'Saving…' : 'Approve'}
                  </Button>
                  <Button variant="secondary" disabled={reviewing} onClick={() => review('reject')}>
                    Reject
                  </Button>
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </QueryStatus>
      <Toast message={toast} />
    </PageContent>
  )
}

export default PositionChangeRequestDetails
