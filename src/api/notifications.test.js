import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, clearCsrfToken, setCsrfToken } from './client.js'
import {
  ADMIN_RELATED_UNAVAILABLE,
  NOTIFICATION_DROPDOWN_LIMIT,
  NOTIFICATION_EMPTY,
  NOTIFICATION_LIST_LIMIT,
  NOTIFICATION_UNREAD_EMPTY,
  NOTIFICATIONS_UNAVAILABLE,
  RELATED_RECORD_UNAVAILABLE,
  fetchNotifications,
  fetchUnreadNotificationCount,
  formatUnreadBadge,
  isNotificationId,
  isNotificationUnread,
  markAllNotificationsRead,
  markNotificationRead,
  notificationDestination,
  notificationsCentrePath,
  parseNotification,
  parseNotificationPage,
  parseUnreadCount,
  resolveNotificationTarget,
  userFacingNotificationError,
} from './notifications.js'

const originalFetch = globalThis.fetch
const NOTIFICATION_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const APPLICATION_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const INTERVIEW_ID = 'cccccccc-3333-4333-8333-cccccccccccc'
const MISSING_ID = 'dddddddd-4444-4444-8444-dddddddddddd'

afterEach(() => {
  globalThis.fetch = originalFetch
  clearCsrfToken()
})

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function notificationPayload(overrides = {}) {
  return {
    id: NOTIFICATION_ID,
    type: 'APPLICATION_SHORTLISTED',
    title: 'Application shortlisted',
    message: 'You were shortlisted for Junior Analyst at BrightWave.',
    relatedEntityType: 'APPLICATION',
    relatedEntityId: APPLICATION_ID,
    readAt: null,
    createdAt: '2026-11-15T04:00:00.000Z',
    meetingLink: 'https://secret.example/meet',
    notes: 'Do not show employer notes',
    recipientUserId: 'should-not-parse',
    ...overrides,
  }
}

function pagePayload(items = [notificationPayload()], overrides = {}) {
  return {
    notifications: items,
    page: 1,
    limit: 20,
    total: items.length,
    totalPages: items.length === 0 ? 0 : 1,
    ...overrides,
  }
}

test('parseNotification keeps public fields and drops private extras', () => {
  const parsed = parseNotification(notificationPayload())
  assert.equal(parsed.id, NOTIFICATION_ID)
  assert.equal(parsed.relatedEntityType, 'APPLICATION')
  assert.equal(parsed.relatedEntityId, APPLICATION_ID)
  assert.equal(parsed.readAt, null)
  assert.equal('meetingLink' in parsed, false)
  assert.equal('notes' in parsed, false)
  assert.equal('recipientUserId' in parsed, false)
  assert.equal(isNotificationUnread(parsed), true)
  assert.equal(isNotificationId(NOTIFICATION_ID), true)
  assert.equal(isNotificationId('not-a-uuid'), false)
})

test('unread badge hides at zero and caps at 99+', () => {
  assert.equal(formatUnreadBadge(0), '')
  assert.equal(formatUnreadBadge(-1), '')
  assert.equal(formatUnreadBadge(1), '1')
  assert.equal(formatUnreadBadge(99), '99')
  assert.equal(formatUnreadBadge(100), '99+')
  assert.equal(formatUnreadBadge(250), '99+')
})

test('role-specific destinations use application and interview pages', () => {
  const application = notificationPayload()
  const interview = notificationPayload({
    type: 'INTERVIEW_INVITED',
    relatedEntityType: 'INTERVIEW',
    relatedEntityId: INTERVIEW_ID,
  })
  assert.equal(notificationDestination('STUDENT', application), `/student/applications/${APPLICATION_ID}`)
  assert.equal(notificationDestination('JOB_SEEKER', application), `/jobseeker/applications/${APPLICATION_ID}`)
  assert.equal(notificationDestination('COMPANY_STAFF', application), `/employer/applicants/${APPLICATION_ID}`)
  assert.equal(notificationDestination('STUDENT', interview), `/student/interviews/${INTERVIEW_ID}`)
  assert.equal(notificationDestination('JOB_SEEKER', interview), `/jobseeker/interviews/${INTERVIEW_ID}`)
  assert.equal(notificationDestination('COMPANY_STAFF', interview), `/employer/interviews/${INTERVIEW_ID}`)
  assert.equal(notificationDestination('ADMIN', application), null)
  assert.equal(notificationsCentrePath('ADMIN'), '/admin/notifications')
})

test('fetchNotifications and unread count use session APIs without recipient ids', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method || 'GET', body: init.body, headers: init.headers })
    if (path === '/api/me/notifications?page=2&limit=20&unread=true') {
      return jsonResponse(200, pagePayload([], { page: 2, total: 0, totalPages: 0 }))
    }
    if (path === '/api/me/notifications?page=1&limit=5') {
      return jsonResponse(200, pagePayload([notificationPayload()], { page: 1, limit: 5, total: 1, totalPages: 1 }))
    }
    if (path === '/api/me/notifications/unread-count') {
      return jsonResponse(200, { unreadCount: 4 })
    }
    throw new Error(`unexpected ${path}`)
  }

  const unreadPage = await fetchNotifications({ unread: true, page: 2, limit: NOTIFICATION_LIST_LIMIT })
  const recent = await fetchNotifications({ page: 1, limit: NOTIFICATION_DROPDOWN_LIMIT })
  const count = await fetchUnreadNotificationCount()
  assert.equal(unreadPage.total, 0)
  assert.equal(recent.items.length, 1)
  assert.equal(count.unreadCount, 4)
  assert.equal(parseUnreadCount({ unreadCount: 0 }).unreadCount, 0)
  assert.equal(parseNotificationPage(pagePayload([])).items.length, 0)
  for (const call of calls) {
    assert.equal(String(call.path).includes('recipient'), false)
    assert.equal(call.body, undefined)
    assert.equal(call.headers['x-csrf-token'], undefined)
  }
})

test('mark as read and mark all as read send CSRF and empty bodies', async () => {
  const calls = []
  setCsrfToken('csrf-notifications')
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body, headers: init.headers })
    if (path === `/api/me/notifications/${NOTIFICATION_ID}/read` && init.method === 'PATCH') {
      return jsonResponse(200, {
        notification: notificationPayload({ readAt: '2026-11-15T05:00:00.000Z' }),
      })
    }
    if (path === '/api/me/notifications/read-all' && init.method === 'POST') {
      return jsonResponse(200, { updatedCount: 3 })
    }
    throw new Error(`unexpected ${path}`)
  }

  const updated = await markNotificationRead(NOTIFICATION_ID)
  const all = await markAllNotificationsRead()
  assert.equal(updated.readAt, '2026-11-15T05:00:00.000Z')
  assert.equal(all.updatedCount, 3)
  const patch = calls.find((call) => call.method === 'PATCH')
  const post = calls.find((call) => call.method === 'POST')
  assert.equal(patch.headers['x-csrf-token'], 'csrf-notifications')
  assert.equal(post.headers['x-csrf-token'], 'csrf-notifications')
  assert.deepEqual(JSON.parse(patch.body), {})
  assert.deepEqual(JSON.parse(post.body), {})
  assert.equal(JSON.parse(patch.body).recipientUserId, undefined)
  await assert.rejects(() => markNotificationRead('not-a-uuid'), (error) => error instanceof ApiError && error.status === 400)
})

test('resolveNotificationTarget probes role-specific records and reports deleted records', async () => {
  const application = notificationPayload()
  const interview = notificationPayload({
    type: 'INTERVIEW_INVITED',
    relatedEntityType: 'INTERVIEW',
    relatedEntityId: INTERVIEW_ID,
  })
  const deleted = notificationPayload({ relatedEntityId: MISSING_ID })
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    if (path === `/api/me/applications/${APPLICATION_ID}`) {
      return jsonResponse(200, { application: { id: APPLICATION_ID } })
    }
    if (path === `/api/me/interviews/${INTERVIEW_ID}`) {
      return jsonResponse(200, { interview: { id: INTERVIEW_ID } })
    }
    if (path === `/api/employer/applications/${APPLICATION_ID}`) {
      return jsonResponse(200, { application: { id: APPLICATION_ID } })
    }
    if (path === `/api/employer/interviews/${INTERVIEW_ID}`) {
      return jsonResponse(200, { interview: { id: INTERVIEW_ID } })
    }
    if (path === `/api/me/applications/${MISSING_ID}` || path === `/api/employer/applications/${MISSING_ID}`) {
      return jsonResponse(404, { error: 'Not found' })
    }
    throw new Error(`unexpected ${path}`)
  }

  const studentApp = await resolveNotificationTarget('STUDENT', application)
  const jobSeekerInterview = await resolveNotificationTarget('JOB_SEEKER', interview)
  const employerApp = await resolveNotificationTarget('COMPANY_STAFF', application)
  const employerInterview = await resolveNotificationTarget('COMPANY_STAFF', interview)
  const missingStudent = await resolveNotificationTarget('STUDENT', deleted)
  const missingEmployer = await resolveNotificationTarget('COMPANY_STAFF', deleted)
  const admin = await resolveNotificationTarget('ADMIN', application)

  assert.equal(studentApp.available, true)
  assert.equal(studentApp.path, `/student/applications/${APPLICATION_ID}`)
  assert.equal(jobSeekerInterview.path, `/jobseeker/interviews/${INTERVIEW_ID}`)
  assert.equal(employerApp.path, `/employer/applicants/${APPLICATION_ID}`)
  assert.equal(employerInterview.path, `/employer/interviews/${INTERVIEW_ID}`)
  assert.equal(missingStudent.available, false)
  assert.equal(missingStudent.message, RELATED_RECORD_UNAVAILABLE)
  assert.equal(missingEmployer.message, RELATED_RECORD_UNAVAILABLE)
  assert.equal(admin.available, false)
  assert.equal(admin.message, ADMIN_RELATED_UNAVAILABLE)
  assert.equal(calls.includes(`/api/admin/applications/${APPLICATION_ID}`), false)
})

test('user-facing notification errors stay specific and do not leak secrets', () => {
  assert.equal(userFacingNotificationError(new ApiError('Unauthenticated', 401)), 'Sign in again to view notifications.')
  assert.equal(userFacingNotificationError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(userFacingNotificationError(new ApiError('Forbidden', 403)).includes('cannot manage'), true)
  assert.equal(userFacingNotificationError(new ApiError('Not found', 404)), 'This notification is not available.')
  assert.equal(userFacingNotificationError(new ApiError('secret-dsn', 500)), NOTIFICATIONS_UNAVAILABLE)
})

test('list fetch surfaces API failures without mock fallback', async () => {
  globalThis.fetch = async () => jsonResponse(500, { error: 'database exploded' })
  await assert.rejects(
    () => fetchNotifications({ page: 1, limit: 20 }),
    (error) => error instanceof ApiError && error.message === NOTIFICATIONS_UNAVAILABLE,
  )
  await assert.rejects(
    () => fetchUnreadNotificationCount(),
    (error) => error instanceof ApiError && error.message === NOTIFICATIONS_UNAVAILABLE,
  )
})

test('notification UI is live, reusable across roles, and has no mock fallback', () => {
  const api = readFileSync(fileURLToPath(new URL('./notifications.js', import.meta.url)), 'utf8')
  const page = readFileSync(fileURLToPath(new URL('../pages/shared/NotificationsPage.jsx', import.meta.url)), 'utf8')
  const bell = readFileSync(fileURLToPath(new URL('../components/notifications/NotificationBell.jsx', import.meta.url)), 'utf8')
  const list = readFileSync(fileURLToPath(new URL('../components/notifications/NotificationList.jsx', import.meta.url)), 'utf8')
  const header = readFileSync(fileURLToPath(new URL('../components/layout/TopHeader.jsx', import.meta.url)), 'utf8')
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
  const candidateLayout = readFileSync(fileURLToPath(new URL('../components/layout/CandidateLayout.jsx', import.meta.url)), 'utf8')
  const employerLayout = readFileSync(fileURLToPath(new URL('../components/layout/EmployerLayout.jsx', import.meta.url)), 'utf8')
  const adminLayout = readFileSync(fileURLToPath(new URL('../components/layout/AdminLayout.jsx', import.meta.url)), 'utf8')

  assert.equal(api.includes('recipientUserId'), false)
  assert.equal(api.includes('setInterval'), false)
  assert.equal(bell.includes('fetchUnreadNotificationCount'), true)
  assert.equal(bell.includes('formatUnreadBadge'), true)
  assert.equal(bell.includes("setLoading(true)"), true)
  assert.equal(bell.includes('aria-label'), true)
  assert.equal(bell.includes('Mark all as read'), true)
  assert.equal(bell.includes('setInterval'), false)
  assert.equal(page.includes('fetchNotifications'), true)
  assert.equal(page.includes('unread'), true)
  assert.equal(page.includes('PaginationBar'), true)
  assert.equal(page.includes('markNotificationRead'), true)
  assert.equal(page.includes('markAllNotificationsRead'), true)
  assert.equal(page.includes('resolveNotificationTarget'), true)
  assert.equal(page.includes('NOTIFICATIONS_CHANGED_EVENT'), true)
  assert.equal(bell.includes('NOTIFICATIONS_CHANGED_EVENT'), true)
  assert.equal(bell.includes('Escape'), true)
  assert.equal(page.includes('onRetry'), true)
  assert.equal(page.includes(NOTIFICATION_EMPTY.title) || page.includes('NOTIFICATION_EMPTY'), true)
  assert.equal(page.includes(NOTIFICATION_UNREAD_EMPTY.title) || page.includes('NOTIFICATION_UNREAD_EMPTY'), true)
  assert.equal(page.includes('items = []'), false)
  assert.equal(page.includes('data/notifications'), false)
  assert.equal(list.includes('Unread'), true)
  assert.equal(header.includes('NotificationBell'), true)
  assert.equal(app.includes('data/notifications'), false)
  assert.equal(app.includes('studentNotifications'), false)
  assert.equal(app.includes('jobSeekerNotifications'), false)
  assert.equal(app.includes('employerNotifications'), false)
  assert.equal(app.includes('adminNotifications'), false)
  assert.equal(app.includes('<NotificationsPage />'), true)
  assert.equal(candidateLayout.includes('notificationTo={`${base}/notifications`}'), true)
  assert.equal(employerLayout.includes('notificationTo="/employer/notifications"'), true)
  assert.equal(adminLayout.includes('notificationTo="/admin/notifications"'), true)
})
