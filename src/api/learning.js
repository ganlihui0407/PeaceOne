import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, apiRequest } from './client.js'
import { buildSearchParams, isAbortError } from './esco.js'

export const LEARNING_UNAVAILABLE = 'Learning courses are unavailable right now.'
export const LEARNING_LIST_LIMIT = 20

export function progressPercentSafe(completedLessons, totalLessons) {
  if (!totalLessons) {
    return 0
  }
  return Math.floor((completedLessons / totalLessons) * 100)
}

export const LEARNING_CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'DATA_ANALYTICS', label: 'Data analytics' },
  { value: 'SOFTWARE_DEVELOPMENT', label: 'Software development' },
  { value: 'DIGITAL_MARKETING', label: 'Digital marketing' },
  { value: 'UI_UX_DESIGN', label: 'UI/UX design' },
  { value: 'CYBERSECURITY', label: 'Cybersecurity' },
]

export const LEARNING_DIFFICULTIES = [
  { value: '', label: 'All levels' },
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
]

export const LEARNING_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
]

export function formatDifficulty(value) {
  if (value === 'BEGINNER') return 'Beginner'
  if (value === 'INTERMEDIATE') return 'Intermediate'
  if (value === 'ADVANCED') return 'Advanced'
  return value || '—'
}

export function formatCategory(value) {
  return LEARNING_CATEGORIES.find((item) => item.value === value)?.label || value || '—'
}

export function formatEnrollmentStatus(value) {
  if (value === 'ENROLLED') return 'Enrolled'
  if (value === 'IN_PROGRESS') return 'In progress'
  if (value === 'COMPLETED') return 'Completed'
  return 'Not enrolled'
}

export function courseActionLabel(status) {
  if (status === 'ENROLLED') return 'Start Learning'
  if (status === 'IN_PROGRESS') return 'Continue Learning'
  if (status === 'COMPLETED') return 'Review Course'
  return 'View Course'
}

export const LESSON_SECTION_HEADINGS = [
  'Introduction',
  'Explanation',
  'Practical example',
  'Learning summary',
  'Completion criteria',
]

export function parseLessonBody(body) {
  const text = typeof body === 'string' ? body.replace(/\r\n/g, '\n').trim() : ''
  if (!text) {
    return []
  }
  const headingPattern = new RegExp(`^(${LESSON_SECTION_HEADINGS.join('|')})$`, 'i')
  const sections = []
  let current = null
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (headingPattern.test(trimmed)) {
      if (current) {
        current.text = current.text.trim()
        sections.push(current)
      }
      current = { title: trimmed, text: '' }
      continue
    }
    if (!current) {
      current = { title: 'Lesson content', text: '' }
    }
    current.text += `${line}\n`
  }
  if (current) {
    current.text = current.text.trim()
    sections.push(current)
  }
  return sections
}

export function nextIncompleteLesson(lessons) {
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return null
  }
  return lessons.find((item) => !item.completed) || lessons[0]
}

export function neighboringLessons(lessons, lessonId) {
  if (!Array.isArray(lessons)) {
    return { index: -1, previous: null, next: null }
  }
  const index = lessons.findIndex((item) => item.id === lessonId)
  return {
    index,
    previous: index > 0 ? lessons[index - 1] : null,
    next: index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null,
  }
}

export function enrollmentTone(value) {
  if (value === 'COMPLETED') return 'success'
  if (value === 'IN_PROGRESS') return 'inprogress'
  if (value === 'ENROLLED') return 'active'
  return 'default'
}

export function formatCourseStatus(value) {
  if (value === 'PUBLISHED') return 'Published'
  if (value === 'ARCHIVED') return 'Archived'
  return 'Draft'
}

export function userFacingLearningError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to view learning courses.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return error.message === 'Enrolment required'
        ? 'Enrol in this course to open lessons and assessments.'
        : 'You cannot use learning with this account.'
    }
    if (error.message) {
      return error.message
    }
  }
  return LEARNING_UNAVAILABLE
}

export function learningCoursePath(basePath, contentId) {
  return `${basePath}/learning/${contentId}`
}

export function learningLessonPath(basePath, contentId, lessonId) {
  return `${basePath}/learning/${contentId}/lessons/${lessonId}`
}

export function learningAssessmentPath(basePath, contentId, assessmentId) {
  return `${basePath}/learning/${contentId}/assessments/${assessmentId}`
}

export function toPublicCourseCard(course) {
  const skillLabels = (course.skills ?? []).map((item) => item.skill?.preferredLabel).filter(Boolean)
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    category: formatCategory(course.category),
    difficulty: formatDifficulty(course.difficulty),
    duration: `${course.estimatedMinutes} minutes`,
    skill: skillLabels[0] || '',
    skills: skillLabels,
    lessonCount: course.lessonCount,
  }
}

export async function fetchPublishedCourseCatalog({ q, category, difficulty, skillId, page = 1, limit = LEARNING_LIST_LIMIT, signal } = {}) {
  const payload = await fetchPublishedCourses({ q, category, difficulty, skillId, page, limit, signal })
  return {
    items: payload.courses ?? [],
    page: payload.page,
    limit: payload.limit,
    total: payload.total,
    totalPages: payload.totalPages,
  }
}

export function fetchPublishedCourses({ q, category, difficulty, skillId, page = 1, limit = LEARNING_LIST_LIMIT, signal } = {}) {
  const params = buildSearchParams({ q, category, difficulty, skillId, page, limit })
  return apiRequest(`/api/learning/courses${params}`, { signal })
}

export function fetchPublishedCourse(contentId, { signal } = {}) {
  return apiRequest(`/api/learning/courses/${contentId}`, { signal })
}

export function fetchCourseRecommendations({ signal } = {}) {
  return apiRequest('/api/me/learning/recommendations', { signal })
}

export function fetchOwnEnrollments({ signal } = {}) {
  return apiRequest('/api/me/learning/enrollments', { signal })
}

export function fetchLearningHistory({ signal } = {}) {
  return apiRequest('/api/me/learning/history', { signal })
}

export function enrollInCourse(contentId) {
  return apiRequest('/api/me/learning/enrollments', {
    method: 'POST',
    mutate: true,
    body: { contentId },
  })
}

export function fetchOwnLesson(lessonId, { signal } = {}) {
  return apiRequest(`/api/me/learning/lessons/${lessonId}`, { signal })
}

export function completeOwnLesson(lessonId) {
  return apiRequest(`/api/me/learning/lessons/${lessonId}/complete`, {
    method: 'POST',
    mutate: true,
    body: {},
  })
}

export function fetchOwnAssessment(assessmentId, { signal } = {}) {
  return apiRequest(`/api/me/learning/assessments/${assessmentId}`, { signal })
}

export function submitAssessmentAttempt(assessmentId, answers) {
  return apiRequest(`/api/me/learning/assessments/${assessmentId}/attempts`, {
    method: 'POST',
    mutate: true,
    body: { answers },
  })
}

export function fetchAdminLearningStats({ signal } = {}) {
  return apiRequest('/api/admin/learning/stats', { signal })
}

export function fetchAdminCourses({ q, category, difficulty, status, page = 1, limit = LEARNING_LIST_LIMIT, signal } = {}) {
  const params = buildSearchParams({ q, category, difficulty, status, page, limit })
  return apiRequest(`/api/admin/learning/courses${params}`, { signal })
}

export function fetchAdminCourse(contentId, { signal } = {}) {
  return apiRequest(`/api/admin/learning/courses/${contentId}`, { signal })
}

export function createAdminCourse(body) {
  return apiRequest('/api/admin/learning/courses', {
    method: 'POST',
    mutate: true,
    body,
  })
}

export function updateAdminCourse(contentId, body) {
  return apiRequest(`/api/admin/learning/courses/${contentId}`, {
    method: 'PUT',
    mutate: true,
    body,
  })
}

export function publishAdminCourse(contentId) {
  return apiRequest(`/api/admin/learning/courses/${contentId}/publish`, {
    method: 'PATCH',
    mutate: true,
    body: {},
  })
}

export function unpublishAdminCourse(contentId) {
  return apiRequest(`/api/admin/learning/courses/${contentId}/unpublish`, {
    method: 'PATCH',
    mutate: true,
    body: {},
  })
}

export function archiveAdminCourse(contentId) {
  return apiRequest(`/api/admin/learning/courses/${contentId}/archive`, {
    method: 'PATCH',
    mutate: true,
    body: {},
  })
}

export function createAdminLesson(contentId, body) {
  return apiRequest(`/api/admin/learning/courses/${contentId}/lessons`, {
    method: 'POST',
    mutate: true,
    body,
  })
}

export function updateAdminLesson(lessonId, body) {
  return apiRequest(`/api/admin/learning/lessons/${lessonId}`, {
    method: 'PUT',
    mutate: true,
    body,
  })
}

export function fetchAdminCourseEnrollments(contentId, { signal } = {}) {
  return apiRequest(`/api/admin/learning/courses/${contentId}/enrollments`, { signal })
}

export function createAdminAssessment(contentId, body) {
  return apiRequest(`/api/admin/learning/courses/${contentId}/assessments`, {
    method: 'POST',
    mutate: true,
    body,
  })
}

export function updateAdminAssessment(assessmentId, body) {
  return apiRequest(`/api/admin/learning/assessments/${assessmentId}`, {
    method: 'PUT',
    mutate: true,
    body,
  })
}
