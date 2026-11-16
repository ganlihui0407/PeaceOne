import { useEffect, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import ProgressBar from '../../components/common/ProgressBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import {
  courseActionLabel,
  enrollmentTone,
  fetchLearningHistory,
  formatEnrollmentStatus,
  learningCoursePath,
  userFacingLearningError,
} from '../../api/learning.js'

function EnrollmentCard({ item, basePath }) {
  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="po-card-title">{item.course?.title || 'Course'}</h2>
          <p className="po-helper mt-1">
            {item.completedLessonCount} of {item.lessonCount} lessons complete ({item.progressPercent}%)
          </p>
          <div className="mt-3 max-w-xl">
            <ProgressBar value={item.progressPercent} />
          </div>
          <dl className="po-secondary mt-4 grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="po-helper">Final status</dt>
              <dd>
                <Badge status={enrollmentTone(item.status)} className="normal-case">
                  {formatEnrollmentStatus(item.status)}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="po-helper">Enrolled</dt>
              <dd className="font-medium text-ink">{new Date(item.enrolledAt).toLocaleString()}</dd>
            </div>
            {item.completedAt ? (
              <div>
                <dt className="po-helper">Completed</dt>
                <dd className="font-medium text-ink">{new Date(item.completedAt).toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <Button to={learningCoursePath(basePath, item.contentId)} size="sm" className="shrink-0">
          {courseActionLabel(item.status)}
        </Button>
      </div>
    </Card>
  )
}

function LearningProgressPage({ basePath }) {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    fetchLearningHistory()
      .then((next) => setPayload(next))
      .catch((loadError) => {
        setPayload(null)
        setError(userFacingLearningError(loadError))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const enrollments = payload?.enrollments ?? []
  const attempts = payload?.attempts ?? []
  const inProgress = enrollments.filter((item) => item.status === 'IN_PROGRESS')
  const enrolledOnly = enrollments.filter((item) => item.status === 'ENROLLED')
  const completed = enrollments.filter((item) => item.status === 'COMPLETED')
  const completedLessons = enrollments.reduce((sum, item) => sum + (item.completedLessonCount ?? 0), 0)

  return (
    <PageContent
      title="Learning Progress"
      description="Enrolments, lesson completion and quiz attempts are stored in PostgreSQL. Percentages are completed lessons divided by total lessons."
      actions={
        <Button variant="secondary" to={`${basePath}/learning`}>
          Browse courses
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Enrolled courses" value={String(enrollments.length)} />
        <StatCard label="In progress" value={String(inProgress.length)} />
        <StatCard label="Completed courses" value={String(completed.length)} />
        <StatCard label="Quiz attempts" value={String(attempts.length)} />
      </div>
      <p className="po-helper mt-4">{completedLessons} lessons marked complete across these enrolments.</p>

      <div className="mt-8">
        <QueryStatus
          loading={loading}
          error={error}
          empty={!loading && !error && enrollments.length === 0}
          loadingLabel="Loading enrolments…"
          emptyTitle="You have not enrolled in a course yet."
          emptyDescription="Open a published PeaceOne course and enrol to start tracking lessons and quizzes."
          emptyAction={
            <Button variant="secondary" to={`${basePath}/learning`}>
              Browse courses
            </Button>
          }
          onRetry={load}
        >
          <div className="space-y-10">
            <section>
              <SectionHeader title="In-progress courses" description="Lessons have been started and the enrolment is not complete." />
              {inProgress.length === 0 ? (
                <p className="po-secondary">No in-progress courses.</p>
              ) : (
                <div className="space-y-4">
                  {inProgress.map((item) => (
                    <EnrollmentCard key={item.id} item={item} basePath={basePath} />
                  ))}
                </div>
              )}
            </section>
            <section>
              <SectionHeader title="Enrolled courses" description="Enrolled with no completed lessons yet." />
              {enrolledOnly.length === 0 ? (
                <p className="po-secondary">No newly enrolled courses waiting to start.</p>
              ) : (
                <div className="space-y-4">
                  {enrolledOnly.map((item) => (
                    <EnrollmentCard key={item.id} item={item} basePath={basePath} />
                  ))}
                </div>
              )}
            </section>
            <section>
              <SectionHeader title="Completed courses" description="All lessons complete and required assessments passed." />
              {completed.length === 0 ? (
                <p className="po-secondary">No completed courses yet.</p>
              ) : (
                <div className="space-y-4">
                  {completed.map((item) => (
                    <EnrollmentCard key={item.id} item={item} basePath={basePath} />
                  ))}
                </div>
              )}
            </section>
            <section>
              <SectionHeader title="Quiz attempts" description="Scores come from the assessment API. The browser does not grade the final result." />
              {attempts.length === 0 ? (
                <p className="po-secondary">No quiz attempts yet.</p>
              ) : (
                <Card>
                  <ul className="space-y-3">
                    {attempts.map((attempt) => (
                      <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-ink">{attempt.title}</p>
                          <p className="po-helper">{new Date(attempt.createdAt).toLocaleString()}</p>
                        </div>
                        <Badge status={attempt.passed ? 'success' : 'default'} className="normal-case">
                          {attempt.score}% · {attempt.passed ? 'passed' : 'not passed'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </section>
          </div>
        </QueryStatus>
      </div>
    </PageContent>
  )
}

export default LearningProgressPage
