import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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
  JOB_FIELD_LIMITS,
  adminJobsPath,
  canAdminCloseJob,
  canSuspendJob,
  closeAdminJob,
  fetchAdminJob,
  formatEmploymentType,
  formatJobDate,
  formatJobDateTime,
  formatJobStatus,
  formatSalaryRange,
  isAbortError,
  isJobId,
  jobStatusTone,
  suspendAdminJob,
  userFacingJobError,
} from '../../api/jobs.js'

function JobModeration() {
  const { jobId } = useParams()
  return <JobModerationView key={jobId} jobId={jobId} />
}

function JobModerationView({ jobId }) {
  const validId = isJobId(jobId)
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(validId)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)

  useEffect(() => {
    if (!validId) {
      return undefined
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setNotFound(false)
    fetchAdminJob(jobId, { signal: controller.signal })
      .then((next) => {
        if (!controller.signal.aborted) {
          setJob(next)
        }
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setJob(null)
        if (loadError.status === 404) {
          setNotFound(true)
          return
        }
        setError(userFacingJobError(loadError))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [jobId, retryNonce, validId])

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function handleSuspend() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setReasonError('Enter a reason before suspending this listing.')
      return
    }
    setBusy(true)
    setActionError('')
    setReasonError('')
    try {
      const next = await suspendAdminJob(job.id, { reason: trimmed })
      setJob(next)
      setSuspendOpen(false)
      setReason('')
      showToast('Job posting suspended.')
    } catch (err) {
      setActionError(userFacingJobError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleClose() {
    setBusy(true)
    setActionError('')
    try {
      const next = await closeAdminJob(job.id, { reason: reason.trim() || undefined })
      setJob(next)
      setCloseOpen(false)
      showToast('Job posting closed.')
    } catch (err) {
      setActionError(userFacingJobError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!validId || notFound) {
    return (
      <PageContent title="Job posting not found">
        <Card>
          <p className="po-body">This job posting could not be found.</p>
          <div className="mt-5">
            <Button to={adminJobsPath()} variant="secondary">
              Back to Job Monitoring
            </Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent
      title={job?.title || 'Job posting'}
      description="Review this vacancy, its status history, and take a moderation action when needed."
      actions={
        <Button variant="secondary" to={adminJobsPath()}>
          Back to Job Monitoring
        </Button>
      }
    >
      <QueryStatus
        loading={loading}
        error={error}
        loadingLabel="Loading job posting…"
        onRetry={() => setRetryNonce((current) => current + 1)}
      >
        {job ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]">
            <div className="space-y-6">
              <Card>
                <h2 className="po-section-title">Job Posting</h2>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Company" value={job.company.companyName} />
                  <DetailItem label="Industry" value={job.company.industry || '—'} />
                  <DetailItem label="Job title" value={job.title} />
                  <DetailItem label="Employment type" value={formatEmploymentType(job.employmentType)} />
                  <DetailItem label="Location" value={job.location} />
                  <DetailItem label="Salary range" value={formatSalaryRange(job)} />
                  <div>
                    <dt className="po-helper mt-0">Job status</dt>
                    <dd className="mt-1">
                      <Badge tone={jobStatusTone(job.status)} className="normal-case">
                        {formatJobStatus(job.status)}
                      </Badge>
                    </dd>
                  </div>
                  <DetailItem label="Employer" value={job.createdBy?.fullName || '—'} />
                  <DetailItem label="Created" value={formatJobDate(job.createdAt)} />
                  <DetailItem label="Published" value={formatJobDate(job.publishedAt)} />
                  <DetailItem label="Closing date" value={formatJobDate(job.closesAt)} />
                </dl>
              </Card>

              <Card>
                <h2 className="po-section-title">Company</h2>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Website" value={job.company.website || '—'} />
                  <DetailItem label="Company location" value={job.company.location || '—'} />
                </dl>
                {job.company.description ? (
                  <p className="po-body mt-4">{job.company.description}</p>
                ) : null}
              </Card>

              <Card>
                <h2 className="po-section-title">Job Description</h2>
                <p className="po-body mt-4 whitespace-pre-wrap">{job.description}</p>
              </Card>

              <Card>
                <h2 className="po-section-title">Qualification Required</h2>
                <p className="po-body mt-4 whitespace-pre-wrap">{job.qualificationRequired}</p>
              </Card>

              <Card>
                <h2 className="po-section-title">Experience Required</h2>
                <p className="po-body mt-4 whitespace-pre-wrap">{job.experienceRequired}</p>
              </Card>

              <Card>
                <h2 className="po-section-title">Required Skills</h2>
                <div className="mt-5">
                  {job.requiredSkills.length === 0 ? (
                    <p className="po-helper mt-0">No ESCO skills have been recorded.</p>
                  ) : (
                    <Table
                      minWidthClass="min-w-[420px]"
                      headers={['Skill', 'Required level']}
                      rows={job.requiredSkills.map((skill) => [
                        skill.skill.preferredLabel,
                        skill.requiredLevel,
                      ])}
                    />
                  )}
                </div>
              </Card>

              <Card>
                <h2 className="po-section-title">Status history</h2>
                <div className="mt-5">
                  {job.statusEvents.length === 0 ? (
                    <p className="po-helper mt-0">No status events have been recorded yet.</p>
                  ) : (
                    <Table
                      minWidthClass="min-w-[640px]"
                      headers={['From', 'To', 'Actor', 'Note', 'When']}
                      rows={job.statusEvents.map((event) => [
                        event.fromStatus ? formatJobStatus(event.fromStatus) : '—',
                        formatJobStatus(event.toStatus),
                        event.actor?.fullName || '—',
                        event.note || '—',
                        formatJobDateTime(event.createdAt),
                      ])}
                    />
                  )}
                </div>
              </Card>
            </div>

            <Card>
              <h2 className="po-section-title">Moderation</h2>
              <p className="po-helper mt-3">
                Publication is direct. Use suspend for inappropriate published listings, or close a published or
                suspended vacancy.
              </p>
              {actionError ? <p className="po-helper mt-3 text-danger">{actionError}</p> : null}
              <div className="mt-5">
                <TextArea
                  id="admin-suspend-reason"
                  label="Reason"
                  rows={5}
                  value={reason}
                  error={reasonError}
                  disabled={busy}
                  maxLength={JOB_FIELD_LIMITS.reason}
                  onChange={(event) => {
                    setReason(event.target.value)
                    setReasonError('')
                  }}
                />
              </div>
              <div className="mt-5 flex flex-col gap-2">
                {canSuspendJob(job) ? (
                  <Button disabled={busy} onClick={() => setSuspendOpen(true)}>
                    Suspend posting
                  </Button>
                ) : null}
                {canAdminCloseJob(job) ? (
                  <Button variant="secondary" disabled={busy} onClick={() => setCloseOpen(true)}>
                    Close posting
                  </Button>
                ) : null}
                {!canSuspendJob(job) && !canAdminCloseJob(job) ? (
                  <p className="po-helper mt-0">No moderation actions are available for this status.</p>
                ) : null}
              </div>
            </Card>
          </div>
        ) : null}
      </QueryStatus>

      <Modal
        open={suspendOpen}
        title="Suspend job posting"
        onClose={() => setSuspendOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={handleSuspend}>
              Suspend
            </Button>
          </>
        }
      >
        <p className="po-body">
          Suspended jobs are removed from candidate search immediately. A reason is required and is stored in the
          status history.
        </p>
      </Modal>

      <Modal
        open={closeOpen}
        title="Close job posting"
        onClose={() => setCloseOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloseOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={handleClose}>
              Close posting
            </Button>
          </>
        }
      >
        <p className="po-body">Closed jobs stay in the admin record and are hidden from candidate search.</p>
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default JobModeration
