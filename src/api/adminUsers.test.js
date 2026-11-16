import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ApiError, clearCsrfToken } from './client.js'
import {
  CANNOT_SUSPEND_SELF,
  fetchAdminUser,
  fetchAdminUsers,
  updateAdminUserStatus,
} from './adminUsers.js'

const originalFetch = globalThis.fetch
const USER_ID = '33333333-3333-4333-8333-333333333333'

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

test('fetchAdminUsers maps the paged PostgreSQL catalogue', async () => {
  globalThis.fetch = async (path) => {
    assert.equal(path, '/api/admin/users?q=aisyah&role=STUDENT&page=1&limit=20')
    return jsonResponse(200, {
      users: [
        {
          id: USER_ID,
          email: 'student@peaceone.demo',
          fullName: 'Aisyah Rahman',
          phone: null,
          role: 'STUDENT',
          accountStatus: 'ACTIVE',
          jobTitle: null,
          createdAt: '2026-11-16T00:00:00.000Z',
          company: null,
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    })
  }
  const page = await fetchAdminUsers({ q: 'aisyah', role: 'STUDENT', page: 1, limit: 20 })
  assert.equal(page.items[0].fullName, 'Aisyah Rahman')
  assert.equal(page.total, 1)
})

test('updateAdminUserStatus patches only accountStatus', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-admin-user' })
    }
    if (path === `/api/admin/users/${USER_ID}/status`) {
      return jsonResponse(200, {
        user: {
          id: USER_ID,
          email: 'student@peaceone.demo',
          fullName: 'Aisyah Rahman',
          phone: null,
          role: 'STUDENT',
          accountStatus: 'SUSPENDED',
          jobTitle: null,
          createdAt: '2026-11-16T00:00:00.000Z',
          company: null,
        },
      })
    }
    throw new Error(`unexpected ${path}`)
  }
  const user = await updateAdminUserStatus(USER_ID, 'SUSPENDED')
  assert.equal(user.accountStatus, 'SUSPENDED')
  const mutate = calls.find((call) => call.path === `/api/admin/users/${USER_ID}/status`)
  assert.equal(JSON.parse(mutate.body).accountStatus, 'SUSPENDED')
})

test('admin user pages do not import static user fixtures', () => {
  for (const relative of ['../pages/admin/Users.jsx', '../pages/admin/UserDetails.jsx']) {
    const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
    assert.equal(source.includes("from '../../data/users.js'"), false, relative)
    assert.equal(source.includes('statusById'), false, relative)
    assert.equal(source.includes('hiddenIds'), false, relative)
  }
  const reports = readFileSync(fileURLToPath(new URL('../pages/admin/Reports.jsx', import.meta.url)), 'utf8')
  const monitoring = readFileSync(fileURLToPath(new URL('../pages/admin/ContentMonitoring.jsx', import.meta.url)), 'utf8')
  assert.equal(reports.includes("from '../../data/adminReports.js'"), false)
  assert.equal(monitoring.includes("from '../../data/adminContentMonitoring.js'"), false)
  assert.equal(fetchAdminUser.name, 'fetchAdminUser')
  assert.equal(CANNOT_SUSPEND_SELF.includes('own account'), true)
})

test('self-suspension API errors stay explicit', async () => {
  globalThis.fetch = async (path) => {
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf' })
    }
    return jsonResponse(409, { error: CANNOT_SUSPEND_SELF })
  }
  await assert.rejects(() => updateAdminUserStatus(USER_ID, 'SUSPENDED'), (error) => (
    error instanceof ApiError && error.message === CANNOT_SUSPEND_SELF
  ))
})
