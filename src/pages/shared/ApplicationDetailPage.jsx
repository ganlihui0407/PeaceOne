import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import {
  APPLICATION_OFFERED_COPY,
  APPLICATION_SNAPSHOT_COPY,
  APPLICATION_WITHDRAWN_COPY,
  applicationStatusTone,
  canWithdrawApplication,
  candidateApplicationsPath,
  downloadMyApplicationPdf,
  fetchMyApplication,
  formatApplicationStatus,
  formatEmploymentType,
  formatJobDateTime,
  isAbortError,
  isApplicationId,
  userFacingApplicationError,
  withdrawMyApplication,
} from '../../api/applications.js'
import {
  candidateInterviewPath,
  fetchMyInterviews,
  formatInterviewStatus,
  formatInterviewWhen,
  interviewStatusTone,
} from '../../api/interviews.js'
import { candidateJobPath, formatSalaryRange } from '../../api/jobs.js'
import { fetchRelatedNotifications, formatNotificationTime } from '../../api/notifications.js'

function ApplicationDetailPage({ basePath }) {
  const { applicationId } = useParams()
  return <ApplicationDetailView key={applicationId} basePath={basePath} applicationId={applicationId} />
}

function ApplicationDetailView({ basePath, applicationId }) {
  const validId = isApplicationId(applicationId)
  const listPath = candidateApplicationsPath(basePath)
  const [application, setApplication] = useState(null)
  const [interviews, setInterviews] = useState([])
  const [notifications, setNotifications] = useState([])
  const [notificationMeta, setNotificationMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [notificationPage, setNotificationPage] = useState(1)
  const [loading, setLoading] = useState(validId)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(!validId)
  const [retryNonce, setRetryNonce] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (!validId) {
      return undefined
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setNotFound(false)
    Promise.all([
      fetchMyApplication(applicationId, { signal: controller.signal }),
      fetchMyInterviews({ applicationId, page: 1, limit: 20, signal: controller.signal }),
      fetchRelatedNotifications({
        applicationId,
        page: notificationPage,
        limit: 20,
        signal: controller.signal,
      }).catch((notificationError) => {
        if (isAbortError(notificationError) || controller.signal.aborted) {
          throw notificationError
        }
        return { items: [], page: 1, limit: 20, total: 0, totalPages: 0 }
      }),
    ])
      .then(([next, interviewPage, relatedNotifications]) => {
        if (!controller.signal.aborted) {
          setApplication(next)
          setInterviews(interviewPage.items)
          setNotifications(relatedNotifications.items)
          setNotificationMeta({
            page: relatedNotifications.page,
            limit: relatedNotifications.limit,
            total: relatedNotifications.total,
            totalPages: relatedNotifications.totalPages,
          })
        }
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setApplication(null)
        setInterviews([])
        setNotifications([])
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
  }, [applicationId, notificationPage, retryNonce, validId])

  async function handleWithdraw() {
    if (!application || busy) {
      return
    }
    setBusy(true)
    setActionError('')
    try {
      const next = await withdrawMyApplication(application.id)
      setApplication(next)
      setConfirmOpen(false)
    } catch (withdrawError) {
      setActionError(userFacingApplicationError(withdrawError))
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload() {
    if (!application || busy) {
      return
    }
    setBusy(true)
    setActionError('')
    try {
      await downloadMyApplicationPdf(application)
    } catch (downloadError) {
      setActionError(userFacingApplicationError(downloadError))
    } finally {
      setBusy(false)
    }
  }

  if (notFound) {
    return (
      <PageContent title="Application unavailable">
        <Card>
          <p className="po-body">This application is not available.</p>
          <div className="mt-5">
            <Button to={listPath}>Back to My Applications</Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  const job = application?.job
  const snapshot = application?.snapshot

  return (
    <PageContent
      title={job?.title || 'Application'}
      description="Review the submitted application, stored resume copy and status history."
      actions={
        <Button variant="secondary" to={listPath}>
          Back to My Applications
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
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]">
            <div className="space-y-6">
              <Card>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={applicationStatusTone(application.status)} className="normal-case">
                    {formatApplicationStatus(application.status)}
                  </Badge>
                  {job ? <Badge tone="primary">{formatEmploymentType(job.employmentType)}</Badge> : null}
                </div>
                <h1 className="po-page-title mt-4">{job?.title || 'Unavailable job'}</h1>
                <p className="po-secondary mt-2">
                  {job?.company?.companyName || '—'}
                  {job?.company?.industry ? ` · ${job.company.industry}` : ''}
                </p>
                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Location" value={job?.location || '—'} />
                  <DetailItem label="Employment type" value={job ? formatEmploymentType(job.employmentType) : '—'} />
                  <DetailItem label="Salary" value={job ? formatSalaryRange(job) : '—'} />
                  <DetailItem label="Submitted" value={formatJobDateTime(application.appliedAt)} />
                  <DetailItem label="Current status" value={formatApplicationStatus(application.status)} />
                  <DetailItem
                    label="Employer review"
                    value={
                      application.status === 'SUBMITTED'
                        ? 'Waiting for employer review'
                        : formatApplicationStatus(application.status)
                    }
                  />
                </dl>
                {job?.company?.description ? (
                  <p className="po-secondary mt-4">{job.company.description}</p>
                ) : null}
                {job ? (
                  <div className="mt-5">
                    <Link to={candidateJobPath(basePath, job.id)} className="text-sm font-medium text-primary">
                      Open job details
                    </Link>
                  </div>
                ) : null}
              </Card>

              <Card>
                <h2 className="po-section-title">Submitted resume</h2>
                <p className="po-secondary mt-2">{APPLICATION_SNAPSHOT_COPY}</p>
                {snapshot ? (
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <DetailItem label="Resume title" value={snapshot.resumeTitle} />
                    <DetailItem label="Template" value={snapshot.templateKey} />
                    <DetailItem label="Submitted PDF" value={snapshot.generatedPdfFilename} />
                    <DetailItem
                      label="Original upload"
                      value={snapshot.hasOriginalFile ? snapshot.originalFileFilename || 'Preserved' : 'None'}
                    />
                  </dl>
                ) : (
                  <p className="po-body mt-4">Submitted resume details are unavailable.</p>
                )}
                <div className="mt-5">
                  <Button variant="secondary" onClick={handleDownload} disabled={busy || !snapshot}>
                    Download submitted PDF
                  </Button>
                </div>
              </Card>

              <Card>
                <h2 className="po-section-title">Status history</h2>
                {(application.statusEvents || []).length === 0 ? (
                  <p className="po-secondary mt-4">No status history is stored.</p>
                ) : (
                  <ol className="mt-5 space-y-4 border-l border-line pl-5">
                    {(application.statusEvents || []).map((event) => (
                      <li key={event.id || `${event.toStatus}-${event.createdAt}`} className="relative">
                        <span className="absolute -left-[1.45rem] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                        <p className="po-card-title">
                          {event.fromStatus
                            ? `${formatApplicationStatus(event.fromStatus)} → ${formatApplicationStatus(event.toStatus)}`
                            : formatApplicationStatus(event.toStatus)}
                        </p>
                        <p className="po-helper mt-1">{formatJobDateTime(event.createdAt)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>

              <Card>
                <h2 className="po-section-title">Interviews</h2>
                <div className="mt-5">
                  <Table
                    minWidthClass="min-w-[640px]"
                    headers={['Title', 'When', 'Status', 'Meeting link', 'Actions']}
                    rows={interviews.map((item) => [
                      item.title,
                      formatInterviewWhen(item),
                      <Badge key={`${item.id}-status`} tone={interviewStatusTone(item.status)} className="normal-case">
                        {formatInterviewStatus(item.status)}
                      </Badge>,
                      item.meetingLink ? (
                        <a
                          key={`${item.id}-link`}
                          href={item.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary"
                        >
                          Open meeting link
                        </a>
                      ) : (
                        '—'
                      ),
                      <Button
                        key={`${item.id}-view`}
                        size="sm"
                        variant="secondary"
                        to={candidateInterviewPath(basePath, item.id)}
                      >
                        View interview
                      </Button>,
                    ])}
                    emptyTitle="No interviews have been recorded for this application."
                  />
                </div>
              </Card>

              <Card>
                <h2 className="po-section-title">Related notifications</h2>
                <div className="mt-5">
                  <Table
                    minWidthClass="min-w-[520px]"
                    headers={['Title', 'When']}
                    rows={notifications.map((item) => [item.title, formatNotificationTime(item.createdAt)])}
                    emptyTitle="No related notifications are stored for this application."
                  />
                  <PaginationBar
                    page={notificationMeta.page}
                    totalPages={notificationMeta.totalPages}
                    total={notificationMeta.total}
                    noun="related notifications"
                    disabled={loading}
                    onPrevious={() => setNotificationPage((current) => Math.max(1, current - 1))}
                    onNext={() => setNotificationPage((current) => current + 1)}
                  />
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <h2 className="po-section-title">Actions</h2>
                {application.status === 'WITHDRAWN' ? (
                  <p className="po-body mt-3">{APPLICATION_WITHDRAWN_COPY}</p>
                ) : application.status === 'OFFERED' ? (
                  <p className="po-body mt-3">{APPLICATION_OFFERED_COPY}</p>
                ) : canWithdrawApplication(application) ? (
                  <>
                    <p className="po-secondary mt-2">
                      You can withdraw while the application is still submitted. Review by the employer blocks withdrawal.
                    </p>
                    <div className="mt-5">
                      <Button variant="danger" onClick={() => setConfirmOpen(true)} disabled={busy}>
                        Withdraw application
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="po-body mt-3">
                    Withdrawal is no longer available because employer review has started or the application is closed.
                  </p>
                )}
                {actionError ? <p className="po-helper po-helper-error mt-4" role="alert">{actionError}</p> : null}
              </Card>
            </div>
          </div>
        ) : null}
      </QueryStatus>

      <Modal
        open={confirmOpen}
        title="Withdraw application"
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleWithdraw} disabled={busy}>
              {busy ? 'Withdrawing…' : 'Confirm withdrawal'}
            </Button>
          </>
        }
      >
        <p className="po-body">Withdraw this application? You cannot apply for this job again.</p>
      </Modal>
    </PageContent>
  )
}

export default ApplicationDetailPage
