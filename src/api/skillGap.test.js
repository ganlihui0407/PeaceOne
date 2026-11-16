import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError } from './client.js'
import {
  SKILL_GAP_DISCLAIMER,
  SKILL_GAP_EMPTY_SKILLS,
  SKILL_GAP_UNAVAILABLE,
  fetchSkillGap,
  groupSkillGapItems,
  parseSkillGapResult,
  recordedStatusLabel,
  recordedStatusTone,
  skillGapSkillsPath,
  userFacingSkillGapError,
} from './skillGap.js'
import { formatSkillType } from './esco.js'

const originalFetch = globalThis.fetch
const OCCUPATION_ID = '11111111-1111-4111-8111-111111111111'
const SKILL_ID = '22222222-2222-4222-8222-222222222222'
const OPTIONAL_SKILL_ID = '33333333-3333-4333-8333-333333333333'

afterEach(() => {
  globalThis.fetch = originalFetch
})

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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
    occupation: {
      id: OCCUPATION_ID,
      sourceUri: 'http://data.europa.eu/esco/occupation/276ba420-ef09-4a0e-b215-2c2e2f80ad28',
      preferredLabel: 'chief ICT security officer',
      sourceSystem: 'ESCO',
      iscoGroup: '1330',
    },
    recordedSkillCount: 1,
    totals: {
      relations: 2,
      essential: { total: 1, recorded: 1, notRecorded: 0 },
      optional: { total: 1, recorded: 0, notRecorded: 1 },
    },
    items: [
      {
        relationType: 'essential',
        recorded: true,
        proficiencyLevel: 'Beginner',
        skill: skillSummary(),
      },
      {
        relationType: 'optional',
        recorded: false,
        proficiencyLevel: null,
        skill: skillSummary({
          id: OPTIONAL_SKILL_ID,
          preferredLabel: 'develop ICT safety information',
          skillType: 'skill/competence',
        }),
      },
    ],
    ...overrides,
  }
}

test('fetchSkillGap selects an occupation by id without sending user identity', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, headers: init.headers, body: init.body })
    return jsonResponse(200, gapPayload())
  }

  const result = await fetchSkillGap(OCCUPATION_ID)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, `/api/me/skill-gap?occupationId=${OCCUPATION_ID}`)
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].headers['x-csrf-token'], undefined)
  assert.equal(calls[0].body, undefined)
  assert.equal(calls[0].path.includes('userId'), false)
  assert.equal(calls[0].path.includes('role'), false)
  assert.equal(result.occupation.preferredLabel, 'chief ICT security officer')
  assert.equal(result.occupation.sourceUri.includes('esco/occupation/'), true)
  assert.equal(result.items[0].recorded, true)
  assert.equal(result.items[1].recorded, false)
})

test('recorded and not-recorded labels stay explicit and do not mean missing', () => {
  assert.equal(recordedStatusLabel(true), 'Recorded')
  assert.equal(recordedStatusLabel(false), 'Not recorded')
  assert.equal(recordedStatusTone(true), 'success')
  assert.equal(recordedStatusTone(false), 'warning')
  assert.equal(SKILL_GAP_DISCLAIMER.includes('does not mean you lack'), true)
})

test('essential and optional skills are grouped separately', () => {
  const parsed = parseSkillGapResult(gapPayload())
  const grouped = groupSkillGapItems(parsed.items)
  assert.equal(grouped.essential.length, 1)
  assert.equal(grouped.optional.length, 1)
  assert.equal(grouped.essential[0].skill.preferredLabel, 'ICT safety')
  assert.equal(grouped.optional[0].recorded, false)
  assert.equal(formatSkillType(grouped.essential[0].skill.skillType), 'Not classified')
})

test('empty recorded-skill copy links to the Skills page', () => {
  assert.equal(SKILL_GAP_EMPTY_SKILLS.title, 'No skills recorded yet.')
  assert.equal(skillGapSkillsPath('/student'), '/student/skills')
  assert.equal(skillGapSkillsPath('/jobseeker'), '/jobseeker/skills')
  assert.equal(SKILL_GAP_EMPTY_SKILLS.description.includes('Skills page'), true)
})

test('loading failures stay user-facing and retry uses the same occupation', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    return jsonResponse(500, { error: 'secret-dsn' })
  }

  await assert.rejects(() => fetchSkillGap(OCCUPATION_ID), (error) => error instanceof ApiError)
  assert.equal(userFacingSkillGapError(new ApiError('secret-dsn', 500)), SKILL_GAP_UNAVAILABLE)
  await assert.rejects(() => fetchSkillGap(OCCUPATION_ID), (error) => error.status === 500)
  assert.deepEqual(calls, [
    `/api/me/skill-gap?occupationId=${OCCUPATION_ID}`,
    `/api/me/skill-gap?occupationId=${OCCUPATION_ID}`,
  ])
})

test('unauthenticated and unavailable accounts keep a clear comparison error', () => {
  assert.equal(
    userFacingSkillGapError(new ApiError('Unauthenticated', 401)),
    'Sign in again to compare your recorded skills.',
  )
  assert.equal(userFacingSkillGapError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(
    userFacingSkillGapError(new ApiError('Forbidden', 403)),
    'You cannot compare recorded skills with this account.',
  )
})

test('unmatched recorded skills are parsed without inflating occupation-linked totals', () => {
  const parsed = parseSkillGapResult(
    gapPayload({
      recordedSkillCount: 2,
      matchedOccupationSkillCount: 1,
      unmatchedRecordedSkills: [
        {
          proficiencyLevel: 'Beginner',
          skill: skillSummary({
            id: '44444444-4444-4444-8444-444444444444',
            preferredLabel: 'SQL',
            sourceUri: 'http://data.europa.eu/esco/skill/598de5b0-5b58-4ea7-8058-a4bc4d18c742',
          }),
        },
      ],
      coverageExplanation: 'You have 2 recorded ESCO skills. 1 of 2 official occupation-linked skills match by ESCO identifier.',
    }),
  )
  assert.equal(parsed.recordedSkillCount, 2)
  assert.equal(parsed.matchedOccupationSkillCount, 1)
  assert.equal(parsed.unmatchedRecordedSkills[0].skill.preferredLabel, 'SQL')
  assert.equal(parsed.totals.essential.recorded, 1)
  assert.match(parsed.coverageExplanation, /ESCO identifier/)
})

test('parsed results never expose a match percentage', () => {
  const parsed = parseSkillGapResult(
    gapPayload({
      overallMatch: '72%',
      matchPercentage: 72,
    }),
  )
  assert.equal(Object.hasOwn(parsed, 'overallMatch'), false)
  assert.equal(Object.hasOwn(parsed, 'matchPercentage'), false)
  assert.equal(JSON.stringify(parsed).includes('72%'), false)
  assert.equal(JSON.stringify(parsed).includes('Missing'), false)
})

test('the Skill Gap page does not keep the mock lookup or hardcoded match score', () => {
  const pagePath = fileURLToPath(new URL('../pages/shared/SkillGapPage.jsx', import.meta.url))
  const page = readFileSync(pagePath, 'utf8')
  assert.equal(page.includes('skillGapData'), false)
  assert.equal(page.includes('careerTargets'), false)
  assert.equal(page.includes('initialUserSkills'), false)
  assert.equal(page.includes('72%'), false)
  assert.equal(page.includes('Machine Learning'), false)
  assert.equal(page.includes('overallMatch'), false)
  assert.equal(page.includes('fetchSkillGap'), true)
  assert.equal(page.includes('Go to Skills'), true)
})
