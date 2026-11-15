import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import JobSkillMatchPanel from '../../components/jobs/JobSkillMatchPanel.jsx'
import {
  candidateJobsPath,
  fetchPublishedJob,
  formatEmploymentType,
  formatJobDate,
  formatSalaryRange,
  isAbortError,
  isJobId,
  userFacingPublishedJobError,
} from '../../api/jobs.js'
import {
  candidateApplicationPath,
  candidateApplyPath,
  fetchMyApplicationForJob,
  formatApplicationStatus,
} from '../../api/applications.js'
import { useRecordedSkills } from '../../hooks/useRecordedSkills.js'

function CandidateJobDetailPage({ basePath }) {
  const { jobId } = useParams()
  return <CandidateJobDetailView key={jobId} basePath={basePath} jobId={jobId} />
}

function CandidateJobDetailView({ basePath, jobId }) {
  const validId = isJobId(jobId)
  const jobsPath = candidateJobsPath(basePath)
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(validId)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(!validId)
  const [retryNonce, setRetryNonce] = useState(0)
  const [existingApplication, setExistingApplication] = useState(null)
  const recordedSkills = useRecordedSkills({ enabled: validId })

  useEffect(() => {
    if (!validId) {
      return undefined
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setNotFound(false)
    setExistingApplication(null)
    Promise.all([
      fetchPublishedJob(jobId, { signal: controller.signal }),
      fetchMyApplicationForJob(jobId, { signal: controller.signal }).catch((applicationError) => {
        if (applicationError.status === 404) {
          return null
        }
        throw applicationError
      }),
    ])
      .then(([next, application]) => {
        if (!controller.signal.aborted) {
          setJob(next)
          setExistingApplication(application)
        }
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setJob(null)
        setExistingApplication(null)
        if (loadError.status === 404) {
          setNotFound(true)
          return
        }
        setError(userFacingPublishedJobError(loadError))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [jobId, retryNonce, validId])

  if (notFound) {
    return (
      <PageContent title="Job unavailable">
        <Card>
          <p className="po-body">This job is not available.</p>
          <p className="po-secondary mt-2">
            Draft, closed, suspended and expired vacancies are not listed for students and job seekers.
          </p>
          <div className="mt-5">
            <Button to={jobsPath}>Back to Jobs</Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent
      title={job?.title || 'Job details'}
      description="Review the published vacancy details returned by PeaceOne."
      actions={
        <Button variant="secondary" to={jobsPath}>
          Back to Jobs
        </Button>
      }
    >
      <QueryStatus
        loading={loading}
        error={error}
        loadingLabel="Loading job details…"
        onRetry={() => setRetryNonce((current) => current + 1)}
      >
        {job ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]">
            <div className="space-y-6">
              <Card>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="primary">{formatEmploymentType(job.employmentType)}</Badge>
                </div>
                <h1 className="po-page-title mt-4">{job.title}</h1>
                <p className="po-secondary mt-2">
                  {job.company.companyName}
                  {job.company.industry ? ` · ${job.company.industry}` : ''}
                </p>
                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Location" value={job.location} />
                  <DetailItem label="Employment type" value={formatEmploymentType(job.employmentType)} />
                  <DetailItem label="Salary range" value={formatSalaryRange(job)} />
                  <DetailItem label="Published" value={formatJobDate(job.publishedAt)} />
                  <DetailItem label="Closing date" value={formatJobDate(job.closesAt)} />
                </dl>
              </Card>

              <Card>
                <h2 className="po-section-title">Job Description</h2>
                <p className="po-body mt-4 whitespace-pre-wrap">{job.description}</p>
              </Card>

              <Card>
                <h2 className="po-section-title">Qualifications</h2>
                <p className="po-body mt-4 whitespace-pre-wrap">{job.qualificationRequired}</p>
              </Card>

              <Card>
                <h2 className="po-section-title">Experience required</h2>
                <p className="po-body mt-4 whitespace-pre-wrap">{job.experienceRequired}</p>
              </Card>

              <Card>
                <h2 className="po-section-title">Required ESCO skills</h2>
                <div className="mt-5">
                  {job.requiredSkills.length === 0 ? (
                    <p className="po-helper mt-0">No ESCO skills have been recorded for this vacancy.</p>
                  ) : (
                    <Table
                      minWidthClass="min-w-[520px]"
                      headers={['Skill', 'Required proficiency']}
                      rows={job.requiredSkills.map((skill) => [
                        skill.skill.preferredLabel,
                        skill.requiredLevel,
                      ])}
                    />
                  )}
                </div>
              </Card>

              <JobSkillMatchPanel
                job={job}
                skills={recordedSkills.items}
                skillsLoading={recordedSkills.loading}
                skillsError={recordedSkills.error}
                onRetrySkills={recordedSkills.retry}
                basePath={basePath}
              />
            </div>

            <div className="space-y-6">
              <Card>
                <h2 className="po-section-title">Company</h2>
                <p className="mt-3 text-lg font-semibold text-ink">{job.company.companyName}</p>
                <dl className="mt-4 grid gap-4">
                  <DetailItem label="Industry" value={job.company.industry || '—'} />
                  <DetailItem label="Location" value={job.company.location || '—'} />
                  <DetailItem label="Website" value={job.company.website || '—'} />
                </dl>
                {job.company.description ? (
                  <p className="po-body mt-4 whitespace-pre-wrap">{job.company.description}</p>
                ) : (
                  <p className="po-helper mt-4">No company description has been published.</p>
                )}
              </Card>

              <Card>
                <h2 className="po-section-title">Applications</h2>
                {existingApplication ? (
                  <>
                    <p className="po-secondary mt-2">
                      Already Applied · {formatApplicationStatus(existingApplication.status)}
                    </p>
                    <p className="po-helper mt-2">
                      Withdrawal does not allow a second application for this job.
                    </p>
                    <div className="mt-5">
                      <Button to={candidateApplicationPath(basePath, existingApplication.id)}>
                        View application
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="po-secondary mt-2">
                      Submit a saved resume. PeaceOne stores an independent copy with the application.
                    </p>
                    <div className="mt-5">
                      <Button to={candidateApplyPath(basePath, job.id)}>Apply Now</Button>
                    </div>
                  </>
                )}
                <div className="mt-4">
                  <Link to={jobsPath} className="text-sm font-medium text-primary">
                    Back to job search
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </QueryStatus>
    </PageContent>
  )
}

export default CandidateJobDetailPage
