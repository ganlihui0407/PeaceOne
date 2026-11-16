import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Card from '../../components/cards/Card.jsx'
import { useAuth } from '../../auth/useAuth.js'
import { candidateApplyPath } from '../../api/applications.js'
import {
  candidateJobPath,
  fetchPublishedJob,
  formatEmploymentType,
  formatJobDate,
  formatSalaryRange,
  isJobId,
  jobNarrativeSections,
  userFacingPublishedJobError,
} from '../../api/jobs.js'

function candidateBasePath(role) {
  if (role === 'STUDENT') return '/student'
  if (role === 'JOB_SEEKER') return '/jobseeker'
  return null
}

function JobDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const validId = isJobId(id)
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(validId)
  const [error, setError] = useState('')

  function load() {
    if (!validId) {
      setJob(null)
      setLoading(false)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    fetchPublishedJob(id)
      .then((next) => setJob(next))
      .catch((loadError) => {
        setJob(null)
        setError(userFacingPublishedJobError(loadError) || 'This job posting could not be found.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const workspace = candidateBasePath(user?.role)
  const narrative = job ? jobNarrativeSections(job.description) : { overview: '', responsibilities: '' }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <Link to="/jobs" className="text-sm font-medium text-primary">
        Back to Jobs
      </Link>
      <div className="mt-6">
        <QueryStatus
          loading={loading}
          error={error}
          empty={!loading && !error && !job}
          loadingLabel="Loading job…"
          emptyTitle="Role not found"
          emptyDescription="This job is unpublished, closed, suspended, or does not exist."
          emptyAction={<Button to="/jobs">Back to Jobs</Button>}
          onRetry={validId ? load : undefined}
        >
          {job ? (
            <Card>
              <Badge tone="primary">{formatEmploymentType(job.employmentType)}</Badge>
              <h1 className="po-page-title mt-3">{job.title}</h1>
              <p className="po-secondary mt-2">
                {job.company.companyName}
                {job.company.industry ? ` · ${job.company.industry}` : ''}
                {` · ${job.location}`}
              </p>
              <dl className="po-secondary mt-6 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="po-helper">Salary</dt>
                  <dd className="font-medium text-ink">{formatSalaryRange(job)}</dd>
                </div>
                <div>
                  <dt className="po-helper">Published</dt>
                  <dd className="font-medium text-ink">{formatJobDate(job.publishedAt)}</dd>
                </div>
                <div>
                  <dt className="po-helper">Closes</dt>
                  <dd className="font-medium text-ink">{formatJobDate(job.closesAt)}</dd>
                </div>
                <div>
                  <dt className="po-helper">Experience</dt>
                  <dd className="font-medium text-ink">{job.experienceRequired}</dd>
                </div>
              </dl>
              <h2 className="po-section-title mt-8">Description</h2>
              <p className="po-body mt-2 whitespace-pre-wrap">{narrative.overview}</p>
              {narrative.responsibilities ? (
                <>
                  <h2 className="po-section-title mt-8">Responsibilities</h2>
                  <p className="po-body mt-2 whitespace-pre-wrap">{narrative.responsibilities}</p>
                </>
              ) : null}
              <h2 className="po-section-title mt-8">Qualifications</h2>
              <p className="po-secondary mt-2 whitespace-pre-wrap">{job.qualificationRequired}</p>
              <h2 className="po-section-title mt-8">Required skills</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(job.requiredSkills ?? []).map((item) => (
                  <Badge key={item.skill.id} tone="default">
                    {item.skill.preferredLabel} · {item.requiredLevel}
                  </Badge>
                ))}
              </div>
              {job.company.description ? (
                <>
                  <h2 className="po-section-title mt-8">About {job.company.companyName}</h2>
                  <p className="po-secondary mt-2">{job.company.description}</p>
                </>
              ) : null}
              <div className="mt-8 flex flex-wrap gap-2">
                {workspace ? (
                  <>
                    <Button to={candidateApplyPath(workspace, job.id)}>Apply</Button>
                    <Button variant="secondary" to={candidateJobPath(workspace, job.id)}>
                      Open in workspace
                    </Button>
                  </>
                ) : (
                  <>
                    <Button to="/login" state={{ from: `/jobs/${job.id}` }}>
                      Sign in to apply
                    </Button>
                    <Button variant="secondary" to="/register">
                      Create an account
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ) : null}
        </QueryStatus>
      </div>
    </section>
  )
}

export default JobDetail
