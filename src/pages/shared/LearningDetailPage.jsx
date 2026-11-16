import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import ProgressBar from '../../components/common/ProgressBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import {
  courseActionLabel,
  enrollInCourse,
  enrollmentTone,
  fetchPublishedCourse,
  formatCategory,
  formatDifficulty,
  formatEnrollmentStatus,
  learningAssessmentPath,
  learningLessonPath,
  nextIncompleteLesson,
  userFacingLearningError,
} from '../../api/learning.js'

function LearningDetailPage({ basePath }) {
  const { contentId } = useParams()
  return <LearningDetailView key={contentId} basePath={basePath} contentId={contentId} />
}

function LearningDetailView({ basePath, contentId }) {
  const navigate = useNavigate()
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  function loadCourse() {
    setLoading(true)
    setError('')
    fetchPublishedCourse(contentId)
      .then((next) => setPayload(next))
      .catch((loadError) => {
        setPayload(null)
        setError(userFacingLearningError(loadError))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCourse()
  }, [contentId])

  const course = payload?.course
  const lessons = payload?.lessons ?? []
  const assessments = payload?.assessments ?? []
  const enrolled = Boolean(course?.enrollmentStatus)
  const resumeLesson = nextIncompleteLesson(lessons)

  async function handleEnroll() {
    setWorking(true)
    try {
      await enrollInCourse(contentId)
      showToast('Enrolled. Progress will be saved to your account.')
      loadCourse()
    } catch (enrollError) {
      setError(userFacingLearningError(enrollError))
    } finally {
      setWorking(false)
    }
  }

  function handlePrimaryAction() {
    if (!course?.enrollmentStatus) {
      void handleEnroll()
      return
    }
    if (resumeLesson) {
      navigate(learningLessonPath(basePath, contentId, resumeLesson.id))
    }
  }

  const primaryLabel = course?.enrollmentStatus
    ? courseActionLabel(course.enrollmentStatus)
    : 'Enrol'

  return (
    <PageContent>
      <Link to={`${basePath}/learning`} className="text-sm font-medium text-primary">
        Back to Learning
      </Link>
      <QueryStatus
        loading={loading}
        error={error}
        empty={!loading && !error && !course}
        loadingLabel="Loading course…"
        emptyTitle="This course could not be found."
        emptyDescription="It may be unpublished. Return to the catalogue to pick another PeaceOne course."
        onRetry={loadCourse}
      >
        {course ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <Card>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="primary" className="normal-case">{formatCategory(course.category)}</Badge>
                  <Badge className="normal-case">{formatDifficulty(course.difficulty)}</Badge>
                  <Badge status={enrollmentTone(course.enrollmentStatus)} className="normal-case">
                    {formatEnrollmentStatus(course.enrollmentStatus)}
                  </Badge>
                </div>
                <h1 className="po-page-title mt-4">{course.title}</h1>
                <p className="po-secondary mt-3">{course.description}</p>
                <p className="po-helper mt-4">
                  {course.lessonCount} lessons · {course.estimatedMinutes} minutes. Original PeaceOne demonstration content. Not an external certificate.
                </p>
                {enrolled ? (
                  <div className="mt-6">
                    <p className="po-helper mb-2">
                      Progress {course.progressPercent}% ({course.completedLessonCount} of {course.lessonCount} lessons)
                    </p>
                    <ProgressBar value={course.progressPercent ?? 0} />
                  </div>
                ) : null}
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button onClick={handlePrimaryAction} disabled={working || (enrolled && !resumeLesson)}>
                    {working ? 'Saving…' : primaryLabel === 'Review Course' ? 'Review Course' : primaryLabel}
                  </Button>
                  {course.enrollmentStatus === 'COMPLETED' && resumeLesson ? (
                    <Button
                      variant="secondary"
                      to={learningLessonPath(basePath, contentId, lessons[0]?.id)}
                    >
                      Review first lesson
                    </Button>
                  ) : null}
                </div>
              </Card>

              <Card>
                <h2 className="po-section-title">Learning objectives</h2>
                <ul className="po-secondary mt-3 list-disc space-y-1 pl-5">
                  {(course.objectives ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>

              {course.enrollmentStatus === 'COMPLETED' ? (
                <Card>
                  <h2 className="po-section-title">Course completion</h2>
                  <p className="po-secondary mt-3">
                    This enrolment is marked complete in PostgreSQL. Matching ESCO skills are awarded only by the existing completion rules, not by enrolment alone. Completing a PeaceOne course is not professional certification.
                  </p>
                </Card>
              ) : null}
            </div>

            <div className="space-y-6">
              <Card>
                <h2 className="po-section-title">Lessons</h2>
                <ol className="mt-4 space-y-3">
                  {lessons.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{item.sortOrder}. {item.title}</p>
                        <p className="po-helper">{item.estimatedMinutes} min{item.completed ? ' · completed' : ''}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!enrolled}
                        to={enrolled ? learningLessonPath(basePath, contentId, item.id) : undefined}
                      >
                        Open
                      </Button>
                    </li>
                  ))}
                </ol>
                {!enrolled ? (
                  <p className="po-helper mt-4">Enrol to open lessons. Lesson order follows the course list; the API does not block later lessons.</p>
                ) : null}
              </Card>
              <Card>
                <h2 className="po-section-title">Assessment</h2>
                {assessments.length === 0 ? (
                  <p className="po-secondary mt-2">No quiz is attached to this course.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {assessments.map((assessment) => (
                      <li key={assessment.id} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink">{assessment.title}</p>
                          <p className="po-helper">
                            {assessment.questionCount} questions · pass {assessment.passingScore}%
                            {assessment.bestScore != null ? ` · best ${assessment.bestScore}%` : ''}
                            {assessment.passed ? ' · passed' : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={!enrolled}
                          to={enrolled ? learningAssessmentPath(basePath, contentId, assessment.id) : undefined}
                        >
                          {assessment.passed ? 'Review quiz' : 'Take quiz'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <h2 className="po-section-title">Related ESCO skills</h2>
                <ul className="po-secondary mt-3 list-disc space-y-1 pl-5">
                  {(course.skills ?? []).map((item) => (
                    <li key={item.skillId}>
                      {item.skill.preferredLabel} (target {item.targetProficiency})
                      <span className="mt-1 block break-all po-helper">{item.skill.sourceUri}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        ) : null}
      </QueryStatus>
      <Toast message={toast} />
    </PageContent>
  )
}

export default LearningDetailPage
