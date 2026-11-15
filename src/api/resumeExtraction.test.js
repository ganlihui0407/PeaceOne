import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, test } from 'node:test'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, clearCsrfToken } from './client.js'
import {
  EXTRACTION_EMPTY,
  EXTRACTION_SCANNED,
  EXTRACTION_STAGES,
  EXTRACTION_UNREADABLE,
  confirmResumeSkills,
  extractResumeSkills,
  matchingExplanation,
  parseConfirmation,
  parseExtraction,
  userFacingExtractionError,
} from './resumeExtraction.js'

const originalFetch = globalThis.fetch
const RESUME_ID = '5c5fde3f-51f8-4334-a4d5-73de30e45a02'
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

function suggestion(overrides = {}) {
  return {
    skillId: SKILL_ID,
    preferredLabel: 'ICT safety',
    skillType: null,
    sourceUri: 'http://data.europa.eu/esco/skill/ict',
    matchedLabel: 'ICT safety',
    matchType: 'preferred',
    matchingMethod: 'preferred-label',
    evidence: '…implemented ICT safety procedures…',
    alreadySaved: false,
    existingProficiency: null,
    reviewStatus: 'suggested',
    ...overrides,
  }
}

function extractionPayload(overrides = {}) {
  return {
    extraction: {
      resumeId: RESUME_ID,
      readable: true,
      unreadable: false,
      truncated: false,
      textLength: 120,
      reason: null,
      reviewToken: 'token.signature',
      suggestions: [suggestion()],
      ...overrides,
    },
  }
}

function userSkillPayload() {
  return {
    id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    proficiencyLevel: 'Beginner',
    skill: {
      id: SKILL_ID,
      sourceUri: 'http://data.europa.eu/esco/skill/ict',
      preferredLabel: 'ICT safety',
      skillType: null,
      sourceSystem: 'ESCO',
    },
  }
}

test('extractResumeSkills posts CSRF and hides storage paths', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-extract' })
    }
    return jsonResponse(200, extractionPayload())
  }

  const result = await extractResumeSkills(RESUME_ID)
  assert.equal(result.suggestions[0].preferredLabel, 'ICT safety')
  assert.equal(result.reviewToken, 'token.signature')
  const mutate = calls.find((call) => String(call.path).includes('/extract-skills'))
  assert.equal(mutate.init.method, 'POST')
  assert.equal(mutate.init.headers['x-csrf-token'], 'csrf-extract')
  assert.equal(JSON.parse(mutate.init.body).userId, undefined)
})

test('confirmResumeSkills posts selected ids and the review token', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-confirm' })
    }
    return jsonResponse(200, { saved: [userSkillPayload()], skipped: [] })
  }

  const result = await confirmResumeSkills(RESUME_ID, {
    reviewToken: 'token.signature',
    skillIds: [SKILL_ID],
  })
  assert.equal(result.saved.length, 1)
  const mutate = calls.find((call) => String(call.path).includes('/confirm-skills'))
  assert.deepEqual(JSON.parse(mutate.init.body), {
    reviewToken: 'token.signature',
    skillIds: [SKILL_ID],
  })
  assert.equal(mutate.init.headers['x-csrf-token'], 'csrf-confirm')
})

test('parseExtraction rejects filesystem paths and raw text', () => {
  assert.throws(
    () => parseExtraction(extractionPayload({ path: 'C:\\\\secret' })),
    (error) => error instanceof ApiError,
  )
  assert.throws(
    () => parseExtraction(extractionPayload({ text: 'full resume' })),
    (error) => error instanceof ApiError,
  )
  assert.throws(
    () => parseExtraction(extractionPayload({ storedFilename: 'uuid.pdf' })),
    (error) => error instanceof ApiError,
  )
  const empty = parseExtraction(extractionPayload({ suggestions: [], reason: 'no-match' }))
  assert.equal(empty.suggestions.length, 0)
})

test('parseConfirmation requires saved and skipped arrays', () => {
  const parsed = parseConfirmation({ saved: [userSkillPayload()], skipped: [] })
  assert.equal(parsed.saved[0].skill.preferredLabel, 'ICT safety')
  assert.throws(() => parseConfirmation({ saved: [] }), (error) => error instanceof ApiError)
})

test('user-facing extraction errors cover unreadable, expired and auth cases', () => {
  assert.equal(userFacingExtractionError(new ApiError('No resume file uploaded', 400)).includes('Upload'), true)
  assert.equal(userFacingExtractionError(new ApiError('Review has expired', 400)).includes('expired'), true)
  assert.equal(userFacingExtractionError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(userFacingExtractionError(new ApiError('Not found', 404), 'confirm').includes('Identify skills again'), true)
  assert.equal(matchingExplanation(suggestion({ matchType: 'altLabel', matchedLabel: 'information security' })).includes('alternative label'), true)
  assert.equal(EXTRACTION_UNREADABLE.includes('text-based PDF or DOCX'), true)
  assert.equal(EXTRACTION_SCANNED.includes('Scanned documents'), true)
  assert.equal(EXTRACTION_EMPTY.includes('add skills manually'), true)
  assert.equal(EXTRACTION_STAGES.includes('Extracting text'), true)
})

test('resume editor review UI is wired without fake processing copy', () => {
  const editor = readFileSync(fileURLToPath(new URL('../pages/shared/ResumeEditorPage.jsx', import.meta.url)), 'utf8')
  const page = readFileSync(fileURLToPath(new URL('../pages/shared/ResumePage.jsx', import.meta.url)), 'utf8')
  const review = readFileSync(fileURLToPath(new URL('../components/resume/ResumeSkillReview.jsx', import.meta.url)), 'utf8')
  const hook = readFileSync(fileURLToPath(new URL('../hooks/useResumeExtraction.js', import.meta.url)), 'utf8')
  const skills = readFileSync(fileURLToPath(new URL('../pages/shared/SkillsPage.jsx', import.meta.url)), 'utf8')

  assert.equal(review.includes('Skills Identified from Your Resume'), true)
  assert.equal(editor.includes('useResumeExtraction'), true)
  assert.equal(editor.includes('ResumeSkillReview'), true)
  assert.equal(page.includes('Identify skills'), true)
  assert.equal(review.includes('EXTRACTION_EMPTY'), true)
  assert.equal(review.includes('Confirm selected skills'), true)
  assert.equal(review.includes('Confirm selected skills'), true)
  assert.equal(review.includes('Return without saving'), true)
  assert.equal(review.includes('%'), false)
  assert.equal(hook.includes('extractResumeSkills'), true)
  assert.equal(hook.includes('confirmResumeSkills'), true)
  assert.equal(skills.includes('identify skills from an uploaded resume'), true)
})
