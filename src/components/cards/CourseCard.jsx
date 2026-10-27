import { Link } from 'react-router-dom'
import Card from './Card.jsx'
import Badge from '../common/Badge.jsx'
import Button from '../common/Button.jsx'
import MediaImage from '../common/MediaImage.jsx'

function CourseCard({ course, to, actions }) {
  const body = (
    <div className="p-5">
      <div className="flex flex-wrap gap-2">
        {course.category ? <Badge tone="primary">{course.category}</Badge> : null}
        {course.contentType ? <Badge tone="primary">{course.contentType}</Badge> : null}
        {course.difficulty ? <Badge tone="default">{course.difficulty}</Badge> : null}
        {course.skill ? <Badge tone="default">{course.skill}</Badge> : null}
      </div>
      <h3 className="po-card-title mt-3">{course.title}</h3>
      {course.duration ? <p className="po-helper mt-1">{course.duration}</p> : null}
      {course.description ? <p className="po-secondary mt-2">{course.description}</p> : null}
      {course.reason ? <p className="po-secondary mt-3">{course.reason}</p> : null}
      {course.progressLabel ? (
        <p className="mt-3 text-sm font-medium text-primary">{course.progressLabel}</p>
      ) : null}
      {actions?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={action.label} to={action.to} variant={action.variant || 'primary'} size="sm">
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )

  return (
    <Card padding="none" className="h-full overflow-hidden">
      <MediaImage src={course.image} alt={course.imageAlt} aspect="16/9" rounded={false} />
      {to && !actions?.length ? (
        <Link to={to} className="block no-underline">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  )
}

export default CourseCard
