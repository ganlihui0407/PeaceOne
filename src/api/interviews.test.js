import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR } from '../auth/sessionStatus.js'
import { ApiError, clearCsrfToken, setCsrfToken } from './client.js'
import {
  ACTIVE_INTERVIEW_STATUSES,
  DASHBOARD_INTERVIEWS_EMPTY,
  EMPLOYER_INTERVIEWS_EMPTY,
  INTERVIEW_CANNOT_BE_CREATED,
  INTERVIEW_CANNOT_BE_UPDATED,
  INTERVIEW_EMPTY,
  INTERVIEW_LIST_LIMIT,
  INTERVIEW_STATUSES,
  STAFF_INTERVIEWS_EMPTY,
  canAcceptInterview,
  canCancelInterview,
  canCompleteInterview,
  canConfirmInterviewReschedule,
  canDeclineInterview,
  canRequestReschedule,
  canScheduleInterviewForApplication,
  canUpdateInterviewSchedule,
  candidateInterviewPath,
  candidateInterviewsPath,
  combineDateTimeToIso,
  employerInterviewCreatePath,
  employerInterviewPath,
  employerInterviewsPath,
  emptyAdminInterviewStats,
  emptyEmployerInterviewStats,
  fetchAdminInterviewStats,
  fetchEmployerInterviewStats,
  fetchEmployerInterviews,
  fetchMyInterviews,
  formatInterviewStatus,
  formatInterviewType,
  interviewStatusTone,
  isInterviewId,
  parseAdminInterviewStats,
  parseEmployerInterviewStats,
  parseInterview,
  parseInterviewPage,
  userFacingInterviewError,
} from './interviews.js'

const originalFetch = globalThis.fetch
const INTERVIEW_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const APPLICATION_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const JOB_ID = 'cccccccc-3333-4333-8333-cccccccccccc'
const USER_ID = 'dddddddd-4444-4444-8444-dddddddddddd'
const COMPANY_ID = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee'

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

function interviewPayload(overrides = {}) {
  return {
    id: INTERVIEW_ID,
    applicationId: APPLICATION_ID,
    jobId: JOB_ID,
    candidateUserId: USER_ID,
    companyId: COMPANY_ID,
    createdByUserId: USER_ID,
    roundNumber: 1,
    title: 'Backend Engineer interview',
    interviewType: 'ONLINE',
    status: 'PROPOSED',
    scheduledStartAt: '2026-12-01T02:00:00.000Z',
    durationMinutes: 45,
    timezone: 'Asia/Kuala_Lumpur',
    meetingLink: 'https://meet.example.com/room',
    venue: null,
    instructions: 'Join early.',
    employerNotes: 'Internal only.',
    candidateResponseNote: null,
    requestedStartAt: null,
    requestedDurationMinutes: null,
    attendance: null,
    outcome: null,
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-15T10:00:00.000Z',
    application: { id: APPLICATION_ID, status: 'SHORTLISTED' },
    job: {
      id: JOB_ID,
      title: 'Backend Engineer',
      status: 'PUBLISHED',
      company: { id: COMPANY_ID, companyName: 'Interview Labs', location: 'Kuala Lumpur' },
    },
    candidate: { id: USER_ID, fullName: 'José Müller', email: 'jose@example.com' },
    createdBy: { id: USER_ID, fullName: 'Staff One' },
    events: [],
    ...overrides,
  }
}

test('parsers, paths and capability helpers cover interview workflow states', () => {
  const interview = parseInterview(interviewPayload())
  assert.equal(interview.id, INTERVIEW_ID)
  assert.equal(interview.status, 'PROPOSED')
  assert.equal(interview.employerNotes, 'Internal only.')
  assert.equal(canAcceptInterview(interview), true)
  assert.equal(canDeclineInterview(interview), true)
  assert.equal(canRequestReschedule(interview), true)
  assert.equal(canCancelInterview(interview), true)
  assert.equal(canCompleteInterview(interview), false)
  assert.equal(canUpdateInterviewSchedule(interview), true)
  assert.equal(canConfirmInterviewReschedule(interview), false)
  assert.equal(canScheduleInterviewForApplication({ status: 'SHORTLISTED' }, [interview]), false)
  assert.equal(canScheduleInterviewForApplication({ status: 'SHORTLISTED' }, []), true)
  assert.equal(canScheduleInterviewForApplication({ status: 'SUBMITTED' }, []), false)

  const confirmed = parseInterview(interviewPayload({ status: 'CONFIRMED' }))
  assert.equal(canAcceptInterview(confirmed), false)
  assert.equal(canCompleteInterview(confirmed), true)
  assert.equal(canRequestReschedule(confirmed), true)

  const requested = parseInterview(interviewPayload({ status: 'RESCHEDULE_REQUESTED' }))
  assert.equal(canConfirmInterviewReschedule(requested), true)
  assert.equal(canDeclineInterview(requested), true)

  const completed = parseInterview(interviewPayload({ status: 'COMPLETED', attendance: 'ATTENDED', outcome: 'POSITIVE' }))
  assert.equal(canCancelInterview(completed), false)
  assert.equal(canUpdateInterviewSchedule(completed), false)

  assert.equal(formatInterviewStatus('PROPOSED'), 'Pending response')
  assert.equal(formatInterviewType('ONSITE'), 'On-site')
  assert.equal(interviewStatusTone('CONFIRMED'), 'success')
  assert.equal(isInterviewId(INTERVIEW_ID), true)
  assert.equal(isInterviewId('nope'), false)
  assert.equal(employerInterviewsPath({ status: 'PROPOSED' }).includes('status=PROPOSED'), true)
  assert.equal(employerInterviewPath(INTERVIEW_ID), `/employer/interviews/${INTERVIEW_ID}`)
  assert.equal(employerInterviewCreatePath(APPLICATION_ID).includes(APPLICATION_ID), true)
  assert.equal(candidateInterviewsPath('/student'), '/student/interviews')
  assert.equal(candidateInterviewPath('/jobseeker', INTERVIEW_ID), `/jobseeker/interviews/${INTERVIEW_ID}`)
  assert.equal(combineDateTimeToIso('2026-12-01', '10:00', 'Asia/Kuala_Lumpur'), '2026-12-01T02:00:00.000Z')
  assert.equal(INTERVIEW_LIST_LIMIT, 20)
  assert.deepEqual(ACTIVE_INTERVIEW_STATUSES, ['PROPOSED', 'RESCHEDULE_REQUESTED', 'CONFIRMED'])
  assert.equal(emptyEmployerInterviewStats().total, 0)
  assert.equal(emptyAdminInterviewStats().companiesWithInterviews, 0)
  assert.equal(EMPLOYER_INTERVIEWS_EMPTY.title.includes('No interviews'), true)
  assert.equal(INTERVIEW_EMPTY.description.includes('company schedules'), true)
  assert.equal(STAFF_INTERVIEWS_EMPTY.title.includes('upcoming'), true)
  assert.equal(DASHBOARD_INTERVIEWS_EMPTY.title.includes('upcoming'), true)

  const page = parseInterviewPage({
    interviews: [interviewPayload()],
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  })
  assert.equal(page.items.length, 1)
  assert.equal(page.total, 1)

  const employerStats = parseEmployerInterviewStats({
    total: 2,
    byStatus: Object.fromEntries(INTERVIEW_STATUSES.map((status) => [status, status === 'PROPOSED' ? 2 : 0])),
    upcomingConfirmed: 0,
  })
  assert.equal(employerStats.byStatus.PROPOSED, 2)
  const adminStats = parseAdminInterviewStats({
    total: 2,
    byStatus: employerStats.byStatus,
    companiesWithInterviews: 1,
  })
  assert.equal(adminStats.companiesWithInterviews, 1)
})

test('interview fetches use the live employer, candidate and admin endpoints', async () => {
  setCsrfToken('csrf-token')
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    if (String(path).includes('/stats')) {
      return jsonResponse(200, {
        total: 0,
        byStatus: emptyEmployerInterviewStats().byStatus,
        upcomingConfirmed: 0,
        companiesWithInterviews: 0,
      })
    }
    return jsonResponse(200, {
      interviews: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    })
  }
  const mine = await fetchMyInterviews({ status: 'PROPOSED' })
  const company = await fetchEmployerInterviews({ applicationId: APPLICATION_ID })
  const employerStats = await fetchEmployerInterviewStats()
  const adminStats = await fetchAdminInterviewStats()
  assert.equal(mine.total, 0)
  assert.equal(company.items.length, 0)
  assert.equal(employerStats.upcomingConfirmed, 0)
  assert.equal(adminStats.total, 0)
  assert.equal(calls.some((path) => String(path).includes('/api/me/interviews')), true)
  assert.equal(calls.some((path) => String(path).includes('/api/employer/interviews')), true)
  assert.equal(calls.some((path) => String(path).includes('/api/admin/interviews/stats')), true)
})

test('user-facing interview errors stay specific and do not leak secrets', () => {
  assert.equal(userFacingInterviewError(new ApiError('Unauthenticated', 401)), 'Sign in again to manage interviews.')
  assert.equal(userFacingInterviewError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)).includes('unavailable'), true)
  assert.equal(userFacingInterviewError(new ApiError('Forbidden', 403)).includes('cannot manage'), true)
  assert.equal(userFacingInterviewError(new ApiError('Not found', 404)), 'This interview is not available.')
  assert.equal(userFacingInterviewError(new ApiError(INTERVIEW_CANNOT_BE_UPDATED, 409)), INTERVIEW_CANNOT_BE_UPDATED)
  assert.equal(userFacingInterviewError(new ApiError(INTERVIEW_CANNOT_BE_CREATED, 409)), INTERVIEW_CANNOT_BE_CREATED)
  assert.equal(userFacingInterviewError(new ApiError('secret-dsn', 500)), 'Interview data is unavailable right now.')
})

test('interview pages and dashboards no longer import mock interview fixtures', () => {
  const employer = readFileSync(fileURLToPath(new URL('../pages/employer/Interviews.jsx', import.meta.url)), 'utf8')
  const form = readFileSync(fileURLToPath(new URL('../pages/employer/InterviewFormPage.jsx', import.meta.url)), 'utf8')
  const details = readFileSync(fileURLToPath(new URL('../pages/employer/InterviewDetails.jsx', import.meta.url)), 'utf8')
  const candidate = readFileSync(fileURLToPath(new URL('../pages/shared/InterviewsPage.jsx', import.meta.url)), 'utf8')
  const candidateDetails = readFileSync(fileURLToPath(new URL('../pages/shared/InterviewDetailsPage.jsx', import.meta.url)), 'utf8')
  const applicant = readFileSync(fileURLToPath(new URL('../pages/employer/ApplicantDetails.jsx', import.meta.url)), 'utf8')
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
  const nav = readFileSync(fileURLToPath(new URL('../data/navigation.js', import.meta.url)), 'utf8')

  for (const source of [employer, form, details, candidate, candidateDetails, applicant]) {
    assert.equal(source.includes('data/interviews'), false)
    assert.equal(source.includes('data/employerInterviews'), false)
    assert.equal(source.includes('Nexa Digital'), false)
    assert.equal(source.includes('Daniel Lee'), false)
  }
  assert.equal(employer.includes('fetchEmployerInterviews'), true)
  assert.equal(form.includes('createEmployerInterview'), true)
  assert.equal(details.includes('fetchEmployerInterview'), true)
  assert.equal(candidate.includes('fetchMyInterviews'), true)
  assert.equal(candidateDetails.includes('fetchMyInterview'), true)
  assert.equal(applicant.includes('Schedule interview'), true)
  assert.equal(applicant.includes('Interview and offer actions are not available yet'), false)
  assert.equal(app.includes('InterviewDetails'), true)
  assert.equal(app.includes('path="interviews/:interviewId"'), true)
  assert.equal(nav.includes("/student/interviews"), true)
})
