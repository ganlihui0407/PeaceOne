import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError } from './client.js'
import {
  EMPTY_LEARNING_RECOMMENDATIONS,
  LEARNING_ALL_RECORDED,
  LEARNING_DISCLAIMER,
  LEARNING_NO_RECORDED,
  LEARNING_NO_TARGET,
  LEARNING_UNAVAILABLE,
  buildLearningRecommendations,
  fetchLearningRecommendations,
  learningCareerTargetPath,
  learningSkillGapPath,
  learningSkillsPath,
  userFacingLearningError,
} from './learningRecommendations.js'
import { parseSkillGapResult } from './skillGap.js'

const originalFetch = globalThis.fetch
const OCCUPATION_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_OCCUPATION_ID = '44444444-4444-4444-8444-444444444444'
const SKILL_ID = '22222222-2222-4222-8222-222222222222'
const OPTIONAL_SKILL_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_ESSENTIAL_ID = '55555555-5555-4555-8555-555555555555'

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
    sourceUri: 'http://data.europa.eu/esco/occupation/276ba420-ef09-4a0e-b215-2c2e2f80ad28',
    preferredLabel: 'chief ICT security officer',
    sourceSystem: 'ESCO',
    iscoGroup: '1330',
    ...overrides,
  }
}

function skillSummary(overrides = {}) {
  return {
    id: SKILL_ID,
    sourceUri: 'http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2',
    preferredLabel: 'ICT safety',
    skillType: null,
    sourceSystem: 'ESCO',
    ...overrides,
  }
}

function gapPayload(overrides = {}) {
  return {
    occupation: occupationSummary(),
    recordedSkillCount: 1,
    totals: {
      relations: 3,
      essential: { total: 2, recorded: 1, notRecorded: 1 },
      optional: { total: 1, recorded: 0, notRecorded: 1 },
    },
    items: [
      {
        relationType: 'optional',
        recorded: false,
        proficiencyLevel: null,
        skill: skillSummary({
          id: OPTIONAL_SKILL_ID,
          preferredLabel: 'zebra planning',
          sourceUri: 'http://data.europa.eu/esco/skill/optional-zebra',
        }),
      },
      {
        relationType: 'essential',
        recorded: false,
        proficiencyLevel: null,
        skill: skillSummary({
          id: OTHER_ESSENTIAL_ID,
          preferredLabel: 'network security',
          sourceUri: 'http://data.europa.eu/esco/skill/essential-network',
        }),
      },
      {
        relationType: 'essential',
        recorded: true,
        proficiencyLevel: 'Beginner',
        skill: skillSummary(),
      },
    ],
    ...overrides,
  }
}

test('fetchLearningRecommendations loads the saved target then the real skill gap', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    if (path === '/api/me/career-target') {
      return jsonResponse(200, { occupation: occupationSummary() })
    }
    if (path === `/api/me/skill-gap?occupationId=${OCCUPATION_ID}`) {
      return jsonResponse(200, gapPayload())
    }
    throw new Error(`unexpected ${path}`)
  }

  const result = await fetchLearningRecommendations()
  assert.deepEqual(calls, [
    { path: '/api/me/career-target', method: 'GET' },
    { path: `/api/me/skill-gap?occupationId=${OCCUPATION_ID}`, method: 'GET' },
  ])
  assert.equal(result.occupation.preferredLabel, 'chief ICT security officer')
  assert.equal(result.status, 'ready')
  assert.equal(result.topics.length, 2)
  assert.equal(result.topics[0].skill.preferredLabel, 'network security')
  assert.equal(result.topics[0].relationType, 'essential')
  assert.equal(result.topics[1].skill.preferredLabel, 'zebra planning')
  assert.equal(result.topics[1].relationType, 'optional')
  assert.equal(result.recordedTopics.length, 1)
  assert.equal(result.recordedTopics[0].proficiencyLevel, 'Beginner')
})

test('an empty career target does not load skill-gap recommendations', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    return jsonResponse(200, { occupation: null })
  }

  const result = await fetchLearningRecommendations()
  assert.deepEqual(calls, ['/api/me/career-target'])
  assert.deepEqual(result, EMPTY_LEARNING_RECOMMENDATIONS)
  assert.equal(learningCareerTargetPath('/student'), '/student/career-target')
  assert.equal(LEARNING_NO_TARGET.title, 'No career target saved yet.')
})

test('unrecorded essential skills are recommended before optional skills', () => {
  const result = buildLearningRecommendations(parseSkillGapResult(gapPayload()))
  assert.deepEqual(
    result.topics.map((topic) => topic.relationType),
    ['essential', 'optional'],
  )
  assert.equal(result.topics[0].occupation.preferredLabel, 'chief ICT security officer')
  assert.equal(result.topics[0].skill.sourceUri.includes('data.europa.eu/esco/skill'), true)
  assert.match(result.topics[0].rationale, /essential skill/)
  assert.match(result.topics[0].rationale, /not mean you lack the skill/)
  assert.match(result.topics[1].rationale, /optional skill/)
  assert.equal(result.topics[0].learningGoals.length, 3)
})

test('recommendations update when the skill-gap payload changes', () => {
  const first = buildLearningRecommendations(parseSkillGapResult(gapPayload()))
  const second = buildLearningRecommendations(
    parseSkillGapResult(
      gapPayload({
        occupation: occupationSummary({
          id: OTHER_OCCUPATION_ID,
          preferredLabel: 'food service worker',
          sourceUri: 'http://data.europa.eu/esco/occupation/b4bff870-5c8f-4c33-b07f-f04d79830633',
        }),
        recordedSkillCount: 0,
        totals: {
          relations: 1,
          essential: { total: 1, recorded: 0, notRecorded: 1 },
          optional: { total: 0, recorded: 0, notRecorded: 0 },
        },
        items: [
          {
            relationType: 'essential',
            recorded: false,
            proficiencyLevel: null,
            skill: skillSummary({ preferredLabel: 'maintain kitchen sanitation' }),
          },
        ],
      }),
    ),
  )
  assert.equal(first.occupation.preferredLabel, 'chief ICT security officer')
  assert.equal(second.occupation.preferredLabel, 'food service worker')
  assert.equal(second.status, 'no-recorded-skills')
  assert.equal(second.topics[0].skill.preferredLabel, 'maintain kitchen sanitation')
  assert.equal(second.recordedTopics.length, 0)
  assert.equal(LEARNING_NO_RECORDED.title.includes('No skills recorded'), true)
})

test('all-recorded occupations produce an empty topic list without a score', () => {
  const result = buildLearningRecommendations(
    parseSkillGapResult(
      gapPayload({
        recordedSkillCount: 1,
        totals: {
          relations: 1,
          essential: { total: 1, recorded: 1, notRecorded: 0 },
          optional: { total: 0, recorded: 0, notRecorded: 0 },
        },
        items: [
          {
            relationType: 'essential',
            recorded: true,
            proficiencyLevel: 'Advanced',
            skill: skillSummary(),
          },
        ],
      }),
    ),
  )
  assert.equal(result.status, 'all-recorded')
  assert.deepEqual(result.topics, [])
  assert.equal(result.recordedTopics[0].proficiencyLevel, 'Advanced')
  assert.match(result.recordedTopics[0].rationale, /Advanced/)
  assert.equal(LEARNING_ALL_RECORDED.title.includes('already recorded'), true)
  assert.equal(Object.hasOwn(result, 'overallMatch'), false)
  assert.equal(JSON.stringify(result).includes('72%'), false)
  assert.equal(JSON.stringify(result).includes('resourceUrl'), false)
  assert.equal(JSON.stringify(result).includes('certificate'), false)
  assert.equal(JSON.stringify(result).includes('http://example.com'), false)
  for (const topic of [...result.topics, ...result.recordedTopics]) {
    assert.equal(Object.hasOwn(topic, 'price'), false)
    assert.equal(Object.hasOwn(topic, 'duration'), false)
    assert.equal(Object.hasOwn(topic, 'provider'), false)
  }
})

test('API failures stay user-facing and retry reads the saved target again', async () => {
  let attempts = 0
  globalThis.fetch = async () => {
    attempts += 1
    return jsonResponse(500, { error: 'nope' })
  }

  await assert.rejects(fetchLearningRecommendations(), (error) => {
    assert.equal(error instanceof ApiError, true)
    return true
  })
  assert.equal(userFacingLearningError(new ApiError('nope', 500)), LEARNING_UNAVAILABLE)

  attempts = 0
  globalThis.fetch = async (path) => {
    attempts += 1
    if (path === '/api/me/career-target') {
      return jsonResponse(200, { occupation: occupationSummary() })
    }
    return jsonResponse(200, gapPayload())
  }
  const retried = await fetchLearningRecommendations()
  assert.equal(attempts, 2)
  assert.equal(retried.topics.length, 2)
})

test('unauthenticated and unavailable accounts keep a clear learning error', () => {
  assert.equal(
    userFacingLearningError(new ApiError('Unauthenticated', 401)),
    'Sign in again to view learning recommendations.',
  )
  assert.equal(userFacingLearningError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(
    userFacingLearningError(new ApiError('Forbidden', 403)),
    'You cannot view learning recommendations with this account.',
  )
  assert.equal(learningSkillsPath('/student'), '/student/skills')
  assert.equal(learningSkillGapPath('/jobseeker'), '/jobseeker/skill-gap')
})

test('the Learning page does not keep mock courses, percentages or gap copy', () => {
  const pagePath = fileURLToPath(new URL('../pages/shared/LearningRecommendationsPage.jsx', import.meta.url))
  const modulePath = fileURLToPath(new URL('./learningRecommendations.js', import.meta.url))
  const page = readFileSync(pagePath, 'utf8')
  const moduleSource = readFileSync(modulePath, 'utf8')
  assert.equal(page.includes('learningContents'), false)
  assert.equal(page.includes('CourseCard'), false)
  assert.equal(page.includes('72%'), false)
  assert.equal(page.includes('Career Readiness'), false)
  assert.equal(page.includes('Data Analyst'), false)
  assert.equal(page.includes('Machine Learning'), false)
  assert.equal(page.includes('skillGapData'), false)
  assert.equal(page.includes('fetchLearningRecommendations'), true)
  assert.equal(page.includes('Go to Career Target'), true)
  assert.equal(page.includes('clearCareerTarget'), false)
  assert.equal(moduleSource.includes(LEARNING_DISCLAIMER.slice(0, 40)), true)
  assert.equal(moduleSource.includes('openai'), false)
  assert.equal(moduleSource.includes('overallMatch'), false)
})
