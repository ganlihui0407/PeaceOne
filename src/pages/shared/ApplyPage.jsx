import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import RadioGroup from '../../components/forms/RadioGroup.jsx'
import {
  APPLICATION_ALREADY_EXISTS,
  APPLICATION_RESUME_REQUIRED,
  APPLICATION_SNAPSHOT_COPY,
  candidateApplicationPath,
  candidateApplicationsPath,
  fetchMyApplicationForJob,
  formatApplicationStatus,
  formatEmploymentType,
  isAbortError,
  submitJobApplication,
  userFacingApplicationError,
} from '../../api/applications.js'
import {
  candidateJobPath,
  fetchPublishedJob,
  formatJobDate,
  isJobId,
  userFacingPublishedJobError,
} from '../../api/jobs.js'
import { fetchResumes, formatResumeUpdatedAt, userFacingResumeError } from '../../api/resumes.js'

function ApplyPage({ basePath }) {
  const { jobId } = useParams()
  return <ApplyPageView key={jobId} basePath={basePath} jobId={jobId} />
}

function ApplyPageView({ basePath, jobId }) {
  const validId = isJobId(jobId)
  const jobPath = candidateJobPath(basePath, jobId)
  const [job, setJob] = useState(null)
  const [resumes, setResumes] = useState([])
  const [existing, setExisting] = useState(null)
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [loading, setLoading] = useState(validId)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(!validId)
  const [retryNonce, setRetryNonce] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(null)

  useEffect(() => {
    if (!validId) {
      return undefined
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setNotFound(false)
    Promise.all([
      fetchPublishedJob(jobId, { signal: controller.signal }),
      fetchResumes({ signal: controller.signal }),
      fetchMyApplicationForJob(jobId, { signal: controller.signal }),
    ])
      .then(([nextJob, nextResumes, nextExisting]) => {
        if (controller.signal.aborted) {
          return
        }
        setJob(nextJob)
        setResumes(nextResumes)
        setExisting(nextExisting)
        const primary = nextResumes.find((item) => item.isPrimary) || nextResumes[0]
        setSelectedResumeId(primary?.id || '')
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setJob(null)
        setResumes([])
        setExisting(null)
        if (loadError.status === 404) {
          setNotFound(true)
          return
        }
        setError(userFacingPublishedJobError(loadError) || userFacingResumeError(loadError))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [jobId, retryNonce, validId])

  const selectedResume = useMemo(
    () => resumes.find((item) => item.id === selectedResumeId) || null,
    [resumes, selectedResumeId],
  )

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedResumeId || submitting) {
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const application = await submitJobApplication(jobId, selectedResumeId)
      setSubmitted(application)
      setExisting(application)
    } catch (submit) {
      if (submit.status === 409 && submit.message === APPLICATION_ALREADY_EXISTS) {
        try {
          const current = await fetchMyApplicationForJob(jobId)
          if (current) {
            setExisting(current)
            setSubmitted(current)
            return
          }
        } catch {
          // Fall through to the API error.
        }
      }
      setSubmitError(userFacingApplicationError(submit))
    } finally {
      setSubmitting(false)
    }
  }

  if (notFound) {
    return (
      <PageContent title="Apply">
        <Card>
          <p className="po-body">This job is not available.</p>
          <div className="mt-5">
            <Button to={`${basePath}/jobs`}>Back to Jobs</Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  const alreadyApplied = existing && !submitted

  return (
    <PageContent
      title={job ? `Apply for ${job.title}` : 'Apply'}
      description="Select a saved resume. PeaceOne stores an independent copy with this application."
      actions={
        <Button variant="secondary" to={jobPath}>
          Back to job details
        </Button>
      }
    >
      <QueryStatus
        loading={loading}
        error={error}
        loadingLabel="Loading application details…"
        onRetry={() => setRetryNonce((current) => current + 1)}
      >
        {job ? (
          <div className="space-y-6">
            <Card>
              <p className="po-secondary">Job summary</p>
              <h2 className="po-section-title mt-1">{job.title}</h2>
              <p className="po-secondary mt-1">
                {job.company.companyName}
                {job.company.industry ? ` · ${job.company.industry}` : ''}
              </p>
              <p className="po-helper mt-3">
                {formatEmploymentType(job.employmentType)} · {job.location}
                {job.closesAt ? ` · Closes ${formatJobDate(job.closesAt)}` : ''}
              </p>
            </Card>

            {submitted ? (
              <Card>
                <h2 className="po-section-title">Application submitted</h2>
                <p className="po-body mt-3">
                  Your application was submitted. PeaceOne stored an independent copy of the selected resume.
                </p>
                <p className="po-secondary mt-2">
                  Status: {formatApplicationStatus(submitted.status)}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button to={candidateApplicationPath(basePath, submitted.id)}>
                    View application
                  </Button>
                  <Button variant="secondary" to={candidateApplicationsPath(basePath)}>
                    My Applications
                  </Button>
                </div>
              </Card>
            ) : alreadyApplied ? (
              <Card>
                <h2 className="po-section-title">Already Applied</h2>
                <p className="po-body mt-3">
                  You have already applied for this job. Withdrawal does not allow a second application.
                </p>
                <p className="po-secondary mt-2">
                  Status: {formatApplicationStatus(alreadyApplied.status)}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button to={candidateApplicationPath(basePath, alreadyApplied.id)}>
                    View application
                  </Button>
                  <Button variant="secondary" to={candidateApplicationsPath(basePath)}>
                    My Applications
                  </Button>
                </div>
              </Card>
            ) : resumes.length === 0 ? (
              <Card>
                <h2 className="po-section-title">Resume required</h2>
                <p className="po-body mt-3">{APPLICATION_RESUME_REQUIRED}</p>
                <div className="mt-5">
                  <Button to={`${basePath}/resume`}>Go to My Resume</Button>
                </div>
              </Card>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                  <h2 className="po-section-title">Choose resume</h2>
                  <p className="po-secondary mt-2">{APPLICATION_SNAPSHOT_COPY}</p>
                  <div className="mt-4">
                    <RadioGroup
                      name="application-resume"
                      value={selectedResumeId}
                      onChange={setSelectedResumeId}
                      options={resumes.map((resume) => ({
                        value: resume.id,
                        label: `${resume.title}${resume.isPrimary ? ' — Primary' : ''}`,
                      }))}
                    />
                  </div>
                  <div className="mt-5">
                    <Link to={`${basePath}/resume`} className="text-sm font-medium text-primary">
                      Manage resumes
                    </Link>
                  </div>
                </Card>

                {selectedResume ? (
                  <Card>
                    <h2 className="po-section-title">Review selected resume</h2>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="po-helper">Resume title</dt>
                        <dd className="font-medium text-ink">{selectedResume.title}</dd>
                      </div>
                      <div>
                        <dt className="po-helper">Name on resume</dt>
                        <dd className="font-medium text-ink">{selectedResume.fullName}</dd>
                      </div>
                      <div>
                        <dt className="po-helper">Updated</dt>
                        <dd className="font-medium text-ink">{formatResumeUpdatedAt(selectedResume.updatedAt)}</dd>
                      </div>
                      <div>
                        <dt className="po-helper">Sections</dt>
                        <dd className="font-medium text-ink">
                          {selectedResume.educationCount} education · {selectedResume.experienceCount} experience · {selectedResume.skillCount} skills
                        </dd>
                      </div>
                    </dl>
                    <p className="po-helper mt-4">
                      Applying for {job.title} at {job.company.companyName}.
                    </p>
                    {submitError ? <p className="po-helper po-helper-error mt-4" role="alert">{submitError}</p> : null}
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button type="submit" disabled={submitting || !selectedResumeId}>
                        {submitting ? 'Submitting…' : 'Submit application'}
                      </Button>
                      <Button type="button" variant="secondary" to={jobPath}>
                        Cancel
                      </Button>
                    </div>
                  </Card>
                ) : null}
              </form>
            )}
          </div>
        ) : null}
      </QueryStatus>
    </PageContent>
  )
}

export default ApplyPage
