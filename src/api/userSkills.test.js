import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, clearCsrfToken } from './client.js'
import { formatSkillType } from './esco.js'
import {
  USER_SKILLS_UNAVAILABLE,
  createSavedSkill,
  deleteSavedSkill,
  fetchSavedSkills,
  parseUserSkillList,
  updateSavedSkill,
  userFacingSkillError,
} from './userSkills.js'

const originalFetch = globalThis.fetch
const RECORD_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const SKILL_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

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

function userSkillPayload(overrides = {}) {
  return {
    id: RECORD_ID,
    proficiencyLevel: 'Beginner',
    skill: {
      id: SKILL_ID,
      sourceUri: 'http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2',
      preferredLabel: 'ICT safety',
      skillType: null,
      sourceSystem: 'ESCO',
    },
    ...overrides,
  }
}

test('fetchSavedSkills loads recorded skills from /api/me/skills', async () => {
  globalThis.fetch = async (path, init) => {
    assert.equal(path, '/api/me/skills')
    assert.equal(init.method, 'GET')
    assert.equal(init.headers['x-csrf-token'], undefined)
    return jsonResponse(200, { items: [userSkillPayload()] })
  }

  const items = await fetchSavedSkills()
  assert.equal(items.length, 1)
  assert.equal(items[0].id, RECORD_ID)
  assert.equal(items[0].proficiencyLevel, 'Beginner')
  assert.equal(items[0].skill.preferredLabel, 'ICT safety')
  assert.equal(items[0].skill.skillType, null)
  assert.equal(formatSkillType(items[0].skill.skillType), 'Not classified')
})

test('empty saved-skill lists are valid', () => {
  assert.deepEqual(parseUserSkillList({ items: [] }), [])
})

test('createSavedSkill posts only skillId and proficiency through the CSRF client', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-test-token' })
    }
    return jsonResponse(201, { userSkill: userSkillPayload({ proficiencyLevel: 'Advanced' }) })
  }

  const created = await createSavedSkill({ skillId: SKILL_ID, proficiencyLevel: 'Advanced' })
  assert.equal(created.proficiencyLevel, 'Advanced')
  const mutate = calls.find((call) => call.path === '/api/me/skills' && call.init.method === 'POST')
  assert.ok(mutate)
  assert.equal(mutate.init.headers['x-csrf-token'], 'csrf-test-token')
  assert.deepEqual(JSON.parse(mutate.init.body), { skillId: SKILL_ID, proficiencyLevel: 'Advanced' })
  assert.equal(JSON.parse(mutate.init.body).userId, undefined)
  assert.equal(JSON.parse(mutate.init.body).role, undefined)
})

test('updateSavedSkill patches proficiency only', async () => {
  globalThis.fetch = async (path, init) => {
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-test-token' })
    }
    assert.equal(path, `/api/me/skills/${RECORD_ID}`)
    assert.equal(init.method, 'PATCH')
    assert.deepEqual(JSON.parse(init.body), { proficiencyLevel: 'Intermediate' })
    return jsonResponse(200, { userSkill: userSkillPayload({ proficiencyLevel: 'Intermediate' }) })
  }

  const updated = await updateSavedSkill(RECORD_ID, { proficiencyLevel: 'Intermediate' })
  assert.equal(updated.proficiencyLevel, 'Intermediate')
})

test('deleteSavedSkill removes a recorded skill', async () => {
  globalThis.fetch = async (path, init) => {
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-test-token' })
    }
    assert.equal(path, `/api/me/skills/${RECORD_ID}`)
    assert.equal(init.method, 'DELETE')
    return jsonResponse(200, { ok: true })
  }

  assert.equal(await deleteSavedSkill(RECORD_ID), true)
})

test('load and mutation failures do not fall back to mock records', async () => {
  globalThis.fetch = async () => jsonResponse(500, { error: 'secret-dsn' })
  await assert.rejects(() => fetchSavedSkills(), (error) => error instanceof ApiError)
  assert.equal(userFacingSkillError(new ApiError('secret-dsn', 500)), USER_SKILLS_UNAVAILABLE)
})

test('duplicate, unauthenticated and unavailable errors stay user-facing', async () => {
  globalThis.fetch = async (path) => {
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-test-token' })
    }
    return jsonResponse(409, { error: 'Already recorded' })
  }
  await assert.rejects(() => createSavedSkill({ skillId: SKILL_ID, proficiencyLevel: 'Beginner' }), (error) => {
    return error instanceof ApiError && error.status === 409
  })
  assert.equal(userFacingSkillError(new ApiError('Already recorded', 409)), 'This skill is already recorded.')
  assert.equal(userFacingSkillError(new ApiError('Unauthenticated', 401)), 'Sign in again to manage your recorded skills.')
  assert.equal(userFacingSkillError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(userFacingSkillError(new ApiError('Forbidden', 403)), 'You cannot manage recorded skills with this account.')
})

test('invalid saved-skill payloads are rejected', () => {
  assert.throws(() => parseUserSkillList({ items: 'nope' }), (error) => error instanceof ApiError)
  assert.throws(
    () => parseUserSkillList({ items: [userSkillPayload({ proficiencyLevel: 'Expert' })] }),
    (error) => error instanceof ApiError,
  )
})
