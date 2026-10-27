import { Link } from 'react-router-dom'
import Card from './Card.jsx'
import Badge from '../common/Badge.jsx'
import Button from '../common/Button.jsx'

function JobCard({ job, to, actions }) {
  const destination = to || (job.id ? `/jobs/${job.id}` : undefined)

  const body = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="po-card-title">{job.title || job.jobTitle}</h3>
          <p className="po-secondary mt-1">{job.company}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge tone="primary">{job.employmentType}</Badge>
          {typeof job.match === 'number' ? (
            <Badge tone={job.match >= 80 ? 'success' : 'primary'}>{job.match}% Match</Badge>
          ) : job.careerFit ? (
            <Badge tone="primary" className="normal-case">
              {job.careerFit}
            </Badge>
          ) : null}
        </div>
      </div>
      <p className="po-secondary mt-3">
        {job.location}
        {job.salary ? ` · ${job.salary}` : ''}
        {job.posted ? ` · ${job.posted}` : ''}
      </p>
      {job.description ? <p className="po-body mt-3">{job.description}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {job.skills.map((skill) => (
          <Badge key={skill} tone="default">
            {skill}
          </Badge>
        ))}
      </div>
    </>
  )

  if (actions?.length) {
    return (
      <Card className="h-full">
        {body}
        <div className="mt-5 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={action.label} to={action.to} variant={action.variant || 'primary'} size="sm">
              {action.label}
            </Button>
          ))}
        </div>
      </Card>
    )
  }

  if (!destination) {
    return <Card className="h-full">{body}</Card>
  }

  return (
    <Link to={destination} className="block no-underline">
      <Card hoverable className="h-full">
        {body}
      </Card>
    </Link>
  )
}

export default JobCard
