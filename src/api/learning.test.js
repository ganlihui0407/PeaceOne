import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from './client.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  courseActionLabel,
  formatCategory,
  formatDifficulty,
  formatEnrollmentStatus,
  learningAssessmentPath,
  learningLessonPath,
  neighboringLessons,
  nextIncompleteLesson,
  parseLessonBody,
  toPublicCourseCard,
  userFacingLearningError,
} from './learning.js'

test('formats learning labels', () => {
  assert.equal(formatDifficulty('BEGINNER'), 'Beginner')
  assert.equal(formatCategory('DATA_ANALYTICS'), 'Data analytics')
  assert.equal(formatEnrollmentStatus('IN_PROGRESS'), 'In progress')
  assert.equal(courseActionLabel(null), 'View Course')
  assert.equal(courseActionLabel('ENROLLED'), 'Start Learning')
  assert.equal(courseActionLabel('IN_PROGRESS'), 'Continue Learning')
  assert.equal(courseActionLabel('COMPLETED'), 'Review Course')
  assert.equal(learningLessonPath('/student', 'c1', 'l1'), '/student/learning/c1/lessons/l1')
  assert.equal(learningAssessmentPath('/jobseeker', 'c1', 'a1'), '/jobseeker/learning/c1/assessments/a1')
})

test('parseLessonBody keeps labelled teaching sections', () => {
  const sections = parseLessonBody('Introduction\n\nHello.\n\nPractical example\n\nTry SELECT 1.')
  assert.equal(sections[0].title, 'Introduction')
  assert.equal(sections[0].text, 'Hello.')
  assert.equal(sections[1].title, 'Practical example')
  const lessons = [
    { id: 'a', completed: true },
    { id: 'b', completed: false },
  ]
  assert.equal(nextIncompleteLesson(lessons).id, 'b')
  assert.equal(neighboringLessons(lessons, 'b').previous.id, 'a')
})

test('student learning pages persist through APIs and hide answers before submit', () => {
  const files = [
    '../pages/shared/LearningRecommendationsPage.jsx',
    '../pages/shared/LearningDetailPage.jsx',
    '../pages/shared/LearningLessonPage.jsx',
    '../pages/shared/LearningAssessmentPage.jsx',
    '../pages/shared/LearningProgressPage.jsx',
  ]
  for (const relative of files) {
    const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
    assert.equal(source.includes('localStorage'), false, relative)
    assert.equal(source.includes('correctOptionId'), false, relative)
  }
  const learning = readFileSync(fileURLToPath(new URL('../pages/shared/LearningRecommendationsPage.jsx', import.meta.url)), 'utf8')
  assert.equal(learning.includes('Find Related Courses'), true)
  assert.equal(learning.includes('PeaceOne course catalogue'), true)
  assert.equal(learning.includes('fetchPublishedCourseCatalog'), true)
  const client = readFileSync(fileURLToPath(new URL('./learning.js', import.meta.url)), 'utf8')
  assert.equal(client.includes('skillId'), true)
  const lesson = readFileSync(fileURLToPath(new URL('../pages/shared/LearningLessonPage.jsx', import.meta.url)), 'utf8')
  assert.equal(lesson.includes('completeOwnLesson'), true)
  assert.equal(lesson.includes('Mark as Complete'), true)
  const quiz = readFileSync(fileURLToPath(new URL('../pages/shared/LearningAssessmentPage.jsx', import.meta.url)), 'utf8')
  assert.equal(quiz.includes('submitAssessmentAttempt'), true)
  const progress = readFileSync(fileURLToPath(new URL('../pages/shared/LearningProgressPage.jsx', import.meta.url)), 'utf8')
  assert.equal(progress.includes('fetchLearningHistory'), true)
})

test('toPublicCourseCard maps published API courses for public cards', () => {
  const card = toPublicCourseCard({
    id: '11111111-1111-4111-8111-111111111111',
    title: 'SQL Fundamentals',
    description: 'PeaceOne demonstration SQL course.',
    category: 'DATA_ANALYTICS',
    difficulty: 'BEGINNER',
    estimatedMinutes: 180,
    lessonCount: 4,
    skills: [{ skill: { preferredLabel: 'SQL' } }],
  })
  assert.equal(card.category, 'Data analytics')
  assert.equal(card.difficulty, 'Beginner')
  assert.equal(card.duration, '180 minutes')
  assert.equal(card.skill, 'SQL')
})

test('public header follows the signed-in session instead of always showing Login', () => {
  const header = readFileSync(fileURLToPath(new URL('../components/layout/PublicHeader.jsx', import.meta.url)), 'utf8')
  assert.equal(header.includes("from '../../auth/useAuth.js'"), true)
  assert.equal(header.includes('dashboardForRole'), true)
  assert.equal(header.includes('Log out'), true)
  assert.equal(header.includes('Workspace'), true)
})

test('public footer follows the signed-in session instead of always showing Login', () => {
  const footer = readFileSync(fileURLToPath(new URL('../components/layout/Footer.jsx', import.meta.url)), 'utf8')
  assert.equal(footer.includes("from '../../auth/useAuth.js'"), true)
  assert.equal(footer.includes('dashboardForRole'), true)
  assert.equal(footer.includes('Workspace'), true)
})

test('public learning pages do not import static course fixtures', () => {
  const files = [
    '../pages/public/Learning.jsx',
    '../pages/public/CourseDetail.jsx',
    '../pages/public/sections/FeaturedLearningSection.jsx',
  ]
  for (const relative of files) {
    const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
    assert.equal(source.includes("from '../../data/courses.js'"), false, relative)
    assert.equal(source.includes("from '../../../data/courses.js'"), false, relative)
    assert.equal(source.includes('fetchPublishedCourse'), true, relative)
  }
})

test('user-facing enrolment errors stay specific', () => {
  assert.equal(
    userFacingLearningError(new ApiError('Enrolment required', 403)),
    'Enrol in this course to open lessons and assessments.',
  )
})
