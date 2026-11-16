import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Card from '../../components/cards/Card.jsx'
import { useAuth } from '../../auth/useAuth.js'
import {
  fetchPublishedCourse,
  formatCategory,
  formatDifficulty,
  learningCoursePath,
  userFacingLearningError,
} from '../../api/learning.js'

function candidateBasePath(role) {
  if (role === 'STUDENT') return '/student'
  if (role === 'JOB_SEEKER') return '/jobseeker'
  return null
}

function CourseDetail() {
  const { contentId } = useParams()
  const { user } = useAuth()
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    fetchPublishedCourse(contentId)
      .then((next) => setPayload(next))
      .catch((loadError) => {
        setPayload(null)
        setError(userFacingLearningError(loadError) || 'This course could not be found.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId])

  const course = payload?.course
  const workspace = candidateBasePath(user?.role)

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <Link to="/learning" className="text-sm font-medium text-primary">
        Back to Learning
      </Link>
      <div className="mt-6">
        <QueryStatus
          loading={loading}
          error={error}
          empty={!loading && !error && !course}
          loadingLabel="Loading course…"
          emptyTitle="Course not found"
          emptyDescription="This course is unpublished, archived, or does not exist."
          emptyAction={<Button to="/learning">Back to Learning</Button>}
          onRetry={load}
        >
          {course ? (
            <Card>
              <div className="flex flex-wrap gap-2">
                <Badge tone="primary">{formatCategory(course.category)}</Badge>
                <Badge>{formatDifficulty(course.difficulty)}</Badge>
              </div>
              <h1 className="po-page-title mt-4">{course.title}</h1>
              <p className="po-helper mt-2">{course.estimatedMinutes} minutes · {course.lessonCount} lessons</p>
              <p className="po-body mt-6">{course.description}</p>
              <p className="po-helper mt-4">
                Original PeaceOne demonstration content. Not an external certificate. Enrolment and quizzes require a student or job-seeker account.
              </p>
              <h2 className="po-section-title mt-8">Learning objectives</h2>
              <ul className="po-secondary mt-3 list-disc space-y-1 pl-5">
                {(course.objectives ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h2 className="po-section-title mt-8">Lessons</h2>
              <ol className="po-secondary mt-3 list-decimal space-y-1 pl-5">
                {(payload.lessons ?? []).map((lesson) => (
                  <li key={lesson.id}>
                    {lesson.title} ({lesson.estimatedMinutes} min)
                  </li>
                ))}
              </ol>
              <h2 className="po-section-title mt-8">Related ESCO skills</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(course.skills ?? []).map((item) => (
                  <Badge key={item.skillId} tone="default">
                    {item.skill.preferredLabel}
                  </Badge>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                {workspace ? (
                  <Button to={learningCoursePath(workspace, course.id)}>
                    {course.enrollmentStatus ? 'Continue in workspace' : 'Enrol in workspace'}
                  </Button>
                ) : (
                  <>
                    <Button to="/login" state={{ from: `/learning/${course.id}` }}>
                      Sign in to enrol
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

export default CourseDetail
