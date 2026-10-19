import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/cards/Card.jsx'
import { jobs } from '../../data/jobs.js'

function JobDetail() {
  const { id } = useParams()
  const job = jobs.find((item) => item.id === id)

  if (!job) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h1 className="po-page-title">Role not found</h1>
        <p className="po-secondary mt-3">This job posting could not be found.</p>
        <div className="mt-8 flex justify-center">
          <Button to="/jobs">Back to Jobs</Button>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <Link to="/jobs" className="text-sm font-medium text-primary">
        Back to Jobs
      </Link>
      <Card className="mt-6">
        <Badge tone="primary">{job.employmentType}</Badge>
        <h1 className="po-page-title mt-3">{job.title}</h1>
        <p className="po-secondary mt-2">
          {job.company} · {job.location} · {job.experienceLevel} · {job.posted}
        </p>
        <p className="po-body mt-6">{job.description}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {job.skills.map((skill) => (
            <Badge key={skill} tone="default">
              {skill}
            </Badge>
          ))}
        </div>
        <p className="po-helper mt-8">
          Application tools will be added in a later logged-in Job Seeker stage.
        </p>
      </Card>
    </section>
  )
}

export default JobDetail
