import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import {
  DASHBOARD_APPLICATIONS_UNAVAILABLE,
  DASHBOARD_INTERVIEWS_UNAVAILABLE,
  DASHBOARD_JOBS_UNAVAILABLE,
  DASHBOARD_UNAVAILABLE,
  buildCandidateDashboard,
  fetchCandidateDashboard,
  firstNameFromFullName,
  greetingForHour,
  profileHighlights,
  userFacingDashboardError,
} from './candidateDashboard.js'
import { ApiError, clearCsrfToken } from './client.js'
import { EMPTY_LEARNING_RECOMMENDATIONS, buildLearningRecommendations } from './learningRecommendations.js'
import { parseSkillGapResult } from './skillGap.js'

const originalFetch = globalThis.fetch
const USER_ID = '11111111-1111-4111-8111-111111111111'
const OCCUPATION_ID = '276ba420-ef09-4a0e-b215-2c2e2f80ad28'
const SKILL_ID = '22222222-2222-4222-8222-222222222222'
const OPTIONAL_SKILL_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_ESSENTIAL_ID = '55555555-5555-4555-8555-555555555555'
const RECORD_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'

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

function profileUser(overrides = {}) {
  return {
    id: USER_ID,
    email: 'stage64.student@peaceone.test',
    fullName: 'Stage Six Four',
    phone: '012-555 0100',
    role: 'STUDENT',
    accountStatus: 'ACTIVE',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Information Systems',
    institution: 'Universiti Malaya',
    graduationYear: 2027,
    location: 'Kuala Lumpur',
    experienceSummary: 'Internship reporting.',
    jobTitle: null,
    department: null,
    ...overrides,
  }
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

function savedSkill() {
  return {
    id: RECORD_ID,
    proficiencyLevel: 'Beginner',
    skill: skillSummary(),
  }
}

function gapPayload() {
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
  }
}

test('firstName and greeting helpers do not invent a person', () => {
  assert.equal(firstNameFromFullName('Stage Six Four'), 'Stage')
  assert.equal(firstNameFromFullName('  Ada  '), 'Ada')
  assert.equal(firstNameFromFullName(''), '')
  assert.equal(greetingForHour(9), 'Good morning')
  assert.equal(greetingForHour(15), 'Good afternoon')
  assert.equal(greetingForHour(21), 'Good evening')
})

test('profile highlights omit empty optional fields', () => {
  assert.deepEqual(
    profileHighlights(profileUser()),
    ["Bachelor's Degree", 'Universiti Malaya', 'Kuala Lumpur'],
  )
  assert.deepEqual(
    profileHighlights(profileUser({ educationLevel: null, institution: null, location: null })),
    [],
  )
})

test('buildCandidateDashboard uses recorded/not recorded counts and no readiness score', () => {
  const dashboard = buildCandidateDashboard({
    profile: profileUser(),
    skills: [savedSkill()],
    recommendations: buildLearningRecommendations(parseSkillGapResult(gapPayload())),
  })
  assert.equal(dashboard.firstName, 'Stage')
  assert.equal(dashboard.recordedSkillCount, 1)
  assert.equal(dashboard.occupation.preferredLabel, 'chief ICT security officer')
  assert.equal(dashboard.recordedForTarget, 1)
  assert.equal(dashboard.notRecordedForTarget, 2)
  assert.equal(dashboard.stats[0].value, '1')
  assert.equal(dashboard.stats[1].value, 'Set')
  assert.equal(dashboard.stats[2].value, '1 of 3')
  assert.equal(dashboard.stats[3].value, '2')
  assert.equal(dashboard.topics[0].skill.preferredLabel, 'network security')
  assert.equal(JSON.stringify(dashboard).includes('72%'), false)
  assert.equal(JSON.stringify(dashboard).includes('Career Readiness'), false)
  assert.equal(dashboard.passwordHash, undefined)
})

test('empty career targets keep dashboards empty instead of using mock roles', () => {
  const dashboard = buildCandidateDashboard({
    profile: profileUser({ educationLevel: null, institution: null, location: null }),
    skills: [],
    recommendations: EMPTY_LEARNING_RECOMMENDATIONS,
  })
  assert.equal(dashboard.occupation, null)
  assert.equal(dashboard.recordedSkillCount, 0)
  assert.equal(dashboard.stats[1].value, 'Not set')
  assert.equal(dashboard.stats[2].value, '—')
  assert.equal(dashboard.stats[3].value, '—')
  assert.deepEqual(dashboard.topics, [])
  assert.deepEqual(dashboard.profileHighlights, [])
})

test('fetchCandidateDashboard loads the signed-in profile, skills and career target only', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    if (path === '/api/me') {
      return jsonResponse(200, { user: profileUser() })
    }
    if (path === '/api/me/skills') {
      return jsonResponse(200, { items: [savedSkill()] })
    }
    if (path === '/api/me/career-target') {
      return jsonResponse(200, { occupation: occupationSummary() })
    }
    if (path === `/api/me/skill-gap?occupationId=${OCCUPATION_ID}`) {
      return jsonResponse(200, gapPayload())
    }
    throw new Error(`unexpected ${path}`)
  }

  const dashboard = await fetchCandidateDashboard()
  assert.equal(dashboard.fullName, 'Stage Six Four')
  assert.equal(dashboard.occupation.id, OCCUPATION_ID)
  assert.equal(dashboard.recordedSkillCount, 1)
  assert.equal(
    calls.some((call) => call.path === '/api/me' && call.method === 'GET'),
    true,
  )
  assert.equal(
    calls.some((call) => call.path === '/api/me/skills' && call.method === 'GET'),
    true,
  )
  assert.equal(
    calls.some((call) => call.path === '/api/me/career-target' && call.method === 'GET'),
    true,
  )
  assert.equal(
    calls.every((call) => !String(call.path).includes('userId=')),
    true,
  )
})

test('API failures stay user-facing and do not fall back to mock dashboard data', async () => {
  globalThis.fetch = async () => jsonResponse(500, { error: 'secret-dsn' })
  await assert.rejects(() => fetchCandidateDashboard(), (error) => error instanceof ApiError)
  assert.equal(userFacingDashboardError(new ApiError('secret-dsn', 500)), DASHBOARD_UNAVAILABLE)
  assert.equal(userFacingDashboardError(new ApiError('Unauthenticated', 401)), 'Sign in again to view your dashboard.')
  assert.equal(userFacingDashboardError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(
    userFacingDashboardError(new ApiError('Forbidden', 403)),
    'You cannot view this dashboard with this account.',
  )
})

test('student and job-seeker dashboards use live candidate data and drop mock scores', () => {
  const student = readFileSync(fileURLToPath(new URL('../pages/student/Dashboard.jsx', import.meta.url)), 'utf8')
  const jobSeeker = readFileSync(fileURLToPath(new URL('../pages/jobseeker/Dashboard.jsx', import.meta.url)), 'utf8')
  const panels = readFileSync(
    fileURLToPath(new URL('../pages/shared/CandidateDashboardPanels.jsx', import.meta.url)),
    'utf8',
  )
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
  const employer = readFileSync(fileURLToPath(new URL('../pages/employer/Dashboard.jsx', import.meta.url)), 'utf8')
  const admin = readFileSync(fileURLToPath(new URL('../pages/admin/Dashboard.jsx', import.meta.url)), 'utf8')

  assert.equal(student.includes('useCandidateDashboard'), true)
  assert.equal(jobSeeker.includes('useCandidateDashboard'), true)
  assert.equal(panels.includes('useCandidateDashboard'), false)
  for (const source of [student, jobSeeker, panels]) {
    assert.equal(source.includes('dashboardData'), false)
    assert.equal(source.includes('studentProfile'), false)
    assert.equal(source.includes('Emily Tan'), false)
    assert.equal(source.includes('72%'), false)
    assert.equal(source.includes('Career Readiness'), false)
    assert.equal(source.includes('CourseCard'), false)
    assert.equal(source.includes('JobCard'), false)
    assert.equal(source.includes('Nexa Digital'), false)
    assert.equal(source.includes('passwordHash'), false)
  }

  assert.equal(student.includes("BASE_PATH = '/student'"), true)
  assert.equal(jobSeeker.includes("BASE_PATH = '/jobseeker'"), true)
  assert.equal(panels.includes('DASHBOARD_JOBS_UNAVAILABLE'), true)
  assert.equal(panels.includes('DASHBOARD_APPLICATIONS_UNAVAILABLE'), true)
  assert.equal(panels.includes('DASHBOARD_INTERVIEWS_EMPTY'), true)
  assert.equal(panels.includes('CandidateUpcomingInterviewCard'), true)
  assert.equal(DASHBOARD_JOBS_UNAVAILABLE.title.includes('not connected'), false)
  assert.equal(DASHBOARD_JOBS_UNAVAILABLE.title.includes('Explore Jobs'), true)
  assert.equal(DASHBOARD_JOBS_UNAVAILABLE.description.includes('does not invent recommended jobs'), true)
  assert.equal(jobSeeker.includes('${BASE_PATH}/jobs'), true)
  assert.equal(jobSeeker.includes('navigate('), true)
  assert.equal(jobSeeker.includes("params.set('q'"), true)
  assert.equal(jobSeeker.includes('not connected yet'), false)
  assert.equal(jobSeeker.includes('Submitted applications are listed on My Applications'), true)
  assert.equal(jobSeeker.includes('Applications and interviews are not stored yet'), false)
  assert.equal(DASHBOARD_APPLICATIONS_UNAVAILABLE.title.includes('not connected'), false)
  assert.equal(DASHBOARD_APPLICATIONS_UNAVAILABLE.title.includes('My Applications'), true)
  assert.equal(DASHBOARD_INTERVIEWS_UNAVAILABLE.title.includes('upcoming'), true)
  assert.equal(panels.includes('Needs Improvement'), false)
  assert.equal(panels.includes('Missing Skills'), false)
  assert.equal(app.includes('<StudentDashboard />'), true)
  assert.equal(app.includes('<JobSeekerDashboard />'), true)
  assert.equal(app.includes("roles={['STUDENT']}"), true)
  assert.equal(app.includes("roles={['JOB_SEEKER']}"), true)
  assert.equal(employer.includes('useCandidateDashboard'), false)
  assert.equal(admin.includes('useCandidateDashboard'), false)
  assert.equal(employer.includes('fetchCandidateDashboard'), false)
  assert.equal(admin.includes('fetchCandidateDashboard'), false)
  assert.equal(employer.includes('useStaffDashboard'), true)
  assert.equal(admin.includes('useAdminDashboard'), true)
})
