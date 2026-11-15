import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import {
  employerApplicantsPath,
  fetchEmployerApplications,
  userFacingApplicationError,
} from '../../api/applications.js'
import {
  canCloseStaffJob,
  canDeleteJob,
  canEditJob,
  canPublishJob,
  closeStaffJob,
  deleteStaffJob,
  fetchStaffJob,
  formatEmploymentType,
  formatJobDate,
  formatJobDateTime,
  formatJobStatus,
  formatSalaryRange,
  isAbortError,
  isJobId,
  jobStatusTone,
  publishStaffJob,
  staffJobEditPath,
  staffJobsPath,
  userFacingJobError,
} from '../../api/jobs.js'

function JobPostingDetails() {
  const { jobId } = useParams()
  return <JobPostingDetailsView key={jobId} jobId={jobId} />
}

function JobPostingDetailsView({ jobId }) {
  const navigate = useNavigate()
  const validId = isJobId(jobId)
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(validId)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [publishOpen, setPublishOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [applicationCount, setApplicationCount] = useState(null)
  const [countError, setCountError] = useState('')

  useEffect(() => {
    if (!validId) {
      return undefined
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setNotFound(false)
    fetchStaffJob(jobId, { signal: controller.signal })
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

  useEffect(() => {
    if (!validId) {
      return undefined
    }
    const controller = new AbortController()
    setApplicationCount(null)
    setCountError('')
    fetchEmployerApplications({ jobId, page: 1, limit: 1, signal: controller.signal })
      .then((applications) => {
        if (!controller.signal.aborted) {
          setApplicationCount(applications.total)
        }
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setApplicationCount(null)
        setCountError(userFacingApplicationError(loadError))
      })
    return () => controller.abort()
  }, [jobId, retryNonce, validId])

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function runAction(action, successMessage, { leave } = {}) {
    setBusy(true)
    setActionError('')
    try {
      const next = await action()
      if (leave) {
        showToast(successMessage)
        navigate(staffJobsPath())
        return
      }
      setJob(next)
      setPublishOpen(false)
      setCloseOpen(false)
      showToast(successMessage)
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
            <Button to={staffJobsPath()} variant="secondary">
              Back to Manage Job Postings
            </Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent
      title={job?.title || 'Job posting'}
      description="Review the vacancy details stored for this company."
      actions={
        <>
          <Button variant="secondary" to={staffJobsPath()}>
            Back to Manage Job Postings
          </Button>
          {canEditJob(job) ? <Button to={staffJobEditPath(job.id)}>Edit Job Posting</Button> : null}
        </>
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
                <h2 className="po-section-title">Job & Company Information</h2>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Company" value={job.company.companyName} />
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
                  <DetailItem label="Created" value={formatJobDate(job.createdAt)} />
                  <DetailItem label="Published" value={formatJobDate(job.publishedAt)} />
                  <DetailItem label="Closing date" value={formatJobDate(job.closesAt)} />
                </dl>
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
                    <p className="po-helper mt-0">No ESCO skills have been added yet.</p>
                  ) : (
                    <Table
                      minWidthClass="min-w-[520px]"
                      headers={['Skill', 'Required level']}
                      rows={job.requiredSkills.map((skill) => [
                        skill.skill.preferredLabel,
                        skill.requiredLevel,
                      ])}
                    />
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <h2 className="po-section-title">Actions</h2>
                {actionError ? <p className="po-helper mt-3 text-danger">{actionError}</p> : null}
                <div className="mt-5 flex flex-col gap-2">
                  {canPublishJob(job) ? (
                    <Button disabled={busy} onClick={() => setPublishOpen(true)}>
                      Publish
                    </Button>
                  ) : null}
                  {canCloseStaffJob(job) ? (
                    <Button variant="secondary" disabled={busy} onClick={() => setCloseOpen(true)}>
                      Close vacancy
                    </Button>
                  ) : null}
                  {canDeleteJob(job) ? (
                    <Button variant="danger" disabled={busy} onClick={() => setDeleteOpen(true)}>
                      Delete draft
                    </Button>
                  ) : null}
                  <Button variant="secondary" to={employerApplicantsPath({ jobId: job.id })}>
                    View Applicants
                  </Button>
                </div>
                <p className="po-helper mt-4">
                  {countError
                    ? countError
                    : applicationCount == null
                      ? 'Application count is loading…'
                      : `${applicationCount} application${applicationCount === 1 ? '' : 's'} for this job.`}
                </p>
              </Card>

              <Card>
                <h2 className="po-section-title">Status history</h2>
                <div className="mt-5">
                  {job.statusEvents.length === 0 ? (
                    <p className="po-helper mt-0">No status events have been recorded yet.</p>
                  ) : (
                    <Table
                      minWidthClass="min-w-[420px]"
                      headers={['From', 'To', 'Actor', 'When']}
                      rows={job.statusEvents.map((event) => [
                        event.fromStatus ? formatJobStatus(event.fromStatus) : '—',
                        formatJobStatus(event.toStatus),
                        event.actor?.fullName || '—',
                        formatJobDateTime(event.createdAt),
                      ])}
                    />
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </QueryStatus>

      <Modal
        open={publishOpen}
        title="Publish job posting"
        onClose={() => setPublishOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() => runAction(() => publishStaffJob(job.id), 'Job posting published.')}
            >
              Publish
            </Button>
          </>
        }
      >
        <p className="po-body">
          Publishing makes this vacancy visible to students and job seekers immediately.
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
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => runAction(() => closeStaffJob(job.id), 'Job posting closed.')}
            >
              Close vacancy
            </Button>
          </>
        }
      >
        <p className="po-body">Closed jobs are hidden from candidate search.</p>
      </Modal>

      <Modal
        open={deleteOpen}
        title="Delete draft job"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                runAction(() => deleteStaffJob(job.id), 'Draft job posting deleted.', { leave: true })
              }
            >
              Delete draft
            </Button>
          </>
        }
      >
        <p className="po-body">Only draft jobs can be deleted.</p>
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default JobPostingDetails
