import { useEffect, useState } from 'react'
import Button from '../../../components/common/Button.jsx'
import JobCard from '../../../components/cards/JobCard.jsx'
import QueryStatus from '../../../components/common/QueryStatus.jsx'
import Section from '../../../components/layout/Section.jsx'
import { fetchPublishedJobs, toPublicJobCard, userFacingPublishedJobError } from '../../../api/jobs.js'

function FeaturedJobsSection() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    fetchPublishedJobs({ page: 1, limit: 4 })
      .then((payload) => setJobs(payload.items ?? []))
      .catch((loadError) => {
        setJobs([])
        setError(userFacingPublishedJobError(loadError))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <Section className="bg-surface">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="po-secondary">Opportunities</p>
          <h2 className="po-page-title mt-2">Explore roles that match a growing skill profile</h2>
        </div>
        <Button to="/jobs" variant="secondary" className="shrink-0">
          View All Jobs
        </Button>
      </div>
      <div className="mt-10">
        <QueryStatus
          loading={loading}
          error={error}
          empty={!loading && !error && jobs.length === 0}
          loadingLabel="Loading published jobs…"
          emptyTitle="No published jobs yet."
          emptyDescription="When employers publish vacancies, they will appear here and on the Jobs page."
          onRetry={load}
        >
          <div className="grid gap-5 md:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={toPublicJobCard(job)} to={`/jobs/${job.id}`} />
            ))}
          </div>
        </QueryStatus>
      </div>
    </Section>
  )
}

export default FeaturedJobsSection
