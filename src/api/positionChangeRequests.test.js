import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, clearCsrfToken } from './client.js'
import { isAbortError } from './esco.js'
import {
  ALREADY_REVIEWED,
  PENDING_EXISTS,
  POSITION_CHANGE_UNAVAILABLE,
  approvePositionChangeRequest,
  createStaffPositionChangeRequest,
  fetchAdminPositionChangeRequest,
  fetchAdminPositionChangeRequests,
  fetchStaffPositionChangeRequests,
  formatPositionChangeStatus,
  hasPendingPositionChangeRequest,
  isPositionChangeRequestId,
  parsePositionChangeRequest,
  positionChangeRequestPath,
  positionChangeRequestsPath,
  rejectPositionChangeRequest,
  userFacingPositionChangeError,
} from './positionChangeRequests.js'

const originalFetch = globalThis.fetch
const REQUEST_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const STAFF_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_ID = '22222222-2222-4222-8222-222222222222'

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

function requestPayload(overrides = {}) {
  return {
    id: REQUEST_ID,
    currentPosition: 'Talent Partner',
    requestedPosition: 'Hiring Manager',
    reason: 'Expanded hiring scope.',
    status: 'PENDING',
    reviewNote: null,
    reviewedAt: null,
    createdAt: '2026-11-13T02:00:00.000Z',
    updatedAt: '2026-11-13T02:00:00.000Z',
    user: {
      id: STAFF_ID,
      fullName: 'Stage Six Six Staff',
      email: 'stage66.staff@peaceone.test',
      jobTitle: 'Talent Partner',
    },
    reviewer: null,
    ...overrides,
  }
}

test('fetchStaffPositionChangeRequests loads only the signed-in staff list', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    if (path === '/api/me/position-change-requests') {
      return jsonResponse(200, { items: [requestPayload()] })
    }
    throw new Error(`unexpected ${path}`)
  }

  const items = await fetchStaffPositionChangeRequests()
  assert.equal(items.length, 1)
  assert.equal(items[0].requestedPosition, 'Hiring Manager')
  assert.equal(items[0].status, 'PENDING')
  assert.deepEqual(calls, [{ path: '/api/me/position-change-requests', method: 'GET' }])
  assert.equal(hasPendingPositionChangeRequest(items), true)
})

test('createStaffPositionChangeRequest posts requested position and reason through CSRF', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body, headers: init.headers })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-test' })
    }
    if (path === '/api/me/position-change-requests') {
      return jsonResponse(201, { request: requestPayload() })
    }
    throw new Error(`unexpected ${path}`)
  }

  const created = await createStaffPositionChangeRequest({
    requestedPosition: 'Hiring Manager',
    reason: 'Expanded hiring scope.',
    userId: 'other-user',
  })
  assert.equal(created.id, REQUEST_ID)
  const mutate = calls.find((call) => call.path === '/api/me/position-change-requests' && call.method === 'POST')
  assert.equal(mutate.headers['x-csrf-token'], 'csrf-test')
  assert.deepEqual(JSON.parse(mutate.body), {
    requestedPosition: 'Hiring Manager',
    reason: 'Expanded hiring scope.',
  })
})

test('admin list, details, approve and reject use the admin API only', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-admin' })
    }
    if (path.startsWith('/api/admin/position-change-requests?')) {
      return jsonResponse(200, {
        items: [requestPayload()],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      })
    }
    if (path === `/api/admin/position-change-requests/${REQUEST_ID}`) {
      return jsonResponse(200, { request: requestPayload() })
    }
    if (path === `/api/admin/position-change-requests/${REQUEST_ID}/approve`) {
      return jsonResponse(200, {
        request: requestPayload({
          status: 'APPROVED',
          reviewNote: 'Approved.',
          reviewedAt: '2026-11-13T03:00:00.000Z',
          reviewer: { id: ADMIN_ID, fullName: 'Admin', email: 'admin@peaceone.test' },
        }),
      })
    }
    if (path === `/api/admin/position-change-requests/${REQUEST_ID}/reject`) {
      return jsonResponse(200, {
        request: requestPayload({
          status: 'REJECTED',
          reviewNote: 'Need more detail.',
          reviewedAt: '2026-11-13T03:05:00.000Z',
          reviewer: { id: ADMIN_ID, fullName: 'Admin', email: 'admin@peaceone.test' },
        }),
      })
    }
    throw new Error(`unexpected ${path}`)
  }

  const listed = await fetchAdminPositionChangeRequests({ q: 'staff', status: 'PENDING', page: 1, limit: 20 })
  assert.equal(listed.total, 1)
  assert.equal(listed.items[0].id, REQUEST_ID)
  const details = await fetchAdminPositionChangeRequest(REQUEST_ID)
  assert.equal(details.reason, 'Expanded hiring scope.')
  const approved = await approvePositionChangeRequest(REQUEST_ID, { reviewNote: 'Approved.' })
  assert.equal(approved.status, 'APPROVED')
  const rejected = await rejectPositionChangeRequest(REQUEST_ID, { reviewNote: 'Need more detail.' })
  assert.equal(rejected.status, 'REJECTED')
  assert.equal(
    calls.some((call) => call.path === '/api/admin/position-change-requests?q=staff&status=PENDING&page=1&limit=20'),
    true,
  )
  assert.equal(isPositionChangeRequestId(REQUEST_ID), true)
  assert.equal(isPositionChangeRequestId('not-a-id'), false)
  await assert.rejects(() => fetchAdminPositionChangeRequest('nope'), (error) => error.status === 400)
})

test('parsers reject invented statuses and user-facing errors stay specific', () => {
  assert.throws(() => parsePositionChangeRequest(requestPayload({ status: 'DONE' })), (error) => {
    return error instanceof ApiError && error.message === POSITION_CHANGE_UNAVAILABLE
  })
  assert.equal(formatPositionChangeStatus('PENDING'), 'Pending')
  assert.equal(userFacingPositionChangeError(new ApiError('Unauthenticated', 401)).includes('Sign in'), true)
  assert.equal(userFacingPositionChangeError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(userFacingPositionChangeError(new ApiError(PENDING_EXISTS, 409)).includes('pending'), true)
  assert.equal(userFacingPositionChangeError(new ApiError(ALREADY_REVIEWED, 409)).includes('already been reviewed'), true)
  assert.equal(userFacingPositionChangeError(new ApiError('secret-dsn', 500)), POSITION_CHANGE_UNAVAILABLE)
})

test('staff and admin pages wire the live workflow and keep other roles out', () => {
  const staffPage = readFileSync(fileURLToPath(new URL('../pages/employer/StaffProfile.jsx', import.meta.url)), 'utf8')
  const adminList = readFileSync(
    fileURLToPath(new URL('../pages/admin/PositionChangeRequests.jsx', import.meta.url)),
    'utf8',
  )
  const adminDetails = readFileSync(
    fileURLToPath(new URL('../pages/admin/PositionChangeRequestDetails.jsx', import.meta.url)),
    'utf8',
  )
  const hook = readFileSync(
    fileURLToPath(new URL('../hooks/useStaffPositionChangeRequests.js', import.meta.url)),
    'utf8',
  )
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
  const nav = readFileSync(fileURLToPath(new URL('../data/navigation.js', import.meta.url)), 'utf8')
  const student = readFileSync(fileURLToPath(new URL('../pages/shared/ProfilePage.jsx', import.meta.url)), 'utf8')
  const adminProfile = readFileSync(fileURLToPath(new URL('../pages/admin/Profile.jsx', import.meta.url)), 'utf8')

  assert.equal(staffPage.includes('useStaffPositionChangeRequests'), true)
  assert.equal(staffPage.includes('Submit Position Change Request'), true)
  assert.equal(staffPage.includes("updateField('jobTitle'"), false)
  assert.equal(staffPage.includes('Request history'), true)
  assert.equal(hook.includes('createStaffPositionChangeRequest'), true)
  assert.equal(hook.includes('fetchStaffPositionChangeRequests'), true)
  assert.equal(adminList.includes('fetchAdminPositionChangeRequests'), true)
  assert.equal(adminDetails.includes('approvePositionChangeRequest'), true)
  assert.equal(adminDetails.includes('rejectPositionChangeRequest'), true)
  assert.equal(adminDetails.includes('Review note'), true)
  assert.equal(app.includes('path="position-requests"'), true)
  assert.equal(app.includes('path="position-requests/:requestId"'), true)
  assert.equal(app.includes("roles={['ADMIN']}"), true)
  assert.equal(app.includes("roles={['COMPANY_STAFF']}"), true)
  assert.equal(nav.includes("to: '/admin/position-requests'"), true)
  assert.equal(nav.includes("to: '/student/position-requests'"), false)
  assert.equal(student.includes('useStaffPositionChangeRequests'), false)
  assert.equal(adminProfile.includes('useStaffPositionChangeRequests'), false)
  assert.equal(positionChangeRequestsPath(), '/admin/position-requests')
  assert.equal(positionChangeRequestPath(REQUEST_ID), `/admin/position-requests/${REQUEST_ID}`)
})

test('API failures stay user-facing and aborted requests are ignored', async () => {
  globalThis.fetch = async () => jsonResponse(500, { error: 'secret-dsn' })
  await assert.rejects(() => fetchStaffPositionChangeRequests(), (error) => error instanceof ApiError)
  const controller = new AbortController()
  globalThis.fetch = async (_path, init) => {
    assert.equal(init.signal, controller.signal)
    const error = new Error('aborted')
    error.name = 'AbortError'
    throw error
  }
  controller.abort()
  await assert.rejects(
    () => fetchStaffPositionChangeRequests({ signal: controller.signal }),
    (error) => isAbortError(error),
  )
})
