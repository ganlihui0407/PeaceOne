import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import {
  EMPLOYER_SNAPSHOT_COPY,
  REVIEW_NOTE_MAX,
  applicationStatusTone,
  canRejectEmployerApplication,
  canReviewEmployerApplication,
  canShortlistEmployerApplication,
  downloadEmployerApplicationOriginal,
  downloadEmployerApplicationPdf,
  employerApplicantsPath,
  fetchEmployerApplication,
  formatApplicationStatus,
  formatEmploymentType,
  formatJobDateTime,
  isAbortError,
  isApplicationId,
  loadEmployerApplicationPdfBlob,
  rejectEmployerApplication,
  reviewEmployerApplication,
  shortlistEmployerApplication,
  userFacingApplicationError,
} from '../../api/applications.js'
import {
  canScheduleInterviewForApplication,
  employerInterviewCreatePath,
  employerInterviewPath,
  fetchEmployerInterviews,
} from '../../api/interviews.js'
import { staffJobPath } from '../../api/jobs.js'

function ApplicantDetails() {
  const { applicationId } = useParams()
  return <ApplicantDetailsView key={applicationId} applicationId={applicationId} />
}

function displayValue(value) {
  if (value == null || value === '') {
    return '—'
  }
  return String(value)
}

function ApplicantDetailsView({ applicationId }) {
  const [searchParams] = useSearchParams()
  const validId = isApplicationId(applicationId)
  const listPath = employerApplicantsPath({
    q: searchParams.get('q') || undefined,
    status: searchParams.get('status') || undefined,
    jobId: searchParams.get('jobId') || undefined,
  })
  const [application, setApplication] = useState(null)
  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(validId)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(!validId)
  const [retryNonce, setRetryNonce] = useState(0)
  const [reviewNote, setReviewNote] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!validId) {
      return undefined
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setNotFound(false)
    Promise.all([
      fetchEmployerApplication(applicationId, { signal: controller.signal }),
      fetchEmployerInterviews({
        applicationId,
        page: 1,
        limit: 20,
        signal: controller.signal,
      }),
    ])
      .then(([next, interviewPage]) => {
        if (!controller.signal.aborted) {
          setApplication(next)
          setInterviews(interviewPage.items)
        }
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setApplication(null)
        if (loadError.status === 404) {
          setNotFound(true)
          return
        }
        setError(userFacingApplicationError(loadError))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [applicationId, retryNonce, validId])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function runAction(action, successMessage) {
    if (!application || busy) {
      return
    }
    setBusy(true)
    setActionError('')
    try {
      const next = await action({ reviewNote })
      setApplication(next)
      setRejectOpen(false)
      setReviewNote('')
      showToast(successMessage)
    } catch (mutateError) {
      setActionError(userFacingApplicationError(mutateError))
    } finally {
      setBusy(false)
    }
  }

  async function handleDownloadPdf() {
    if (!application || busy) {
      return
    }
    setBusy(true)
    setActionError('')
    try {
      await downloadEmployerApplicationPdf(application)
    } catch (downloadError) {
      setActionError(userFacingApplicationError(downloadError))
    } finally {
      setBusy(false)
    }
  }

  async function handleDownloadOriginal() {
    if (!application || busy) {
      return
    }
    setBusy(true)
    setActionError('')
    try {
      await downloadEmployerApplicationOriginal(application)
    } catch (downloadError) {
      setActionError(userFacingApplicationError(downloadError))
    } finally {
      setBusy(false)
    }
  }

  async function handleViewPdf() {
    if (!application || busy) {
      return
    }
    setBusy(true)
    setActionError('')
    try {
      const blob = await loadEmployerApplicationPdfBlob(application)
      const nextUrl = URL.createObjectURL(blob)
      setPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current)
        }
        return nextUrl
      })
    } catch (previewError) {
      setActionError(userFacingApplicationError(previewError))
    } finally {
      setBusy(false)
    }
  }

  if (notFound) {
    return (
      <PageContent title="Applicant not found">
        <Card>
          <p className="po-body">This application is not available.</p>
          <div className="mt-5">
            <Button to={listPath}>Back to Applicants</Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  const applicant = application?.applicant
  const job = application?.job
  const snapshot = application?.snapshot
  const noteLength = reviewNote.trim().length
  const noteTooLong = reviewNote.length > REVIEW_NOTE_MAX

  return (
    <PageContent
      title={applicant?.fullName || 'Applicant'}
      description="Review this submitted application and update its status."
      actions={
        <Button variant="secondary" to={listPath}>
          Back to Applicants
        </Button>
      }
    >
      <QueryStatus
        loading={loading}
        error={error}
        loadingLabel="Loading application…"
        onRetry={() => setRetryNonce((current) => current + 1)}
      >
        {application ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)]">
            <div className="space-y-6">
              <Card>
                <h2 className="po-section-title">Candidate profile</h2>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Full name" value={displayValue(applicant?.fullName)} />
                  <DetailItem label="Email" value={displayValue(applicant?.email)} />
                  <DetailItem label="Phone" value={displayValue(applicant?.phone)} />
                  <DetailItem label="Location" value={displayValue(applicant?.location)} />
                  <DetailItem label="Education level" value={displayValue(applicant?.educationLevel)} />
                  <DetailItem label="Field of study" value={displayValue(applicant?.fieldOfStudy)} />
                  <DetailItem label="Institution" value={displayValue(applicant?.institution)} />
                  <DetailItem label="Graduation year" value={displayValue(applicant?.graduationYear)} />
                  <div className="sm:col-span-2">
                    <dt className="po-helper mt-0">Experience summary</dt>
                    <dd className="po-body mt-1">{displayValue(applicant?.experienceSummary)}</dd>
                  </div>
                </dl>
              </Card>

              <Card>
                <h2 className="po-section-title">Applied job</h2>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Job title" value={displayValue(job?.title)} />
                  <DetailItem label="Employment type" value={job ? formatEmploymentType(job.employmentType) : '—'} />
                  <DetailItem label="Location" value={displayValue(job?.location)} />
                  <DetailItem label="Submitted" value={formatJobDateTime(application.appliedAt)} />
                  <div>
                    <dt className="po-helper mt-0">Application status</dt>
                    <dd className="mt-1">
                      <Badge tone={applicationStatusTone(application.status)} className="normal-case">
                        {formatApplicationStatus(application.status)}
                      </Badge>
                    </dd>
                  </div>
                </dl>
                {job ? (
                  <div className="mt-5">
                    <Button variant="secondary" size="sm" to={staffJobPath(job.id)}>
                      Open job posting
                    </Button>
                  </div>
                ) : null}
              </Card>

              <Card>
                <h2 className="po-section-title">Submitted resume snapshot</h2>
                <p className="po-secondary mt-2">{EMPLOYER_SNAPSHOT_COPY}</p>
                {snapshot ? (
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <DetailItem label="Resume title" value={snapshot.resumeTitle} />
                    <DetailItem label="Template" value={snapshot.templateKey} />
                    <DetailItem
                      label="Original upload"
                      value={snapshot.hasOriginalFile ? 'Preserved with this application' : 'None'}
                    />
                  </dl>
                ) : (
                  <p className="po-body mt-4">Submitted resume details are unavailable.</p>
                )}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button variant="secondary" onClick={handleViewPdf} disabled={busy || !snapshot}>
                    View submitted PDF
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadPdf} disabled={busy || !snapshot}>
                    Download submitted PDF
                  </Button>
                  {snapshot?.hasOriginalFile ? (
                    <Button variant="secondary" onClick={handleDownloadOriginal} disabled={busy}>
                      Download original resume
                    </Button>
                  ) : null}
                </div>
              </Card>

              <Card>
                <h2 className="po-section-title">Status history</h2>
                <div className="mt-5">
                  <Table
                    minWidthClass="min-w-[640px]"
                    headers={['From', 'To', 'Actor', 'When', 'Internal note']}
                    rows={(application.statusEvents || []).map((event) => [
                      event.fromStatus ? formatApplicationStatus(event.fromStatus) : '—',
                      formatApplicationStatus(event.toStatus),
                      event.actor?.fullName || '—',
                      formatJobDateTime(event.createdAt),
                      event.reviewNote || '—',
                    ])}
                    emptyTitle="No status history is stored."
                  />
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <h2 className="po-section-title">Application actions</h2>
                <p className="po-secondary mt-2">
                  Move this application to under review, shortlist or reject. Hiring decisions are not available yet.
                </p>
                <div className="mt-5">
                  <TextArea
                    id="employer-review-note"
                    label="Internal review note"
                    rows={4}
                    maxLength={REVIEW_NOTE_MAX}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    helperText={`${Math.min(noteLength, REVIEW_NOTE_MAX)} / ${REVIEW_NOTE_MAX}. This note stays internal to your company.`}
                    error={noteTooLong ? `Keep the note to ${REVIEW_NOTE_MAX} characters.` : undefined}
                  />
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  {canReviewEmployerApplication(application) ? (
                    <Button
                      onClick={() => runAction(
                        (options) => reviewEmployerApplication(application.id, options),
                        'Application moved to under review.',
                      )}
                      disabled={busy || noteTooLong}
                    >
                      Mark as Under Review
                    </Button>
                  ) : null}
                  {canShortlistEmployerApplication(application) ? (
                    <Button
                      variant="secondary"
                      onClick={() => runAction(
                        (options) => shortlistEmployerApplication(application.id, options),
                        'Candidate shortlisted.',
                      )}
                      disabled={busy || noteTooLong}
                    >
                      Shortlist
                    </Button>
                  ) : null}
                  {canRejectEmployerApplication(application) ? (
                    <Button
                      variant="danger"
                      onClick={() => setRejectOpen(true)}
                      disabled={busy || noteTooLong}
                    >
                      Reject
                    </Button>
                  ) : null}
                  {canScheduleInterviewForApplication(application, interviews) ? (
                    <Button variant="secondary" to={employerInterviewCreatePath(application.id)}>
                      Schedule interview
                    </Button>
                  ) : null}
                  {interviews[0] ? (
                    <Button variant="secondary" to={employerInterviewPath(interviews[0].id)}>
                      View interview
                    </Button>
                  ) : null}
                  {!canReviewEmployerApplication(application)
                    && !canShortlistEmployerApplication(application)
                    && !canRejectEmployerApplication(application)
                    && !canScheduleInterviewForApplication(application, interviews)
                    && interviews.length === 0 ? (
                      <p className="po-body">
                        No further employer status changes are available for this application.
                      </p>
                    ) : null}
                </div>
                {actionError ? (
                  <p className="po-helper po-helper-error mt-4" role="alert">
                    {actionError}
                  </p>
                ) : null}
              </Card>
            </div>
          </div>
        ) : null}
      </QueryStatus>

      <Modal
        open={rejectOpen}
        title="Reject application"
        onClose={() => setRejectOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => runAction(
                (options) => rejectEmployerApplication(application.id, options),
                'Application rejected.',
              )}
              disabled={busy || noteTooLong}
            >
              {busy ? 'Rejecting…' : 'Confirm rejection'}
            </Button>
          </>
        }
      >
        <p className="po-body">
          Reject this application? The candidate cannot apply for this job again.
        </p>
      </Modal>

      <Modal
        open={Boolean(previewUrl)}
        title="Submitted resume snapshot"
        onClose={() => {
          setPreviewUrl((current) => {
            if (current) {
              URL.revokeObjectURL(current)
            }
            return ''
          })
        }}
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              setPreviewUrl((current) => {
                if (current) {
                  URL.revokeObjectURL(current)
                }
                return ''
              })
            }}
          >
            Close
          </Button>
        }
      >
        {previewUrl ? (
          <iframe title="Submitted resume snapshot" src={previewUrl} className="h-[70vh] w-full rounded-md border-0" />
        ) : null}
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default ApplicantDetails
