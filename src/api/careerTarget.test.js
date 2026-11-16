import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, clearCsrfToken } from './client.js'
import {
  CAREER_TARGET_EMPTY,
  CAREER_TARGET_UNAVAILABLE,
  careerTargetPath,
  clearCareerTarget,
  fetchCareerTarget,
  parseCareerTarget,
  saveCareerTarget,
  userFacingCareerTargetError,
} from './careerTarget.js'

const originalFetch = globalThis.fetch
const OCCUPATION_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_OCCUPATION_ID = '44444444-4444-4444-8444-444444444444'

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

function occupationSummary(overrides = {}) {
  return {
    id: OCCUPATION_ID,
    sourceUri: 'http://data.europa.eu/esco/occupation/b4bff870-5c8f-4c33-b07f-f04d79830633',
    preferredLabel: 'food service worker',
    sourceSystem: 'ESCO',
    iscoGroup: '5131',
    ...overrides,
  }
}

test('fetchCareerTarget loads a saved occupation from GET /api/me/career-target', async () => {
  globalThis.fetch = async (path, init) => {
    assert.equal(path, '/api/me/career-target')
    assert.equal(init.method, 'GET')
    assert.equal(init.headers['x-csrf-token'], undefined)
    return jsonResponse(200, { occupation: occupationSummary() })
  }

  const occupation = await fetchCareerTarget()
  assert.equal(occupation.id, OCCUPATION_ID)
  assert.equal(occupation.preferredLabel, 'food service worker')
})

test('empty career targets are valid and link to Career Target', () => {
  assert.equal(parseCareerTarget({ occupation: null }), null)
  assert.equal(CAREER_TARGET_EMPTY.title, 'No career target saved yet.')
  assert.equal(CAREER_TARGET_EMPTY.description.includes('official ESCO occupation'), true)
  assert.equal(CAREER_TARGET_EMPTY.description.includes('MASCO occupation codes are a separate Malaysian catalogue'), true)
  assert.equal(careerTargetPath('/student'), '/student/career-target')
  assert.equal(careerTargetPath('/jobseeker'), '/jobseeker/career-target')
})

test('saveCareerTarget puts only occupationId through the CSRF client', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-test-token' })
    }
    return jsonResponse(200, {
      occupation: occupationSummary({ id: OTHER_OCCUPATION_ID, preferredLabel: 'chief ICT security officer' }),
    })
  }

  const saved = await saveCareerTarget(OTHER_OCCUPATION_ID)
  assert.equal(saved.preferredLabel, 'chief ICT security officer')
  const mutate = calls.find((call) => call.path === '/api/me/career-target' && call.init.method === 'PUT')
  assert.ok(mutate)
  assert.equal(mutate.init.headers['x-csrf-token'], 'csrf-test-token')
  assert.deepEqual(JSON.parse(mutate.init.body), { occupationId: OTHER_OCCUPATION_ID })
  assert.equal(JSON.parse(mutate.init.body).userId, undefined)
  assert.equal(JSON.parse(mutate.init.body).role, undefined)
})

test('reload persistence reads the saved occupation again', async () => {
  let stored = null
  globalThis.fetch = async (path, init) => {
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-test-token' })
    }
    if (init.method === 'PUT') {
      stored = occupationSummary()
      return jsonResponse(200, { occupation: stored })
    }
    return jsonResponse(200, { occupation: stored })
  }

  await saveCareerTarget(OCCUPATION_ID)
  const reloaded = await fetchCareerTarget()
  assert.equal(reloaded.id, OCCUPATION_ID)
  assert.equal(reloaded.preferredLabel, 'food service worker')
})

test('loading the catalogue does not persist a career target', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push(init.method)
    return jsonResponse(200, { occupation: null })
  }
  assert.equal(await fetchCareerTarget(), null)
  assert.deepEqual(calls, ['GET'])
})

test('API failures stay user-facing and retry uses GET again', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    return jsonResponse(500, { error: 'secret-dsn' })
  }
  await assert.rejects(() => fetchCareerTarget(), (error) => error instanceof ApiError)
  assert.equal(userFacingCareerTargetError(new ApiError('secret-dsn', 500)), CAREER_TARGET_UNAVAILABLE)
  await assert.rejects(() => fetchCareerTarget(), (error) => error.status === 500)
  assert.deepEqual(calls, ['/api/me/career-target', '/api/me/career-target'])
})

test('temporary Skill Gap selection does not call saveCareerTarget', () => {
  const gapPath = fileURLToPath(new URL('../pages/shared/SkillGapPage.jsx', import.meta.url))
  const careerPath = fileURLToPath(new URL('../pages/shared/CareerTargetPage.jsx', import.meta.url))
  const gap = readFileSync(gapPath, 'utf8')
  const career = readFileSync(careerPath, 'utf8')
  assert.equal(gap.includes('saveCareerTarget'), false)
  assert.equal(gap.includes('fetchCareerTarget'), true)
  assert.equal(gap.includes('Go to Career Target'), true)
  assert.equal(career.includes('didAutoSelect'), false)
  assert.equal(career.includes('saveCareerTarget'), true)
  assert.equal(career.includes('careerTargets'), false)
})

test('unauthenticated and unavailable accounts keep a clear career-target error', () => {
  assert.equal(
    userFacingCareerTargetError(new ApiError('Unauthenticated', 401)),
    'Sign in again to manage your career target.',
  )
  assert.equal(userFacingCareerTargetError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(
    userFacingCareerTargetError(new ApiError('Forbidden', 403)),
    'You cannot manage a career target with this account.',
  )
})

test('clearCareerTarget deletes the saved occupation', async () => {
  globalThis.fetch = async (path, init) => {
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-test-token' })
    }
    assert.equal(path, '/api/me/career-target')
    assert.equal(init.method, 'DELETE')
    return jsonResponse(200, { occupation: null })
  }
  assert.equal(await clearCareerTarget(), null)
})

test('Career Target confirms before clearing and does not touch recorded skills', () => {
  const careerPath = fileURLToPath(new URL('../pages/shared/CareerTargetPage.jsx', import.meta.url))
  const gapPath = fileURLToPath(new URL('../pages/shared/SkillGapPage.jsx', import.meta.url))
  const learningPath = fileURLToPath(new URL('../pages/shared/LearningRecommendationsPage.jsx', import.meta.url))
  const career = readFileSync(careerPath, 'utf8')
  const gap = readFileSync(gapPath, 'utf8')
  const learning = readFileSync(learningPath, 'utf8')
  assert.equal(career.includes('clearCareerTarget'), true)
  assert.equal(career.includes('Confirm clear'), true)
  assert.equal(career.includes('setConfirmClear(true)'), true)
  assert.equal(career.includes('Recorded skills are not removed'), true)
  assert.equal(career.includes('/api/me/skills'), false)
  assert.equal(gap.includes('clearCareerTarget'), false)
  assert.equal(learning.includes('clearCareerTarget'), false)
  assert.equal(learning.includes('Go to Career Target'), true)
})
