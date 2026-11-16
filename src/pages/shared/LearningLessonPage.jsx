import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import {
  completeOwnLesson,
  fetchOwnLesson,
  fetchPublishedCourse,
  learningAssessmentPath,
  learningCoursePath,
  learningLessonPath,
  neighboringLessons,
  parseLessonBody,
  userFacingLearningError,
} from '../../api/learning.js'

function LearningLessonPage({ basePath }) {
  const { contentId, lessonId } = useParams()
  return <LearningLessonView key={lessonId} basePath={basePath} contentId={contentId} lessonId={lessonId} />
}

function LearningLessonView({ basePath, contentId, lessonId }) {
  const [coursePayload, setCoursePayload] = useState(null)
  const [lessonPayload, setLessonPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  function load() {
    setLoading(true)
    setError('')
    Promise.all([fetchPublishedCourse(contentId), fetchOwnLesson(lessonId)])
      .then(([course, lesson]) => {
        setCoursePayload(course)
        setLessonPayload(lesson)
      })
      .catch((loadError) => {
        setCoursePayload(null)
        setLessonPayload(null)
        setError(userFacingLearningError(loadError))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [contentId, lessonId])

  const lesson = lessonPayload?.lesson
  const lessons = coursePayload?.lessons ?? []
  const assessments = coursePayload?.assessments ?? []
  const neighbors = neighboringLessons(lessons, lessonId)
  const sections = parseLessonBody(lesson?.body)
  const coursePath = learningCoursePath(basePath, contentId)

  async function markComplete() {
    if (!lesson) {
      return
    }
    setWorking(true)
    try {
      const result = await completeOwnLesson(lesson.id)
      if (result.courseCompleted) {
        showToast(
          result.skillsAwarded
            ? 'Course complete. Matching skills were added or updated on your profile.'
            : 'Course complete.',
        )
      } else {
        showToast('Lesson marked complete.')
      }
      const [course, nextLesson] = await Promise.all([
        fetchPublishedCourse(contentId),
        fetchOwnLesson(lesson.id),
      ])
      setCoursePayload(course)
      setLessonPayload(nextLesson)
    } catch (completeError) {
      setError(userFacingLearningError(completeError))
    } finally {
      setWorking(false)
    }
  }

  return (
    <PageContent>
      <Link to={coursePath} className="text-sm font-medium text-primary">
        Back to course
      </Link>
      <QueryStatus
        loading={loading}
        error={error}
        empty={!loading && !error && !lesson}
        loadingLabel="Loading lesson…"
        emptyTitle="This lesson could not be opened."
        emptyDescription="Enrol in the course first, then open lessons from the course page."
        emptyAction={<Button variant="secondary" to={coursePath}>View Course</Button>}
        onRetry={load}
      >
        {lesson ? (
          <div className="mt-5 space-y-6">
            <Card>
              <p className="po-helper">{lesson.courseTitle}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {lesson.completed ? (
                  <Badge status="success" className="normal-case">Completed</Badge>
                ) : (
                  <Badge className="normal-case">In this lesson</Badge>
                )}
                <Badge className="normal-case">{lesson.estimatedMinutes} minutes</Badge>
                {neighbors.index >= 0 ? (
                  <Badge className="normal-case">
                    Lesson {neighbors.index + 1} of {lessons.length}
                  </Badge>
                ) : null}
              </div>
              <h1 className="po-page-title mt-4">{lesson.title}</h1>
            </Card>

            {sections.length === 0 ? (
              <Card>
                <p className="po-secondary whitespace-pre-wrap">{lesson.body}</p>
              </Card>
            ) : (
              sections.map((section) => (
                <Card key={section.title}>
                  <h2 className="po-section-title">{section.title}</h2>
                  <div className="po-secondary mt-4 whitespace-pre-wrap">{section.text}</div>
                </Card>
              ))
            )}

            <Card>
              <div className="flex flex-wrap gap-2">
                {lesson.completed ? (
                  <Badge status="success" className="normal-case">Already completed</Badge>
                ) : (
                  <Button onClick={markComplete} disabled={working}>
                    {working ? 'Saving…' : 'Mark as Complete'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  disabled={!neighbors.previous}
                  to={neighbors.previous ? learningLessonPath(basePath, contentId, neighbors.previous.id) : undefined}
                >
                  Previous
                </Button>
                <Button
                  disabled={!neighbors.next}
                  to={neighbors.next ? learningLessonPath(basePath, contentId, neighbors.next.id) : undefined}
                >
                  Next Lesson
                </Button>
                {!neighbors.next && assessments[0] ? (
                  <Button variant="secondary" to={learningAssessmentPath(basePath, contentId, assessments[0].id)}>
                    Assessment
                  </Button>
                ) : null}
              </div>
              <p className="po-helper mt-4">
                Completion is saved in PostgreSQL. Refreshing or signing in again keeps this lesson state. Completing a lesson does not award UserSkills by itself.
              </p>
            </Card>
          </div>
        ) : null}
      </QueryStatus>
      <Toast message={toast} />
    </PageContent>
  )
}

export default LearningLessonPage
