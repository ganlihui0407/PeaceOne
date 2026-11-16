import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, clearCsrfToken } from './client.js'
import { educationLevels } from '../data/candidateData.js'
import {
  EDUCATION_LEVELS,
  ME_PROFILE_UNAVAILABLE,
  buildMeProfileUpdate,
  fetchMeProfile,
  isAbortError,
  parseMeProfile,
  updateMeProfile,
  userFacingMeProfileError,
} from './me.js'

const originalFetch = globalThis.fetch
const USER_ID = '11111111-1111-4111-8111-111111111111'

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

function profilePayload(overrides = {}) {
  return {
    id: USER_ID,
    email: 'stage61.student@peaceone.test',
    fullName: 'Stage Six One',
    phone: '012-345 6789',
    role: 'STUDENT',
    accountStatus: 'ACTIVE',
    ...overrides,
  }
}

test('fetchMeProfile loads the authenticated profile from GET /api/me', async () => {
  globalThis.fetch = async (path, init) => {
    assert.equal(path, '/api/me')
    assert.equal(init.method, 'GET')
    assert.equal(init.headers['x-csrf-token'], undefined)
    return jsonResponse(200, { user: profilePayload() })
  }

  const profile = await fetchMeProfile()
  assert.equal(profile.id, USER_ID)
  assert.equal(profile.email, 'stage61.student@peaceone.test')
  assert.equal(profile.fullName, 'Stage Six One')
  assert.equal(profile.phone, '012-345 6789')
  assert.equal(profile.role, 'STUDENT')
  assert.equal(profile.accountStatus, 'ACTIVE')
  assert.equal(profile.educationLevel, null)
  assert.equal(profile.graduationYear, null)
  assert.equal(profile.jobTitle, null)
  assert.equal(profile.passwordHash, undefined)
})

test('updateMeProfile patches only fullName and phone through the CSRF client', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-test-token' })
    }
    return jsonResponse(200, {
      user: profilePayload({ fullName: 'Updated Name', phone: null }),
    })
  }

  const updated = await updateMeProfile({ fullName: 'Updated Name', phone: '' })
  assert.equal(updated.fullName, 'Updated Name')
  assert.equal(updated.phone, null)
  const mutate = calls.find((call) => call.path === '/api/me' && call.init.method === 'PATCH')
  assert.ok(mutate)
  assert.equal(mutate.init.headers['x-csrf-token'], 'csrf-test-token')
  assert.deepEqual(JSON.parse(mutate.init.body), { fullName: 'Updated Name', phone: null })
  assert.equal(JSON.parse(mutate.init.body).userId, undefined)
  assert.equal(JSON.parse(mutate.init.body).role, undefined)
  assert.equal(JSON.parse(mutate.init.body).email, undefined)
  assert.equal(JSON.parse(mutate.init.body).passwordHash, undefined)
})

test('reload persistence reads the saved profile again', async () => {
  let stored = profilePayload()
  globalThis.fetch = async (path, init) => {
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-test-token' })
    }
    if (init.method === 'PATCH') {
      stored = profilePayload({ fullName: 'Persisted Name', phone: '013-000 1111' })
      return jsonResponse(200, { user: stored })
    }
    return jsonResponse(200, { user: stored })
  }

  await updateMeProfile({ fullName: 'Persisted Name', phone: '013-000 1111' })
  const reloaded = await fetchMeProfile()
  assert.equal(reloaded.fullName, 'Persisted Name')
  assert.equal(reloaded.phone, '013-000 1111')
})

test('invalid client updates are rejected without calling the API', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    return jsonResponse(200, { user: profilePayload() })
  }

  await assert.rejects(() => updateMeProfile({}), (error) => error instanceof ApiError && error.status === 400)
  await assert.rejects(
    () => updateMeProfile({ fullName: '' }),
    (error) => error instanceof ApiError && error.status === 400,
  )
  await assert.rejects(
    () => updateMeProfile({ fullName: 'a'.repeat(101) }),
    (error) => error instanceof ApiError && error.status === 400,
  )
  await assert.rejects(
    () => updateMeProfile({ phone: '1'.repeat(31) }),
    (error) => error instanceof ApiError && error.status === 400,
  )
  await assert.rejects(
    () => updateMeProfile({ educationLevel: 'PhD' }),
    (error) => error instanceof ApiError && error.status === 400,
  )
  await assert.rejects(
    () => updateMeProfile({ graduationYear: 1949 }),
    (error) => error instanceof ApiError && error.status === 400,
  )
  await assert.rejects(
    () => updateMeProfile({ graduationYear: '2027' }),
    (error) => error instanceof ApiError && error.status === 400,
  )
  assert.deepEqual(calls, [])
})

test('parsers reject invalid payloads and ignore extra sensitive fields', () => {
  assert.throws(() => parseMeProfile({}), (error) => error instanceof ApiError)
  assert.throws(() => parseMeProfile({ user: profilePayload({ role: 'SUPERADMIN' }) }), (error) => {
    return error instanceof ApiError
  })
  const parsed = parseMeProfile({
    user: {
      ...profilePayload(),
      passwordHash: '$2b$12$not-a-real-hash',
      targetOccupationId: '22222222-2222-4222-8222-222222222222',
    },
  })
  assert.equal(parsed.passwordHash, undefined)
  assert.equal(parsed.targetOccupationId, undefined)
  assert.equal(parsed.phone, '012-345 6789')
  assert.equal(parsed.educationLevel, null)
  assert.equal(parsed.graduationYear, null)
  assert.equal(parseMeProfile({ user: profilePayload({ phone: null }) }).phone, null)
  assert.equal(
    parseMeProfile({ user: profilePayload({ educationLevel: 'Bachelor' }) }).educationLevel,
    "Bachelor's Degree",
  )
  assert.throws(
    () => parseMeProfile({ user: profilePayload({ educationLevel: 'PhD' }) }),
    (error) => error instanceof ApiError,
  )
  assert.throws(
    () => parseMeProfile({ user: profilePayload({ graduationYear: '2027' }) }),
    (error) => error instanceof ApiError,
  )
})

test('API errors stay user-facing and aborted requests are ignored', async () => {
  globalThis.fetch = async () => jsonResponse(500, { error: 'secret-dsn' })
  await assert.rejects(() => fetchMeProfile(), (error) => error instanceof ApiError)
  assert.equal(userFacingMeProfileError(new ApiError('secret-dsn', 500)), ME_PROFILE_UNAVAILABLE)
  assert.equal(userFacingMeProfileError(new ApiError('Unauthenticated', 401)), 'Sign in again to manage your profile.')
  assert.equal(userFacingMeProfileError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(userFacingMeProfileError(new ApiError('Forbidden', 403)), 'You cannot manage this profile with this account.')
  assert.equal(userFacingMeProfileError(new ApiError('Invalid request', 400)), 'Invalid request')

  const controller = new AbortController()
  globalThis.fetch = async (_path, init) => {
    if (init.signal?.aborted) {
      const error = new Error('Aborted')
      error.name = 'AbortError'
      throw error
    }
    return jsonResponse(200, { user: profilePayload() })
  }
  controller.abort()
  await assert.rejects(() => fetchMeProfile({ signal: controller.signal }), (error) => isAbortError(error))
  assert.equal(userFacingMeProfileError({ name: 'AbortError' }), '')
})

test('buildMeProfileUpdate omits empty updates and protected fields', () => {
  assert.deepEqual(buildMeProfileUpdate({ fullName: '  Ada  ', phone: '  012  ' }), {
    fullName: 'Ada',
    phone: '012',
  })
  assert.deepEqual(buildMeProfileUpdate({ phone: '   ' }), { phone: null })
  const body = buildMeProfileUpdate({
    fullName: 'Ada',
    role: 'ADMIN',
    email: 'hijacked@peaceone.test',
    passwordHash: 'secret',
  })
  assert.deepEqual(body, { fullName: 'Ada' })
  assert.equal(body.role, undefined)
  assert.equal(body.email, undefined)
  assert.equal(body.passwordHash, undefined)
})

test('educationLevel options match the existing profile UI', () => {
  assert.deepEqual(EDUCATION_LEVELS, educationLevels)
})

test('updateMeProfile can send candidate and staff extended fields', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-test-token' })
    }
    return jsonResponse(200, {
      user: profilePayload({
        educationLevel: "Bachelor's Degree",
        fieldOfStudy: 'Information Systems',
        institution: 'Universiti Malaya',
        graduationYear: 2027,
        location: 'Kuala Lumpur',
        experienceSummary: 'Internship reporting.',
      }),
    })
  }

  const updated = await updateMeProfile({
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Information Systems',
    institution: 'Universiti Malaya',
    graduationYear: 2027,
    location: 'Kuala Lumpur',
    experienceSummary: 'Internship reporting.',
  })
  assert.equal(updated.educationLevel, "Bachelor's Degree")
  assert.equal(updated.graduationYear, 2027)
  const mutate = calls.find((call) => call.path === '/api/me' && call.init.method === 'PATCH')
  assert.ok(mutate)
  assert.deepEqual(JSON.parse(mutate.init.body), {
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Information Systems',
    institution: 'Universiti Malaya',
    graduationYear: 2027,
    location: 'Kuala Lumpur',
    experienceSummary: 'Internship reporting.',
  })
})

test('candidate, staff and admin profile pages load and save through /api/me', () => {
  const profilePage = readFileSync(fileURLToPath(new URL('../pages/shared/ProfilePage.jsx', import.meta.url)), 'utf8')
  const staffPage = readFileSync(fileURLToPath(new URL('../pages/employer/StaffProfile.jsx', import.meta.url)), 'utf8')
  const adminPage = readFileSync(fileURLToPath(new URL('../pages/admin/Profile.jsx', import.meta.url)), 'utf8')
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
  const hook = readFileSync(fileURLToPath(new URL('../hooks/useMeProfileForm.js', import.meta.url)), 'utf8')

  for (const source of [profilePage, staffPage, adminPage]) {
    assert.equal(source.includes('useMeProfileForm'), true)
    assert.equal(source.includes('studentProfile'), false)
    assert.equal(source.includes('jobSeekerProfile'), false)
    assert.equal(source.includes('employerStaff'), false)
    assert.equal(source.includes('adminProfile'), false)
    assert.equal(source.includes('Emily Tan'), false)
    assert.equal(source.includes('passwordHash'), false)
  }

  assert.equal(profilePage.includes('education-level'), true)
  assert.equal(profilePage.includes('graduation-year'), true)
  assert.equal(staffPage.includes('staff-position'), true)
  assert.equal(staffPage.includes("updateField('jobTitle'"), false)
  assert.equal(staffPage.includes('useStaffPositionChangeRequests'), true)
  assert.equal(staffPage.includes("updateField('location'"), true)
  assert.equal(staffPage.includes("updateField('department'"), true)
  assert.equal(staffPage.includes('staff-location'), true)
  assert.equal(staffPage.includes('education-level'), false)
  assert.equal(adminPage.includes('education-level'), false)
  assert.equal(adminPage.includes('staff-position'), false)
  assert.equal(adminPage.includes('admin-name'), true)
  assert.equal(hook.includes('fetchMeProfile'), true)
  assert.equal(hook.includes('updateMeProfile'), true)
  assert.equal(hook.includes('profileFormToUpdate'), true)
  assert.equal(hook.includes("setSaveError(userFacingMeProfileError(error))"), true)
  assert.equal(hook.includes('setForm(profileToFormValues(updated))'), true)
  assert.equal(app.includes('profile={studentProfile}'), false)
  assert.equal(app.includes('profile={jobSeekerProfile}'), false)
  assert.equal(app.includes('from \'./data/candidateData.js\''), false)
})

test('company profile and career workflow stay disconnected from /api/me', () => {
  const files = [
    '../pages/employer/CompanyProfile.jsx',
    '../pages/shared/CareerTargetPage.jsx',
    '../pages/shared/SkillGapPage.jsx',
    '../pages/shared/SkillsPage.jsx',
  ].map((relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'))

  for (const source of files) {
    assert.equal(source.includes('fetchMeProfile'), false)
    assert.equal(source.includes('updateMeProfile'), false)
    assert.equal(source.includes('useMeProfileForm'), false)
    assert.equal(source.includes("from '../../api/me.js'"), false)
  }
})
