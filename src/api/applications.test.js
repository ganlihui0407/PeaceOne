import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, clearCsrfToken } from './client.js'
import {
  APPLICATION_ALREADY_EXISTS,
  APPLICATION_CANNOT_BE_WITHDRAWN,
  APPLICATIONS_UNAVAILABLE,
  applicationStatusTone,
  canWithdrawApplication,
  candidateApplicationPath,
  candidateApplicationsPath,
  candidateApplyPath,
  fetchMyApplication,
  fetchMyApplicationForJob,
  fetchMyApplications,
  formatApplicationStatus,
  parseApplication,
  parseApplicationPage,
  parseApplicationSnapshot,
  submitJobApplication,
  userFacingApplicationError,
  withdrawMyApplication,
} from './applications.js'

const originalFetch = globalThis.fetch
const JOB_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const OTHER_JOB_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const APPLICATION_ID = 'cccccccc-3333-4333-8333-cccccccccccc'
const RESUME_ID = 'dddddddd-4444-4444-8444-dddddddddddd'
const COMPANY_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const SKILL_ID = '33333333-3333-4333-8333-333333333333'

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

function jobPayload(overrides = {}) {
  return {
    id: JOB_ID,
    title: 'Junior Software Developer',
    description: 'Build internal web features.',
    qualificationRequired: "Bachelor's Degree",
    experienceRequired: '0-1 years',
    employmentType: 'FULL_TIME',
    location: 'Kuala Lumpur',
    salaryMin: 3800,
    salaryMax: 5200,
    closesAt: '2026-12-01T15:59:59.000Z',
    status: 'PUBLISHED',
    publishedAt: '2026-11-13T03:00:00.000Z',
    createdAt: '2026-11-13T02:40:00.000Z',
    updatedAt: '2026-11-13T02:40:00.000Z',
    company: {
      id: COMPANY_ID,
      companyName: 'Northwind Analytics',
      industry: 'Technology',
      location: 'Petaling Jaya',
      website: 'www.northwind.example',
      description: 'A reporting studio.',
    },
    requiredSkills: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        requiredLevel: 'Intermediate',
        skill: {
          id: SKILL_ID,
          sourceUri: 'http://data.europa.eu/esco/skill/example',
          preferredLabel: 'use ICT safety measures',
          skillType: 'knowledge',
          sourceSystem: 'ESCO',
        },
      },
    ],
    ...overrides,
  }
}

function snapshotPayload(overrides = {}) {
  return {
    resumeTitle: 'Software internship CV',
    templateKey: 'modern',
    generatedPdfFilename: 'Software internship CV.pdf',
    generatedPdfContentType: 'application/pdf',
    generatedPdfSize: 12000,
    generatedPdfSha256: 'a'.repeat(64),
    hasOriginalFile: true,
    originalFileFilename: 'Original_CV.pdf',
    originalFileContentType: 'application/pdf',
    originalFileSize: 8000,
    originalFileSha256: 'b'.repeat(64),
    createdAt: '2026-11-13T04:00:00.000Z',
    ...overrides,
  }
}

function applicationPayload(overrides = {}) {
  return {
    id: APPLICATION_ID,
    jobId: JOB_ID,
    status: 'SUBMITTED',
    appliedAt: '2026-11-13T04:00:00.000Z',
    updatedAt: '2026-11-13T04:00:00.000Z',
    selectedResumeId: RESUME_ID,
    job: jobPayload(),
    snapshot: snapshotPayload(),
    statusEvents: [
      {
        id: 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee',
        fromStatus: null,
        toStatus: 'SUBMITTED',
        reviewNote: null,
        createdAt: '2026-11-13T04:00:00.000Z',
        actor: { id: USER_ID, fullName: 'Stage Student' },
      },
    ],
    ...overrides,
  }
}

function pagePayload(applications = [applicationPayload()], extras = {}) {
  return {
    applications,
    page: 1,
    limit: 20,
    total: applications.length,
    totalPages: applications.length === 0 ? 0 : 1,
    ...extras,
  }
}

test('parseApplication rejects storage paths and snapshot internals', () => {
  const parsed = parseApplication(applicationPayload())
  assert.equal(parsed.status, 'SUBMITTED')
  assert.equal(parsed.job.title, 'Junior Software Developer')
  assert.equal(parsed.snapshot.resumeTitle, 'Software internship CV')
  assert.equal(parsed.snapshot.hasOriginalFile, true)
  assert.equal(parsed.statusEvents[0].toStatus, 'SUBMITTED')
  assert.equal(formatApplicationStatus('SUBMITTED'), 'Submitted')
  assert.equal(applicationStatusTone('WITHDRAWN'), 'danger')
  assert.equal(canWithdrawApplication(parsed), true)
  assert.equal(canWithdrawApplication({ status: 'UNDER_REVIEW' }), false)

  assert.throws(
    () => parseApplication(applicationPayload({ storagePath: 'C:\\\\secret' })),
    (error) => error instanceof ApiError,
  )
  assert.throws(
    () => parseApplicationSnapshot({
      ...snapshotPayload(),
      structuredSnapshot: { fullName: 'hidden' },
    }),
    (error) => error instanceof ApiError,
  )
  assert.throws(
    () => parseApplicationSnapshot({
      ...snapshotPayload(),
      originalFileStoredFilename: 'original-resume.pdf',
    }),
    (error) => error instanceof ApiError,
  )
})

test('fetchMyApplications sends search, status, jobId and pagination', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    if (path === `/api/me/applications?q=Northwind&status=SUBMITTED&jobId=${JOB_ID}&page=2&limit=20`) {
      return jsonResponse(200, pagePayload([applicationPayload()], { page: 2, total: 21, totalPages: 2 }))
    }
    throw new Error(`unexpected ${path}`)
  }
  const result = await fetchMyApplications({
    q: 'Northwind',
    status: 'SUBMITTED',
    jobId: JOB_ID,
    page: 2,
    limit: 20,
  })
  assert.equal(result.items[0].job.company.companyName, 'Northwind Analytics')
  assert.equal(result.page, 2)
  assert.equal(result.totalPages, 2)
  assert.equal(calls[0].method, 'GET')
})

test('fetchMyApplications treats an empty list as valid', async () => {
  globalThis.fetch = async (path) => {
    assert.equal(path, '/api/me/applications?page=1&limit=20')
    return jsonResponse(200, pagePayload([], { total: 0, totalPages: 0 }))
  }
  const result = await fetchMyApplications({ page: 1, limit: 20 })
  assert.deepEqual(result.items, [])
  assert.equal(parseApplicationPage(pagePayload([])).total, 0)
})

test('fetchMyApplication and job lookup reject invalid ids and missing records', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    if (path === `/api/me/applications/${APPLICATION_ID}`) {
      return jsonResponse(200, { application: applicationPayload() })
    }
    if (path === `/api/me/applications?jobId=${JOB_ID}&page=1&limit=1`) {
      return jsonResponse(200, pagePayload([applicationPayload()]))
    }
    if (path === `/api/me/applications?jobId=${OTHER_JOB_ID}&page=1&limit=1`) {
      return jsonResponse(200, pagePayload([]))
    }
    if (path === `/api/me/applications/${RESUME_ID}`) {
      return jsonResponse(404, { error: 'Not found' })
    }
    throw new Error(`unexpected ${path}`)
  }

  const detail = await fetchMyApplication(APPLICATION_ID)
  assert.equal(detail.id, APPLICATION_ID)
  const existing = await fetchMyApplicationForJob(JOB_ID)
  assert.equal(existing.id, APPLICATION_ID)
  const missing = await fetchMyApplicationForJob(OTHER_JOB_ID)
  assert.equal(missing, null)
  await assert.rejects(() => fetchMyApplication('not-a-uuid'), (error) => error instanceof ApiError && error.status === 400)
  await assert.rejects(() => fetchMyApplication(RESUME_ID), (error) => error instanceof ApiError && error.status === 404)
  assert.equal(calls.includes(`/api/me/applications/${APPLICATION_ID}`), true)
})

test('submitJobApplication posts only resumeId with CSRF', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body, headers: init.headers })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-application' })
    }
    if (path === `/api/jobs/${JOB_ID}/applications` && init.method === 'POST') {
      return jsonResponse(201, { application: applicationPayload() })
    }
    throw new Error(`unexpected ${path}`)
  }

  const created = await submitJobApplication(JOB_ID, RESUME_ID)
  assert.equal(created.status, 'SUBMITTED')
  const submit = calls.find((call) => call.path === `/api/jobs/${JOB_ID}/applications`)
  assert.equal(submit.headers['x-csrf-token'], 'csrf-application')
  const body = JSON.parse(submit.body)
  assert.deepEqual(body, { resumeId: RESUME_ID })
  assert.equal(body.applicantUserId, undefined)
  assert.equal(body.status, undefined)
  assert.equal(body.companyId, undefined)
})

test('withdrawMyApplication posts CSRF and surfaces blocked transitions', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body, headers: init.headers })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-withdraw' })
    }
    if (path === `/api/me/applications/${APPLICATION_ID}/withdraw` && init.method === 'POST') {
      return jsonResponse(200, {
        application: applicationPayload({
          status: 'WITHDRAWN',
          statusEvents: [
            ...applicationPayload().statusEvents,
            {
              id: 'ffffffff-6666-4666-8666-ffffffffffff',
              fromStatus: 'SUBMITTED',
              toStatus: 'WITHDRAWN',
              reviewNote: null,
              createdAt: '2026-11-13T05:00:00.000Z',
              actor: { id: USER_ID, fullName: 'Stage Student' },
            },
          ],
        }),
      })
    }
    throw new Error(`unexpected ${path}`)
  }

  const withdrawn = await withdrawMyApplication(APPLICATION_ID)
  assert.equal(withdrawn.status, 'WITHDRAWN')
  assert.equal(canWithdrawApplication(withdrawn), false)
  const withdraw = calls.find((call) => String(call.path).includes('/withdraw'))
  assert.equal(withdraw.headers['x-csrf-token'], 'csrf-withdraw')
  assert.deepEqual(JSON.parse(withdraw.body), {})
})

test('application helpers map API errors for Apply Now and My Applications', () => {
  assert.equal(userFacingApplicationError(new ApiError('Sign in', 401)), 'Sign in again to manage applications.')
  assert.equal(
    userFacingApplicationError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)),
    ACCOUNT_UNAVAILABLE_MESSAGE,
  )
  assert.equal(
    userFacingApplicationError(new ApiError('Forbidden', 403)),
    'You cannot manage these applications with this account.',
  )
  assert.equal(userFacingApplicationError(new ApiError('Not found', 404)), 'This application is not available.')
  assert.equal(userFacingApplicationError(new ApiError(APPLICATION_ALREADY_EXISTS, 409)), APPLICATION_ALREADY_EXISTS)
  assert.equal(
    userFacingApplicationError(new ApiError(APPLICATION_CANNOT_BE_WITHDRAWN, 409)),
    APPLICATION_CANNOT_BE_WITHDRAWN,
  )
  assert.equal(userFacingApplicationError(new ApiError('boom', 500)), APPLICATIONS_UNAVAILABLE)
  const abort = new Error('aborted')
  abort.name = 'AbortError'
  assert.equal(userFacingApplicationError(abort), '')
})

test('submitJobApplication surfaces duplicate and network failures', async () => {
  globalThis.fetch = async (path) => {
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-dup' })
    }
    return jsonResponse(409, { error: APPLICATION_ALREADY_EXISTS })
  }
  await assert.rejects(
    () => submitJobApplication(JOB_ID, RESUME_ID),
    (error) => error instanceof ApiError && error.status === 409 && error.message === APPLICATION_ALREADY_EXISTS,
  )

  globalThis.fetch = async () => {
    throw new Error('offline')
  }
  await assert.rejects(
    () => fetchMyApplications(),
    (error) => error instanceof ApiError && error.message === APPLICATIONS_UNAVAILABLE,
  )
})

test('candidate application pages wire Apply Now, My Applications and role protection', () => {
  const apply = readFileSync(fileURLToPath(new URL('../pages/shared/ApplyPage.jsx', import.meta.url)), 'utf8')
  const list = readFileSync(fileURLToPath(new URL('../pages/shared/ApplicationsPage.jsx', import.meta.url)), 'utf8')
  const detail = readFileSync(fileURLToPath(new URL('../pages/shared/ApplicationDetailPage.jsx', import.meta.url)), 'utf8')
  const jobDetail = readFileSync(fileURLToPath(new URL('../pages/shared/CandidateJobDetailPage.jsx', import.meta.url)), 'utf8')
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
  const navigation = readFileSync(fileURLToPath(new URL('../data/navigation.js', import.meta.url)), 'utf8')
  const employerDashboard = readFileSync(fileURLToPath(new URL('../pages/employer/Dashboard.jsx', import.meta.url)), 'utf8')
  const applicants = readFileSync(fileURLToPath(new URL('../pages/employer/Applicants.jsx', import.meta.url)), 'utf8')

  assert.equal(candidateApplyPath('/student', JOB_ID), `/student/jobs/${JOB_ID}/apply`)
  assert.equal(candidateApplicationsPath('/jobseeker'), '/jobseeker/applications')
  assert.equal(candidateApplicationPath('/student', APPLICATION_ID), `/student/applications/${APPLICATION_ID}`)

  assert.equal(apply.includes('submitJobApplication'), true)
  assert.equal(apply.includes('fetchResumes'), true)
  assert.equal(apply.includes('APPLICATION_RESUME_REQUIRED'), true)
  assert.equal(apply.includes('Go to My Resume'), true)
  assert.equal(apply.includes('Already Applied'), true)
  assert.equal(apply.includes('Application submitted'), true)
  assert.equal(apply.includes('APPLICATION_SNAPSHOT_COPY'), true)
  assert.equal(apply.includes('RadioGroup'), true)
  assert.equal(apply.includes('applicantUserId'), false)
  assert.equal(apply.includes('mockApplications'), false)

  assert.equal(jobDetail.includes('Apply Now'), true)
  assert.equal(jobDetail.includes('Already Applied'), true)
  assert.equal(jobDetail.includes('fetchMyApplicationForJob'), true)
  assert.equal(jobDetail.includes('candidateApplyPath'), true)

  assert.equal(list.includes('My Applications'), true)
  assert.equal(list.includes('fetchMyApplications'), true)
  assert.equal(list.includes('View Details'), true)
  assert.equal(list.includes('PaginationBar'), true)
  assert.equal(list.includes('APPLICATION_EMPTY'), true)
  assert.equal(list.includes('onRetry'), true)
  assert.equal(list.includes('Loading applications'), true)
  assert.equal(list.includes("from '../../data/applicants.js'"), false)

  assert.equal(detail.includes('fetchMyApplication'), true)
  assert.equal(detail.includes('downloadMyApplicationPdf'), true)
  assert.equal(detail.includes('withdrawMyApplication'), true)
  assert.equal(detail.includes('Confirm withdrawal'), true)
  assert.equal(detail.includes('Status history'), true)
  assert.equal(detail.includes('APPLICATION_WITHDRAWN_COPY'), true)
  assert.equal(detail.includes('canWithdrawApplication'), true)
  assert.equal(detail.includes('/api/employer/applications'), false)

  assert.equal(app.includes('<ApplyPage basePath="/student"'), true)
  assert.equal(app.includes('<ApplyPage basePath="/jobseeker"'), true)
  assert.equal(app.includes('<ApplicationsPage basePath="/student"'), true)
  assert.equal(app.includes('<ApplicationsPage basePath="/jobseeker"'), true)
  assert.equal(app.includes('<ApplicationDetailPage basePath="/student"'), true)
  assert.equal(app.includes('<ApplicationDetailPage basePath="/jobseeker"'), true)
  assert.equal(app.includes("roles={['STUDENT']}"), true)
  assert.equal(app.includes("roles={['JOB_SEEKER']}"), true)
  assert.equal(app.includes("roles={['COMPANY_STAFF']}"), true)
  assert.equal(navigation.includes("label: 'Applications', to: '/student/applications'"), true)
  assert.equal(navigation.includes("label: 'Applications', to: '/jobseeker/applications'"), true)

  assert.equal(employerDashboard.includes('fetchMyApplications'), false)
  assert.equal(employerDashboard.includes('listCompanyApplications'), false)
  assert.equal(employerDashboard.includes('fetchEmployerApplications'), false)
  assert.equal(applicants.includes('fetchMyApplications'), false)
  assert.equal(applicants.includes('fetchEmployerApplications'), true)
})
