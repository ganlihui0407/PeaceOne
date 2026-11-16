import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import { fetchSkills } from '../../api/esco.js'
import { PROFICIENCY_LEVELS } from '../../api/userSkills.js'
import {
  LEARNING_CATEGORIES,
  LEARNING_DIFFICULTIES,
  createAdminAssessment,
  createAdminCourse,
  createAdminLesson,
  fetchAdminCourse,
  updateAdminAssessment,
  updateAdminCourse,
  updateAdminLesson,
  userFacingLearningError,
} from '../../api/learning.js'

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function emptyLesson(sortOrder) {
  return { title: '', body: '', sortOrder, estimatedMinutes: 30 }
}

function emptyQuestion(sortOrder) {
  return {
    prompt: '',
    options: [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
      { id: 'c', text: '' },
      { id: 'd', text: '' },
    ],
    correctOptionId: 'a',
    sortOrder,
  }
}

function emptyAssessment() {
  return {
    title: 'Course check',
    passingScore: 70,
    questions: [emptyQuestion(1), emptyQuestion(2), emptyQuestion(3)],
  }
}

function assessmentToForm(assessment) {
  return {
    id: assessment.id,
    title: assessment.title,
    passingScore: assessment.passingScore,
    questions: (assessment.questions || []).map((question, index) => ({
      prompt: question.prompt,
      options: question.options,
      correctOptionId: question.correctOptionId,
      sortOrder: question.sortOrder || index + 1,
    })),
  }
}

function LearningContentFormPage() {
  const { contentId } = useParams()
  return <LearningContentForm key={contentId || 'create'} contentId={contentId} />
}

function LearningContentForm({ contentId }) {
  const navigate = useNavigate()
  const isEdit = Boolean(contentId)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [skillQuery, setSkillQuery] = useState('')
  const [skillHits, setSkillHits] = useState([])
  const [form, setForm] = useState({
    slug: '',
    title: '',
    description: '',
    objectivesText: '',
    category: 'DATA_ANALYTICS',
    difficulty: 'BEGINNER',
    estimatedMinutes: 120,
    thumbnailUrl: '',
    skills: [],
  })
  const [lessons, setLessons] = useState([emptyLesson(1)])
  const [assessments, setAssessments] = useState([])
  const [savingQuiz, setSavingQuiz] = useState(false)

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  useEffect(() => {
    if (!contentId) {
      return
    }
    fetchAdminCourse(contentId)
      .then((payload) => {
        const course = payload.course
        setForm({
          slug: course.slug,
          title: course.title,
          description: course.description,
          objectivesText: (course.objectives ?? []).join('\n'),
          category: course.category,
          difficulty: course.difficulty,
          estimatedMinutes: course.estimatedMinutes,
          thumbnailUrl: course.thumbnailUrl ?? '',
          skills: (course.skills ?? []).map((item) => ({
            skillId: item.skillId,
            label: item.skill.preferredLabel,
            targetProficiency: item.targetProficiency,
          })),
        })
        setLessons(
          (payload.lessons ?? []).map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            body: lesson.body,
            sortOrder: lesson.sortOrder,
            estimatedMinutes: lesson.estimatedMinutes,
          })),
        )
        setAssessments((payload.assessments ?? []).map(assessmentToForm))
      })
      .catch((loadError) => setError(userFacingLearningError(loadError)))
      .finally(() => setLoading(false))
  }, [contentId])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function searchSkills() {
    if (skillQuery.trim().length < 2) {
      return
    }
    try {
      const result = await fetchSkills({ q: skillQuery.trim(), limit: 8 })
      setSkillHits(result.items ?? [])
    } catch (searchError) {
      setError(userFacingLearningError(searchError))
    }
  }

  function addSkill(skill) {
    setForm((current) => {
      if (current.skills.some((item) => item.skillId === skill.id)) {
        return current
      }
      return {
        ...current,
        skills: [
          ...current.skills,
          { skillId: skill.id, label: skill.preferredLabel, targetProficiency: 'Beginner' },
        ],
      }
    })
    setSkillHits([])
    setSkillQuery('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const objectives = form.objectivesText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
    if (!form.title.trim() || objectives.length === 0) {
      setError('Title and at least one learning objective are required.')
      return
    }
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      objectives,
      category: form.category,
      difficulty: form.difficulty,
      estimatedMinutes: Number(form.estimatedMinutes),
      thumbnailUrl: form.thumbnailUrl.trim() || null,
      skills: form.skills.map((item) => ({
        skillId: item.skillId,
        targetProficiency: item.targetProficiency,
      })),
    }
    try {
      if (isEdit) {
        await updateAdminCourse(contentId, body)
        for (const lesson of lessons) {
          const lessonBody = {
            title: lesson.title.trim(),
            body: lesson.body.trim(),
            sortOrder: Number(lesson.sortOrder),
            estimatedMinutes: Number(lesson.estimatedMinutes),
          }
          if (!lessonBody.title || !lessonBody.body) {
            continue
          }
          if (lesson.id) {
            await updateAdminLesson(lesson.id, lessonBody)
          } else {
            await createAdminLesson(contentId, lessonBody)
          }
        }
        showToast('Course saved.')
      } else {
        const slug = form.slug.trim() || slugify(form.title)
        const created = await createAdminCourse({ ...body, slug })
        for (const [index, lesson] of lessons.entries()) {
          if (!lesson.title.trim() || !lesson.body.trim()) {
            continue
          }
          await createAdminLesson(created.course.id, {
            title: lesson.title.trim(),
            body: lesson.body.trim(),
            sortOrder: Number(lesson.sortOrder) || index + 1,
            estimatedMinutes: Number(lesson.estimatedMinutes) || 30,
          })
        }
        showToast('Course created as a draft.')
        navigate(`/admin/learning/${created.course.id}/edit`)
      }
    } catch (saveError) {
      setError(userFacingLearningError(saveError))
    }
  }

  if (isEdit && loading) {
    return (
      <PageContent title="Edit course">
        <QueryStatus loading loadingLabel="Loading course…" />
      </PageContent>
    )
  }

  return (
    <PageContent
      title={isEdit ? 'Edit course' : 'Create course'}
      description="Courses are stored in PostgreSQL. Publish from the course list after lessons exist."
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error ? <p className="po-helper text-danger">{error}</p> : null}
        <Card>
          <h2 className="po-section-title">Course information</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <TextInput
                id="lc-title"
                label="Title"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                required
              />
            </div>
            {isEdit ? null : (
              <TextInput
                id="lc-slug"
                label="Slug"
                helperText="Leave blank to generate from the title."
                value={form.slug}
                onChange={(event) => updateField('slug', event.target.value)}
              />
            )}
            <SelectInput
              id="lc-category"
              label="Category"
              value={form.category}
              options={LEARNING_CATEGORIES.filter((item) => item.value)}
              onChange={(event) => updateField('category', event.target.value)}
            />
            <SelectInput
              id="lc-difficulty"
              label="Difficulty"
              value={form.difficulty}
              options={LEARNING_DIFFICULTIES.filter((item) => item.value)}
              onChange={(event) => updateField('difficulty', event.target.value)}
            />
            <TextInput
              id="lc-minutes"
              label="Estimated minutes"
              type="number"
              value={form.estimatedMinutes}
              onChange={(event) => updateField('estimatedMinutes', event.target.value)}
            />
            <TextInput
              id="lc-thumb"
              label="Thumbnail URL (optional)"
              value={form.thumbnailUrl}
              onChange={(event) => updateField('thumbnailUrl', event.target.value)}
            />
            <div className="md:col-span-2">
              <TextArea
                id="lc-description"
                label="Description"
                rows={4}
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <TextArea
                id="lc-objectives"
                label="Learning objectives (one per line)"
                rows={4}
                value={form.objectivesText}
                onChange={(event) => updateField('objectivesText', event.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="ESCO skills" description="Search the imported catalogue and set a target proficiency. Completing the course can record these skills at this level, never silently as Advanced unless you set it." />
          <div className="mt-4 flex flex-wrap gap-2">
            <TextInput
              id="lc-skill-search"
              label="Search skills"
              value={skillQuery}
              onChange={(event) => setSkillQuery(event.target.value)}
            />
            <div className="flex items-end">
              <Button type="button" variant="secondary" onClick={searchSkills}>
                Search
              </Button>
            </div>
          </div>
          {skillHits.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {skillHits.map((skill) => (
                <li key={skill.id}>
                  <Button type="button" size="sm" variant="secondary" onClick={() => addSkill(skill)}>
                    Add {skill.preferredLabel}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 space-y-3">
            {form.skills.map((skill) => (
              <div key={skill.skillId} className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-[1fr_12rem_auto] md:items-end">
                <p className="font-medium text-ink">{skill.label}</p>
                <SelectInput
                  id={`${skill.skillId}-level`}
                  label="Target proficiency"
                  value={skill.targetProficiency}
                  options={PROFICIENCY_LEVELS}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    skills: current.skills.map((item) => (
                      item.skillId === skill.skillId
                        ? { ...item, targetProficiency: event.target.value }
                        : item
                    )),
                  }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setForm((current) => ({
                    ...current,
                    skills: current.skills.filter((item) => item.skillId !== skill.skillId),
                  }))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Lessons"
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => setLessons((current) => [...current, emptyLesson(current.length + 1)])}
              >
                Add lesson
              </Button>
            }
          />
          <div className="mt-4 space-y-4">
            {lessons.map((lesson, index) => (
              <div key={lesson.id || `new-${index}`} className="space-y-3 rounded-xl border border-line p-4">
                <TextInput
                  id={`lesson-title-${index}`}
                  label={`Lesson ${index + 1} title`}
                  value={lesson.title}
                  onChange={(event) => setLessons((current) => current.map((item, itemIndex) => (
                    itemIndex === index ? { ...item, title: event.target.value } : item
                  )))}
                />
                <TextInput
                  id={`lesson-minutes-${index}`}
                  label="Minutes"
                  type="number"
                  value={lesson.estimatedMinutes}
                  onChange={(event) => setLessons((current) => current.map((item, itemIndex) => (
                    itemIndex === index ? { ...item, estimatedMinutes: event.target.value } : item
                  )))}
                />
                <TextArea
                  id={`lesson-body-${index}`}
                  label="Lesson content"
                  rows={6}
                  value={lesson.body}
                  onChange={(event) => setLessons((current) => current.map((item, itemIndex) => (
                    itemIndex === index ? { ...item, body: event.target.value } : item
                  )))}
                />
              </div>
            ))}
          </div>
        </Card>

        {isEdit ? (
          <Card>
            <SectionHeader
              title="Quizzes"
              description="Correct answers are stored for administrators and scoring. Student APIs do not return correctOptionId."
              action={
                <Button type="button" variant="outline" onClick={() => setAssessments((current) => [...current, emptyAssessment()])}>
                  Add quiz
                </Button>
              }
            />
            <div className="mt-4 space-y-6">
              {assessments.length === 0 ? (
                <p className="po-secondary">No quizzes yet. Add one after the course exists.</p>
              ) : null}
              {assessments.map((assessment, assessmentIndex) => (
                <div key={assessment.id || `new-quiz-${assessmentIndex}`} className="space-y-4 rounded-xl border border-line p-4">
                  <TextInput
                    id={`quiz-title-${assessmentIndex}`}
                    label="Quiz title"
                    value={assessment.title}
                    onChange={(event) => setAssessments((current) => current.map((item, index) => (
                      index === assessmentIndex ? { ...item, title: event.target.value } : item
                    )))}
                  />
                  <TextInput
                    id={`quiz-pass-${assessmentIndex}`}
                    label="Passing score"
                    type="number"
                    value={assessment.passingScore}
                    onChange={(event) => setAssessments((current) => current.map((item, index) => (
                      index === assessmentIndex ? { ...item, passingScore: Number(event.target.value) } : item
                    )))}
                  />
                  {assessment.questions.map((question, questionIndex) => (
                    <div key={`${assessmentIndex}-${questionIndex}`} className="space-y-2 rounded-lg bg-page p-3">
                      <TextArea
                        id={`q-${assessmentIndex}-${questionIndex}`}
                        label={`Question ${questionIndex + 1}`}
                        rows={2}
                        value={question.prompt}
                        onChange={(event) => setAssessments((current) => current.map((item, index) => (
                          index === assessmentIndex
                            ? {
                              ...item,
                              questions: item.questions.map((entry, entryIndex) => (
                                entryIndex === questionIndex ? { ...entry, prompt: event.target.value } : entry
                              )),
                            }
                            : item
                        )))}
                      />
                      {question.options.map((option) => (
                        <TextInput
                          key={option.id}
                          id={`opt-${assessmentIndex}-${questionIndex}-${option.id}`}
                          label={`Option ${option.id}${question.correctOptionId === option.id ? ' (correct)' : ''}`}
                          value={option.text}
                          onChange={(event) => setAssessments((current) => current.map((item, index) => (
                            index === assessmentIndex
                              ? {
                                ...item,
                                questions: item.questions.map((entry, entryIndex) => (
                                  entryIndex === questionIndex
                                    ? {
                                      ...entry,
                                      options: entry.options.map((opt) => (
                                        opt.id === option.id ? { ...opt, text: event.target.value } : opt
                                      )),
                                    }
                                    : entry
                                )),
                              }
                              : item
                          )))}
                        />
                      ))}
                      <SelectInput
                        id={`correct-${assessmentIndex}-${questionIndex}`}
                        label="Correct option"
                        value={question.correctOptionId}
                        options={question.options.map((option) => ({ value: option.id, label: option.id.toUpperCase() }))}
                        onChange={(event) => setAssessments((current) => current.map((item, index) => (
                          index === assessmentIndex
                            ? {
                              ...item,
                              questions: item.questions.map((entry, entryIndex) => (
                                entryIndex === questionIndex
                                  ? { ...entry, correctOptionId: event.target.value }
                                  : entry
                              )),
                            }
                            : item
                        )))}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    disabled={savingQuiz}
                    onClick={async () => {
                      setSavingQuiz(true)
                      setError('')
                      const body = {
                        title: assessment.title.trim(),
                        passingScore: Number(assessment.passingScore) || 70,
                        questions: assessment.questions.map((question, index) => ({
                          prompt: question.prompt.trim(),
                          options: question.options,
                          correctOptionId: question.correctOptionId,
                          sortOrder: index + 1,
                        })),
                      }
                      try {
                        if (assessment.id) {
                          await updateAdminAssessment(assessment.id, body)
                          showToast('Quiz updated.')
                        } else {
                          const created = await createAdminAssessment(contentId, body)
                          setAssessments((current) => current.map((item, index) => (
                            index === assessmentIndex
                              ? assessmentToForm(created.assessment)
                              : item
                          )))
                          showToast('Quiz created.')
                        }
                      } catch (quizError) {
                        setError(userFacingLearningError(quizError))
                      } finally {
                        setSavingQuiz(false)
                      }
                    }}
                  >
                    {assessment.id ? 'Save quiz' : 'Create quiz'}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <p className="po-secondary">Create the draft first, then add quizzes on the edit screen.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit">{isEdit ? 'Save course' : 'Create draft'}</Button>
          <Button type="button" variant="secondary" to="/admin/learning">
            Back to list
          </Button>
        </div>
      </form>
      <Toast message={toast} />
    </PageContent>
  )
}

export default LearningContentFormPage
