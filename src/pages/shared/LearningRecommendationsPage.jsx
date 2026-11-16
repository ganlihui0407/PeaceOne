import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import ProgressBar from '../../components/common/ProgressBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'
import { formatRelationType, formatSkillType, isAbortError, relationTone, skillTypeTone } from '../../api/esco.js'
import {
  LEARNING_DISCLAIMER,
  LEARNING_NO_LINKED_SKILLS,
  LEARNING_NO_TARGET,
  SKILL_GAP_DISCLAIMER,
  fetchLearningRecommendations,
  learningCareerTargetPath,
  learningSkillGapPath,
  learningSkillsPath,
  occupationSkillList,
  userFacingLearningError,
} from '../../api/learningRecommendations.js'
import { recordedStatusLabel, recordedStatusTone } from '../../api/skillGap.js'
import {
  LEARNING_CATEGORIES,
  LEARNING_DIFFICULTIES,
  LEARNING_LIST_LIMIT,
  courseActionLabel,
  enrollmentTone,
  fetchCourseRecommendations,
  fetchPublishedCourseCatalog,
  formatCategory,
  formatDifficulty,
  formatEnrollmentStatus,
  learningCoursePath,
  userFacingLearningError as userFacingCourseError,
} from '../../api/learning.js'

function SkillTopicCard({ topic, onFindCourses }) {
  return (
    <Card>
      <div className="flex flex-wrap gap-2">
        <Badge tone={relationTone(topic.relationType)} className="normal-case">
          {formatRelationType(topic.relationType)}
        </Badge>
        <Badge tone={recordedStatusTone(topic.recorded)} className="normal-case">
          {recordedStatusLabel(topic.recorded)}
        </Badge>
        <Badge tone={skillTypeTone(topic.skill.skillType)} className="normal-case">
          {formatSkillType(topic.skill.skillType)}
        </Badge>
      </div>
      <h3 className="po-card-title mt-3">{topic.skill.preferredLabel}</h3>
      <p className="po-helper mt-1">Target occupation: {topic.occupation.preferredLabel}</p>
      <p className="po-secondary mt-1 break-all">{topic.skill.sourceUri}</p>
      <p className="po-secondary mt-3">{topic.rationale}</p>
      <p className="po-helper mt-4">Practical learning goals</p>
      <ul className="po-secondary mt-2 list-disc space-y-1 pl-5">
        {topic.learningGoals.map((goal) => (
          <li key={goal}>{goal}</li>
        ))}
      </ul>
      <div className="mt-5">
        <Button size="sm" onClick={() => onFindCourses(topic)}>
          Find Related Courses
        </Button>
      </div>
    </Card>
  )
}

function CourseCatalogue({ basePath }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const skillId = searchParams.get('skillId') || ''
  const skillLabel = searchParams.get('skillLabel') || ''
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [recommended, setRecommended] = useState(null)
  const extraParams = useMemo(
    () => ({
      ...(category ? { category } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(skillId ? { skillId } : {}),
    }),
    [category, difficulty, skillId],
  )
  const list = useEscoPagedSearch(fetchPublishedCourseCatalog, {
    limit: LEARNING_LIST_LIMIT,
    extraParams,
    formatError: userFacingCourseError,
  })

  useEffect(() => {
    const controller = new AbortController()
    fetchCourseRecommendations({ signal: controller.signal })
      .then(setRecommended)
      .catch(() => setRecommended(null))
    return () => controller.abort()
  }, [])

  function clearSkillFilter() {
    const next = new URLSearchParams(searchParams)
    next.delete('skillId')
    next.delete('skillLabel')
    setSearchParams(next)
  }

  return (
    <section id="peaceone-course-catalogue" className="mt-12 space-y-8 scroll-mt-24">
      <SectionHeader
        title="Published PeaceOne courses"
        description="This PeaceOne course catalogue is separate from the ESCO skill recommendations above. Only published courses with stored LearningContentSkill links are listed. Enrolment and progress are saved to your account."
      />

      {recommended?.courses?.length ? (
        <Card>
          <h3 className="po-section-title">Courses matched to your skill gap</h3>
          <p className="po-secondary mt-2">
            Ranked from published courses that cover ESCO skills linked to your career target and not yet in your recorded list.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recommended.courses.map((course) => (
              <Link
                key={course.id}
                to={learningCoursePath(basePath, course.id)}
                className="block rounded-xl border border-line p-4 no-underline"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge tone="primary" className="normal-case">{formatCategory(course.category)}</Badge>
                  <Badge className="normal-case">{formatDifficulty(course.difficulty)}</Badge>
                </div>
                <h4 className="po-card-title mt-3">{course.title}</h4>
                <p className="po-secondary mt-2">{course.rationale}</p>
                <p className="po-helper mt-2">
                  Skills this course can help record:{' '}
                  {course.matchedSkills.map((item) => item.skill.preferredLabel).join(', ')}
                </p>
                <p className="mt-3 text-sm font-medium text-primary">View Course</p>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <form className="grid gap-4 rounded-xl border border-line bg-surface p-5 md:grid-cols-4" onSubmit={list.search}>
        <SearchInput
          id="search-courses"
          label="Search courses"
          value={list.input}
          onChange={(event) => list.setInput(event.target.value)}
          placeholder="Title or description"
        />
        <SelectInput
          id="course-category"
          label="Category"
          value={category}
          options={LEARNING_CATEGORIES}
          onChange={(event) => setCategory(event.target.value)}
        />
        <SelectInput
          id="course-difficulty"
          label="Difficulty"
          value={difficulty}
          options={LEARNING_DIFFICULTIES}
          onChange={(event) => setDifficulty(event.target.value)}
        />
        <div className="flex items-end">
          <Button type="submit" disabled={list.loading}>Search</Button>
        </div>
      </form>

      {skillId ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-soft px-4 py-3">
          <p className="po-secondary">
            Showing published courses linked to{' '}
            <span className="font-medium text-ink">{skillLabel || 'the selected ESCO skill'}</span>
            {' '}through LearningContentSkill.
          </p>
          <Button size="sm" variant="secondary" onClick={clearSkillFilter}>
            Clear skill filter
          </Button>
        </div>
      ) : null}

      <QueryStatus
        loading={list.loading}
        error={list.error}
        empty={!list.loading && !list.error && list.items.length === 0}
        loadingLabel="Loading courses…"
        emptyTitle={skillId ? 'No published PeaceOne course is linked to this ESCO skill.' : 'No published courses match these filters.'}
        emptyDescription={
          skillId
            ? 'Find Related Courses only lists courses with an exact LearningContentSkill record. PeaceOne does not invent mappings.'
            : 'Clear the search or ask an administrator to publish PeaceOne demonstration courses.'
        }
        onRetry={list.retry}
      >
        <div className="grid gap-5 md:grid-cols-2">
          {list.items.map((course) => {
            const path = learningCoursePath(basePath, course.id)
            const skills = (course.skills ?? []).map((item) => item.skill?.preferredLabel).filter(Boolean)
            return (
              <Link key={course.id} to={path} className="block no-underline">
                <Card hoverable className="h-full">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="primary" className="normal-case">{formatCategory(course.category)}</Badge>
                    <Badge className="normal-case">{formatDifficulty(course.difficulty)}</Badge>
                    <Badge status={enrollmentTone(course.enrollmentStatus)} className="normal-case">
                      {formatEnrollmentStatus(course.enrollmentStatus)}
                    </Badge>
                  </div>
                  <h3 className="po-card-title mt-3">{course.title}</h3>
                  <p className="po-secondary mt-2">{course.description}</p>
                  <p className="po-helper mt-3">
                    {course.lessonCount} lessons · {course.estimatedMinutes} minutes · {formatDifficulty(course.difficulty)}
                  </p>
                  {skills.length ? (
                    <p className="po-helper mt-2">Related ESCO skills: {skills.join(', ')}</p>
                  ) : (
                    <p className="po-helper mt-2">No ESCO skill links are stored for this course.</p>
                  )}
                  {course.enrollmentStatus ? (
                    <div className="mt-4">
                      <p className="po-helper mb-2">
                        Progress {course.progressPercent ?? 0}%
                        {course.completedLessonCount != null
                          ? ` (${course.completedLessonCount} of ${course.lessonCount} lessons)`
                          : ''}
                      </p>
                      <ProgressBar value={course.progressPercent ?? 0} />
                    </div>
                  ) : null}
                  <p className="mt-4 text-sm font-medium text-primary">{courseActionLabel(course.enrollmentStatus)}</p>
                </Card>
              </Link>
            )
          })}
        </div>
        <PaginationBar
          page={list.meta.page}
          totalPages={list.meta.totalPages}
          total={list.meta.total}
          noun="courses"
          disabled={list.loading}
          onPrevious={() => list.goToPage(list.page - 1)}
          onNext={() => list.goToPage(list.page + 1)}
        />
      </QueryStatus>
    </section>
  )
}

function LearningRecommendationsPage({ basePath }) {
  const [, setSearchParams] = useSearchParams()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestRef = useRef(0)
  const skillsPath = learningSkillsPath(basePath)
  const targetPath = learningCareerTargetPath(basePath)
  const gapPath = learningSkillGapPath(basePath)

  function loadRecommendations() {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setError('')
    fetchLearningRecommendations()
      .then((next) => {
        if (requestId !== requestRef.current) {
          return
        }
        setResult(next)
      })
      .catch((loadError) => {
        if (requestId !== requestRef.current) {
          return
        }
        setResult(null)
        setError(userFacingLearningError(loadError))
      })
      .finally(() => {
        if (requestId === requestRef.current) {
          setLoading(false)
        }
      })
  }

  useEffect(() => {
    const controller = new AbortController()
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    fetchLearningRecommendations({ signal: controller.signal })
      .then((next) => {
        if (requestId !== requestRef.current) {
          return
        }
        setResult(next)
        setError('')
        setLoading(false)
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || requestId !== requestRef.current) {
          return
        }
        setResult(null)
        setError(userFacingLearningError(loadError))
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const allSkills = useMemo(() => occupationSkillList(result), [result])
  const essentialSkills = allSkills.filter((topic) => topic.relationType === 'essential')
  const optionalSkills = allSkills.filter((topic) => topic.relationType !== 'essential')
  const emptyTarget = !loading && !error && result?.status === 'empty-target'

  function findRelatedCourses(topic) {
    setSearchParams({
      skillId: topic.skill.id,
      skillLabel: topic.skill.preferredLabel,
    })
    window.requestAnimationFrame(() => {
      document.getElementById('peaceone-course-catalogue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <PageContent
      title="Learning"
      description="Use ESCO skill recommendations for your saved career target, then enrol in published PeaceOne courses. Course progress is stored in PostgreSQL."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" to={`${basePath}/learning/progress`}>
            Learning Progress
          </Button>
          <Button variant="secondary" to={gapPath}>
            Review Skill Gap
          </Button>
        </div>
      }
    >
      <section>
        <SectionHeader
          title="ESCO skill recommendations"
          description="Essential and optional skills come from official occupation-skill relationships. Recorded means the skill is in your PeaceOne list. It is not a competence score. These topics are not courses."
        />
        <p className="po-secondary mb-6">
          <a href="#peaceone-course-catalogue" className="text-sm font-medium text-primary">
            Skip to published PeaceOne courses
          </a>
        </p>
        <QueryStatus
          loading={loading}
          error={error}
          empty={emptyTarget}
          loadingLabel="Loading skill-development topics…"
          emptyTitle={LEARNING_NO_TARGET.title}
          emptyDescription={LEARNING_NO_TARGET.description}
          emptyAction={
            <Button variant="secondary" to={targetPath}>
              Go to Career Target
            </Button>
          }
          onRetry={loadRecommendations}
        >
          {result?.occupation ? (
            <div className="space-y-8">
              <Card>
                <h2 className="po-section-title">Saved career target</h2>
                <p className="po-card-title mt-3">{result.occupation.preferredLabel}</p>
                <p className="po-secondary mt-1 break-all">{result.occupation.sourceUri}</p>
                <p className="po-secondary mt-4">{LEARNING_DISCLAIMER}</p>
                <p className="po-secondary mt-2">{SKILL_GAP_DISCLAIMER}</p>
                <p className="po-helper mt-4">
                  {`${result.recordedSkillCount} recorded skill${result.recordedSkillCount === 1 ? '' : 's'} in your PeaceOne list. ${result.matchedOccupationSkillCount ?? 0} of ${result.totals.relations} occupation-linked ESCO skills match by identifier.`}
                </p>
                {result.coverageExplanation ? (
                  <p className="po-secondary mt-2">{result.coverageExplanation}</p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="secondary" to={targetPath}>
                    Change Career Target
                  </Button>
                  <Button variant="secondary" to={skillsPath}>
                    Manage My Skills
                  </Button>
                </div>
              </Card>

              {result.status === 'no-linked-skills' ? (
                <Card>
                  <QueryStatus
                    empty
                    emptyTitle={LEARNING_NO_LINKED_SKILLS.title}
                    emptyDescription={LEARNING_NO_LINKED_SKILLS.description}
                  />
                </Card>
              ) : null}

              <section>
                <SectionHeader
                  title="Essential ESCO skills"
                  description="Find Related Courses lists published PeaceOne courses that already store this exact ESCO skill ID."
                />
                {essentialSkills.length === 0 ? (
                  <p className="po-secondary">No essential ESCO skills are linked to this occupation in the imported data.</p>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2">
                    {essentialSkills.map((topic) => (
                      <SkillTopicCard key={topic.id} topic={topic} onFindCourses={findRelatedCourses} />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <SectionHeader
                  title="Optional ESCO skills"
                  description="Optional skills are still occupation-linked. Courses appear only when LearningContentSkill uses the same skill identifier."
                />
                {optionalSkills.length === 0 ? (
                  <p className="po-secondary">No optional ESCO skills are linked to this occupation in the imported data.</p>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2">
                    {optionalSkills.map((topic) => (
                      <SkillTopicCard key={topic.id} topic={topic} onFindCourses={findRelatedCourses} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </QueryStatus>
      </section>

      <CourseCatalogue basePath={basePath} />
    </PageContent>
  )
}

export default LearningRecommendationsPage
