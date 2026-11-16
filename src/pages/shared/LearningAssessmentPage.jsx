import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import ProgressBar from '../../components/common/ProgressBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import RadioGroup from '../../components/forms/RadioGroup.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import {
  fetchOwnAssessment,
  fetchPublishedCourse,
  learningCoursePath,
  submitAssessmentAttempt,
  userFacingLearningError,
} from '../../api/learning.js'

function LearningAssessmentPage({ basePath }) {
  const { contentId, assessmentId } = useParams()
  return (
    <LearningAssessmentView
      key={assessmentId}
      basePath={basePath}
      contentId={contentId}
      assessmentId={assessmentId}
    />
  )
}

function LearningAssessmentView({ basePath, contentId, assessmentId }) {
  const [quiz, setQuiz] = useState(null)
  const [courseTitle, setCourseTitle] = useState('')
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const coursePath = learningCoursePath(basePath, contentId)

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  function load() {
    setLoading(true)
    setError('')
    Promise.all([fetchOwnAssessment(assessmentId), fetchPublishedCourse(contentId)])
      .then(([nextQuiz, coursePayload]) => {
        setQuiz(nextQuiz)
        setCourseTitle(coursePayload.course?.title || nextQuiz.assessment.courseTitle)
        if (!result) {
          setAnswers({})
          setIndex(0)
        }
      })
      .catch((loadError) => {
        setQuiz(null)
        setError(userFacingLearningError(loadError))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [assessmentId, contentId])

  const questions = quiz?.assessment?.questions ?? []
  const current = questions[index]
  const gradedByQuestion = useMemo(() => {
    const map = new Map()
    for (const item of result?.attempt?.answers ?? []) {
      map.set(item.questionId, item)
    }
    return map
  }, [result])

  async function submitQuiz() {
    if (!quiz) {
      return
    }
    const payloadAnswers = questions.map((question) => ({
      questionId: question.id,
      optionId: answers[question.id],
    }))
    if (payloadAnswers.some((item) => !item.optionId)) {
      setError('Answer every question before submitting.')
      return
    }
    setWorking(true)
    setError('')
    try {
      const next = await submitAssessmentAttempt(quiz.assessment.id, payloadAnswers)
      setResult(next)
      showToast(
        next.attempt.passed
          ? `Passed with ${next.attempt.score}%.${next.skillsAwarded ? ' Skills were updated.' : ''}`
          : `Score ${next.attempt.score}%. Pass mark is ${quiz.assessment.passingScore}%.`,
      )
      const refreshed = await fetchOwnAssessment(quiz.assessment.id)
      setQuiz(refreshed)
    } catch (submitError) {
      setError(userFacingLearningError(submitError))
    } finally {
      setWorking(false)
    }
  }

  function startRetry() {
    setResult(null)
    setAnswers({})
    setIndex(0)
    setError('')
  }

  return (
    <PageContent>
      <Link to={coursePath} className="text-sm font-medium text-primary">
        Back to course
      </Link>
      <QueryStatus
        loading={loading}
        error={error && !quiz ? error : ''}
        empty={!loading && !error && !quiz}
        loadingLabel="Loading assessment…"
        emptyTitle="This assessment could not be opened."
        emptyDescription="Enrol in the course first. Correct answers are never sent before you submit."
        emptyAction={<Button variant="secondary" to={coursePath}>View Course</Button>}
        onRetry={load}
      >
        {quiz ? (
          <div className="mt-5 space-y-6">
            <Card>
              <p className="po-helper">{courseTitle}</p>
              <h1 className="po-page-title mt-2">{quiz.assessment.title}</h1>
              <p className="po-helper mt-2">
                {questions.length} questions · pass mark {quiz.assessment.passingScore}%
              </p>
              {quiz.results?.bestScore != null ? (
                <p className="po-secondary mt-2">
                  Best score {quiz.results.bestScore}% {quiz.results.passed ? '(passed)' : '(not yet passed)'}
                </p>
              ) : null}
              {error ? <p className="po-helper po-helper-error mt-3">{error}</p> : null}
            </Card>

            {result?.attempt ? (
              <Card>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={result.attempt.passed ? 'success' : 'warning'} className="normal-case">
                    {result.attempt.passed ? 'Passed' : 'Not passed'}
                  </Badge>
                  <Badge className="normal-case">Score {result.attempt.score}%</Badge>
                </div>
                <h2 className="po-section-title mt-4">
                  {result.attempt.passed ? 'You passed this assessment' : 'This attempt did not meet the pass mark'}
                </h2>
                <div className="mt-4 max-w-md">
                  <ProgressBar value={result.attempt.score} label={`Score ${result.attempt.score} percent`} />
                </div>
                <p className="po-secondary mt-3">
                  This score was calculated by the server. Completing a PeaceOne quiz is not professional certification.
                  {result.courseCompleted
                    ? ' The enrolment is now complete in PostgreSQL.'
                    : ' Finish remaining lessons or a passing score before the course can complete.'}
                </p>
                <div className="mt-6 space-y-4">
                  {questions.map((question, questionIndex) => {
                    const graded = gradedByQuestion.get(question.id)
                    return (
                      <div key={question.id} className="rounded-xl border border-line p-4">
                        <p className="po-card-title">
                          {questionIndex + 1}. {question.prompt}
                        </p>
                        <ul className="mt-3 space-y-1">
                          {question.options.map((option) => (
                            <li
                              key={option.id}
                              className={`po-secondary ${graded?.optionId === option.id ? 'font-medium text-ink' : ''}`}
                            >
                              {option.text}
                              {graded?.optionId === option.id ? ' (your answer)' : ''}
                            </li>
                          ))}
                        </ul>
                        <p className="po-helper mt-3">
                          {graded?.correct ? 'Correct.' : 'Incorrect.'}
                          {graded?.explanation ? ` ${graded.explanation}` : ''}
                        </p>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button onClick={startRetry}>Retry</Button>
                  <Button variant="secondary" to={coursePath}>
                    Review Course
                  </Button>
                </div>
              </Card>
            ) : (
              <Card>
                {current ? (
                  <>
                    <p className="po-helper">
                      Question {index + 1} of {questions.length}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Question navigation">
                      {questions.map((question, questionIndex) => (
                        <Button
                          key={question.id}
                          size="sm"
                          variant={questionIndex === index ? 'primary' : 'secondary'}
                          aria-current={questionIndex === index ? 'step' : undefined}
                          aria-label={`Question ${questionIndex + 1}${answers[question.id] ? ', answered' : ', unanswered'}`}
                          onClick={() => setIndex(questionIndex)}
                        >
                          {questionIndex + 1}
                        </Button>
                      ))}
                    </div>
                    <RadioGroup
                      name={current.id}
                      legend={current.prompt}
                      value={answers[current.id] || ''}
                      onChange={(value) => setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: value }))}
                      options={current.options.map((option) => ({ value: option.id, label: option.text }))}
                    />
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        disabled={index === 0}
                        onClick={() => setIndex((value) => Math.max(0, value - 1))}
                      >
                        Previous
                      </Button>
                      {index < questions.length - 1 ? (
                        <Button onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}>
                          Next question
                        </Button>
                      ) : (
                        <Button onClick={submitQuiz} disabled={working}>
                          {working ? 'Submitting…' : 'Submit assessment'}
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="po-secondary">This assessment has no questions.</p>
                )}
              </Card>
            )}

            {quiz.attempts?.length ? (
              <Card>
                <h2 className="po-section-title">Previous attempts</h2>
                <ul className="po-secondary mt-3 space-y-2">
                  {quiz.attempts.map((attempt) => (
                    <li key={attempt.id}>
                      {new Date(attempt.createdAt).toLocaleString()} · {attempt.score}% · {attempt.passed ? 'passed' : 'not passed'}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        ) : null}
      </QueryStatus>
      <Toast message={toast} />
    </PageContent>
  )
}

export default LearningAssessmentPage
