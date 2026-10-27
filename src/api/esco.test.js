import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { ApiError } from './client.js'
import {
  ESCO_UNAVAILABLE,
  buildSearchParams,
  createRequestSequence,
  fetchOccupation,
  fetchOccupationByUri,
  fetchOccupationSkills,
  fetchOccupations,
  fetchSkills,
  formatRelationType,
  formatSkillType,
  isAbortError,
  parseOccupationSkillItem,
  parsePagedList,
  parseSkillSummary,
  userFacingLoadError,
} from './esco.js'

const originalFetch = globalThis.fetch
const OCCUPATION_ID = '11111111-1111-4111-8111-111111111111'
const SKILL_ID = '22222222-2222-4222-8222-222222222222'

afterEach(() => {
  globalThis.fetch = originalFetch
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

function skillSummary(overrides = {}) {
  return {
    id: SKILL_ID,
    sourceUri: 'http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2',
    preferredLabel: 'ICT safety',
    skillType: 'knowledge',
    sourceSystem: 'ESCO',
    ...overrides,
  }
}

test('buildSearchParams omits empty values and encodes search text', () => {
  assert.equal(buildSearchParams({ q: 'food service', page: 2, limit: 20, iscoGroup: '' }), '?q=food+service&page=2&limit=20')
})

test('fetchOccupations uses the relative /api proxy path with search and pagination', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    return jsonResponse(200, {
      items: [occupationSummary()],
      page: 2,
      limit: 20,
      total: 41,
      totalPages: 3,
    })
  }

  const result = await fetchOccupations({ q: 'food', page: 2, limit: 20 })
  assert.equal(calls[0].path, '/api/occupations?q=food&page=2&limit=20')
  assert.equal(calls[0].method, 'GET')
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].preferredLabel, 'food service worker')
  assert.equal(result.page, 2)
  assert.equal(result.totalPages, 3)
})

test('fetchOccupations rejects invalid list payloads instead of using mock data', async () => {
  globalThis.fetch = async () => jsonResponse(200, { items: 'nope', page: 1, limit: 20, total: 1, totalPages: 1 })
  await assert.rejects(() => fetchOccupations(), (error) => {
    return error instanceof ApiError && error.message === ESCO_UNAVAILABLE.occupations
  })
})

test('fetchOccupation loads details by id', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    return jsonResponse(200, {
      occupation: {
        ...occupationSummary(),
        description: 'Serve food and drinks.',
        status: 'released',
      },
    })
  }

  const occupation = await fetchOccupation(OCCUPATION_ID)
  assert.equal(calls[0], `/api/occupations/${OCCUPATION_ID}`)
  assert.equal(occupation.description, 'Serve food and drinks.')
  assert.equal(occupation.status, 'released')
})

test('fetchOccupationByUri uses the documented URI endpoint', async () => {
  const uri = 'http://data.europa.eu/esco/occupation/b4bff870-5c8f-4c33-b07f-f04d79830633'
  globalThis.fetch = async (path) => {
    assert.equal(path, `/api/occupations/by-uri?uri=${encodeURIComponent(uri)}`)
    return jsonResponse(200, { occupation: occupationSummary() })
  }
  const occupation = await fetchOccupationByUri(uri)
  assert.equal(occupation.id, OCCUPATION_ID)
})

test('fetchOccupationSkills distinguishes essential and optional relations', async () => {
  globalThis.fetch = async (path) => {
    assert.equal(path, `/api/occupations/${OCCUPATION_ID}/skills?page=1&limit=20&relationType=essential`)
    return jsonResponse(200, {
      items: [
        { relationType: 'essential', skill: skillSummary({ preferredLabel: 'food hygiene' }) },
        { relationType: 'optional', skill: skillSummary({ id: '33333333-3333-4333-8333-333333333333', preferredLabel: 'wine pairing' }) },
      ],
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    })
  }

  const result = await fetchOccupationSkills(OCCUPATION_ID, { page: 1, limit: 20, relationType: 'essential' })
  assert.equal(formatRelationType(result.items[0].relationType), 'Essential')
  assert.equal(formatRelationType(result.items[1].relationType), 'Optional')
})

test('null skillType is shown as not classified and unknown relations stay unknown', () => {
  const item = parseOccupationSkillItem({
    relationType: null,
    skill: skillSummary({ skillType: null }),
  })
  assert.equal(item.skill.skillType, null)
  assert.equal(formatSkillType(item.skill.skillType), 'Not classified')
  assert.equal(formatSkillType(''), 'Not classified')
  assert.equal(formatRelationType(item.relationType), 'Unknown')
  assert.equal(formatSkillType('knowledge'), 'knowledge')
})

test('fetchSkills uses the relative /api proxy path', async () => {
  globalThis.fetch = async (path) => {
    assert.equal(path, '/api/skills?q=safety&page=1&limit=20&skillType=null')
    return jsonResponse(200, {
      items: [skillSummary({ skillType: null })],
      page: 1,
      limit: 20,
      total: 5,
      totalPages: 1,
    })
  }

  const result = await fetchSkills({ q: 'safety', page: 1, limit: 20, skillType: 'null' })
  assert.equal(result.items[0].skillType, null)
  assert.equal(formatSkillType(result.items[0].skillType), 'Not classified')
  assert.equal(result.total, 5)
})

test('empty occupation and skill lists are valid responses', () => {
  const occupations = parsePagedList(
    { items: [], page: 1, limit: 20, total: 0, totalPages: 0 },
    (item) => item,
    ESCO_UNAVAILABLE.occupations,
  )
  const skills = parsePagedList(
    { items: [], page: 1, limit: 20, total: 0, totalPages: 0 },
    parseSkillSummary,
    ESCO_UNAVAILABLE.skills,
  )
  assert.equal(occupations.items.length, 0)
  assert.equal(skills.total, 0)
})

test('API errors do not leak internal details and do not fall back to mock records', async () => {
  globalThis.fetch = async () => jsonResponse(500, { error: 'ECONNRESET secret-dsn' })
  await assert.rejects(() => fetchOccupations(), (error) => error instanceof ApiError && error.message === 'ECONNRESET secret-dsn')
  assert.equal(userFacingLoadError(new ApiError('ECONNRESET secret-dsn', 500), ESCO_UNAVAILABLE.occupations), ESCO_UNAVAILABLE.occupations)
  assert.equal(userFacingLoadError(new ApiError('Not found', 404), ESCO_UNAVAILABLE.occupation), 'Not found')
})

test('aborted occupation searches are ignored as stale', async () => {
  const controller = new AbortController()
  globalThis.fetch = async (_path, init) => {
    if (init.signal?.aborted) {
      const error = new Error('Aborted')
      error.name = 'AbortError'
      throw error
    }
    return jsonResponse(200, { items: [], page: 1, limit: 20, total: 0, totalPages: 0 })
  }
  controller.abort()
  await assert.rejects(() => fetchOccupations({ q: 'food', signal: controller.signal }), (error) => isAbortError(error))
  assert.equal(userFacingLoadError({ name: 'AbortError' }, ESCO_UNAVAILABLE.occupations), '')
})

test('request sequence ignores stale search results', () => {
  const sequence = createRequestSequence()
  const first = sequence.next()
  const second = sequence.next()
  assert.equal(sequence.isCurrent(first), false)
  assert.equal(sequence.isCurrent(second), true)
})
