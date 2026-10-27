import Button from '../../../components/common/Button.jsx'
import JobCard from '../../../components/cards/JobCard.jsx'
import Section from '../../../components/layout/Section.jsx'
import { jobs } from '../../../data/jobs.js'

function FeaturedJobsSection() {
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
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {jobs.slice(0, 4).map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </Section>
  )
}

export default FeaturedJobsSection
