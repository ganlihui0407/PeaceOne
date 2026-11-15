import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ApiError, clearCsrfToken } from './client.js'
import {
  APPLICATION_CANNOT_BE_UPDATED,
  APPLICATION_LIST_LIMIT,
  APPLICATIONS_UNAVAILABLE,
  COMPANY_PROFILE_REQUIRED,
  EMPLOYER_APPLICATIONS_EMPTY,
  EMPLOYER_SNAPSHOT_COPY,
  REVIEW_NOTE_MAX,
  emptyApplicationStats,
  fetchAdminApplicationStats,
  fetchEmployerApplicationStats,
  parseAdminApplicationStats,
  parseEmployerApplicationStats,
  canRejectEmployerApplication,
  canReviewEmployerApplication,
  canShortlistEmployerApplication,
  downloadEmployerApplicationOriginal,
  downloadEmployerApplicationPdf,
  employerApplicantPath,
  employerApplicantsPath,
  fetchEmployerApplication,
  fetchEmployerApplications,
  loadEmployerApplicationPdfBlob,
  parseApplication,
  rejectEmployerApplication,
  reviewEmployerApplication,
  reviewNoteBody,
  shortlistEmployerApplication,
  userFacingApplicationError,
} from './applications.js'

const originalFetch = globalThis.fetch
const JOB_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const APPLICATION_ID = 'cccccccc-3333-4333-8333-cccccccccccc'
const COMPANY_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const SKILL_ID = '33333333-3333-4333-8333-333333333333'
const APPLICANT_ID = '44444444-4444-4444-8444-444444444444'

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

function fileResponse(bytes, contentType, filename) {
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function jobPayload() {
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
    companyId: COMPANY_ID,
    createdByUserId: USER_ID,
    company: {
      id: COMPANY_ID,
      companyName: 'Northwind Analytics',
      industry: 'Technology',
      location: 'Petaling Jaya',
      website: 'www.northwind.example',
      description: 'A reporting studio.',
    },
    createdBy: { id: USER_ID, fullName: 'Stage Staff' },
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
  }
}

function applicantPayload(overrides = {}) {
  return {
    id: APPLICANT_ID,
    fullName: 'José Müller',
    email: 'jose@peaceone.test',
    phone: '012-888 0001',
    location: 'Ipoh',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Computer Science',
    institution: 'TAR UMT',
    graduationYear: 2025,
    experienceSummary: 'Internship reporting work.',
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
    selectedResumeId: null,
    job: jobPayload(),
    snapshot: snapshotPayload(),
    applicant: applicantPayload(),
    statusEvents: [
      {
        id: 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee',
        fromStatus: null,
        toStatus: 'SUBMITTED',
        reviewNote: null,
        createdAt: '2026-11-13T04:00:00.000Z',
        actor: { id: APPLICANT_ID, fullName: 'José Müller' },
      },
    ],
    ...overrides,
  }
}

function pagePayload(applications = [applicationPayload()], extras = {}) {
  return {
    applications,
    page: extras.page ?? 1,
    limit: extras.limit ?? 20,
    total: extras.total ?? applications.length,
    totalPages: extras.totalPages ?? (applications.length === 0 ? 0 : 1),
  }
}

test('parseApplication reads employer applicant profile and rejects snapshot internals', () => {
  const parsed = parseApplication(applicationPayload())
  assert.equal(parsed.applicant.fullName, 'José Müller')
  assert.equal(parsed.applicant.email, 'jose@peaceone.test')
  assert.equal(parsed.applicant.phone, '012-888 0001')
  assert.equal(parsed.applicant.educationLevel, "Bachelor's Degree")
  assert.equal(parsed.applicant.graduationYear, 2025)
  assert.equal(parsed.applicant.passwordHash, undefined)
  assert.equal(canReviewEmployerApplication(parsed), true)
  assert.equal(canShortlistEmployerApplication(parsed), true)
  assert.equal(canRejectEmployerApplication(parsed), true)
  assert.equal(canReviewEmployerApplication({ status: 'UNDER_REVIEW' }), false)
  assert.equal(canShortlistEmployerApplication({ status: 'SHORTLISTED' }), false)
  assert.equal(canRejectEmployerApplication({ status: 'WITHDRAWN' }), false)
  assert.deepEqual(reviewNoteBody('  keep this  '), { reviewNote: 'keep this' })
  assert.deepEqual(reviewNoteBody('   '), {})
  assert.equal(reviewNoteBody('n'.repeat(REVIEW_NOTE_MAX + 10)).reviewNote.length, REVIEW_NOTE_MAX)

  const emptyProfile = parseApplication(applicationPayload({
    applicant: applicantPayload({
      phone: null,
      location: null,
      educationLevel: null,
      fieldOfStudy: null,
      institution: null,
      graduationYear: null,
      experienceSummary: null,
    }),
  }))
  assert.equal(emptyProfile.applicant.phone, null)
  assert.equal(emptyProfile.applicant.graduationYear, null)

  assert.throws(
    () => parseApplication(applicationPayload({ snapshot: snapshotPayload({ structuredSnapshot: {} }) })),
    (error) => error instanceof ApiError,
  )
  assert.throws(
    () => parseApplication(applicationPayload({ originalFileStoredFilename: 'resume-snapshot.pdf' })),
    (error) => error instanceof ApiError,
  )
})

test('fetchEmployerApplications sends search, status, jobId and pagination', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    return jsonResponse(200, pagePayload([applicationPayload()], { page: 2, limit: 20, total: 21, totalPages: 2 }))
  }

  const result = await fetchEmployerApplications({
    q: 'José',
    status: 'SUBMITTED',
    jobId: JOB_ID,
    page: 2,
    limit: APPLICATION_LIST_LIMIT,
  })
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].applicant.fullName, 'José Müller')
  assert.equal(result.page, 2)
  assert.equal(result.total, 21)
  assert.equal(
    calls[0],
    `/api/employer/applications?q=Jos%C3%A9&status=SUBMITTED&jobId=${JOB_ID}&page=2&limit=20`,
  )
})

test('fetchEmployerApplications treats an empty list as valid', async () => {
  globalThis.fetch = async () => jsonResponse(200, pagePayload([], { total: 0, totalPages: 0 }))
  const result = await fetchEmployerApplications({ page: 1, limit: 20 })
  assert.deepEqual(result.items, [])
  assert.equal(result.total, 0)
})

test('fetchEmployerApplication rejects invalid ids and missing records', async () => {
  globalThis.fetch = async (path) => {
    if (path === `/api/employer/applications/${APPLICATION_ID}`) {
      return jsonResponse(200, { application: applicationPayload() })
    }
    return jsonResponse(404, { error: 'Not found' })
  }
  const detail = await fetchEmployerApplication(APPLICATION_ID)
  assert.equal(detail.applicant.institution, 'TAR UMT')
  await assert.rejects(
    () => fetchEmployerApplication('not-a-uuid'),
    (error) => error instanceof ApiError && error.status === 400,
  )
  await assert.rejects(
    () => fetchEmployerApplication(JOB_ID),
    (error) => error instanceof ApiError && error.status === 404,
  )
})

test('employer status actions post CSRF without client identities', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body, headers: init.headers })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-employer' })
    }
    if (String(path).endsWith('/review')) {
      return jsonResponse(200, { application: applicationPayload({ status: 'UNDER_REVIEW' }) })
    }
    if (String(path).endsWith('/shortlist')) {
      return jsonResponse(200, { application: applicationPayload({ status: 'SHORTLISTED' }) })
    }
    if (String(path).endsWith('/reject')) {
      return jsonResponse(200, { application: applicationPayload({ status: 'REJECTED' }) })
    }
    throw new Error(`unexpected ${path}`)
  }

  const reviewed = await reviewEmployerApplication(APPLICATION_ID, { reviewNote: '  start review  ' })
  assert.equal(reviewed.status, 'UNDER_REVIEW')
  const shortlisted = await shortlistEmployerApplication(APPLICATION_ID)
  assert.equal(shortlisted.status, 'SHORTLISTED')
  const rejected = await rejectEmployerApplication(APPLICATION_ID, { reviewNote: 'Not a match' })
  assert.equal(rejected.status, 'REJECTED')

  const review = calls.find((call) => String(call.path).endsWith('/review'))
  assert.equal(review.headers['x-csrf-token'], 'csrf-employer')
  assert.deepEqual(JSON.parse(review.body), { reviewNote: 'start review' })
  assert.equal(JSON.parse(review.body).companyId, undefined)
  assert.equal(JSON.parse(review.body).applicantUserId, undefined)
  assert.equal(JSON.parse(review.body).status, undefined)
  assert.deepEqual(JSON.parse(calls.find((call) => String(call.path).endsWith('/shortlist')).body), {})
  assert.deepEqual(JSON.parse(calls.find((call) => String(call.path).endsWith('/reject')).body), {
    reviewNote: 'Not a match',
  })
})

test('employer actions surface blocked transitions and missing company profile', async () => {
  globalThis.fetch = async (path) => {
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-blocked' })
    }
    return jsonResponse(409, { error: APPLICATION_CANNOT_BE_UPDATED })
  }
  await assert.rejects(
    () => reviewEmployerApplication(APPLICATION_ID),
    (error) => error instanceof ApiError && error.status === 409 && error.message === APPLICATION_CANNOT_BE_UPDATED,
  )
  assert.equal(
    userFacingApplicationError(new ApiError(APPLICATION_CANNOT_BE_UPDATED, 409)),
    APPLICATION_CANNOT_BE_UPDATED,
  )
  assert.equal(
    userFacingApplicationError(new ApiError(COMPANY_PROFILE_REQUIRED, 403)),
    COMPANY_PROFILE_REQUIRED,
  )
  assert.equal(userFacingApplicationError(new ApiError('Forbidden', 403)), 'You cannot manage these applications with this account.')
})

test('employer resume download helpers call private snapshot endpoints', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    if (String(path).endsWith('/resume.pdf')) {
      return fileResponse('%PDF-1.4', 'application/pdf', 'submitted-resume.pdf')
    }
    if (String(path).endsWith('/resume.original')) {
      return fileResponse('DOCX', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'original-resume.docx')
    }
    throw new Error(`unexpected ${path}`)
  }

  const application = parseApplication(applicationPayload())
  await downloadEmployerApplicationPdf(application)
  await downloadEmployerApplicationOriginal(application)
  const blob = await loadEmployerApplicationPdfBlob(application)
  assert.equal(blob.size > 0, true)
  assert.equal(calls.includes(`/api/employer/applications/${APPLICATION_ID}/resume.pdf`), true)
  assert.equal(calls.includes(`/api/employer/applications/${APPLICATION_ID}/resume.original`), true)
  await assert.rejects(
    () => downloadEmployerApplicationOriginal(parseApplication(applicationPayload({
      snapshot: snapshotPayload({ hasOriginalFile: false, originalFileFilename: null }),
    }))),
    (error) => error instanceof ApiError && error.status === 400,
  )
})

test('employer applicant pages wire list, details, actions and role protection', () => {
  const list = readFileSync(fileURLToPath(new URL('../pages/employer/Applicants.jsx', import.meta.url)), 'utf8')
  const detail = readFileSync(fileURLToPath(new URL('../pages/employer/ApplicantDetails.jsx', import.meta.url)), 'utf8')
  const dashboard = readFileSync(fileURLToPath(new URL('../pages/employer/Dashboard.jsx', import.meta.url)), 'utf8')
  const jobDetails = readFileSync(fileURLToPath(new URL('../pages/employer/JobPostingDetails.jsx', import.meta.url)), 'utf8')
  const adminDashboard = readFileSync(fileURLToPath(new URL('../pages/admin/Dashboard.jsx', import.meta.url)), 'utf8')
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
  const navigation = readFileSync(fileURLToPath(new URL('../data/navigation.js', import.meta.url)), 'utf8')
  const candidateDetail = readFileSync(fileURLToPath(new URL('../pages/shared/ApplicationDetailPage.jsx', import.meta.url)), 'utf8')

  assert.equal(employerApplicantsPath(), '/employer/applicants')
  assert.equal(employerApplicantsPath({ jobId: JOB_ID }), `/employer/applicants?jobId=${JOB_ID}`)
  assert.equal(employerApplicantPath(APPLICATION_ID), `/employer/applicants/${APPLICATION_ID}`)
  assert.equal(
    employerApplicantPath(APPLICATION_ID, { jobId: JOB_ID, status: 'SUBMITTED' }),
    `/employer/applicants/${APPLICATION_ID}?status=SUBMITTED&jobId=${JOB_ID}`,
  )

  assert.equal(list.includes('fetchEmployerApplications'), true)
  assert.equal(list.includes('fetchStaffJobs'), true)
  assert.equal(list.includes('applicant-search'), true)
  assert.equal(list.includes('applicant-status'), true)
  assert.equal(list.includes('applicant-job'), true)
  assert.equal(list.includes('PaginationBar'), true)
  assert.equal(list.includes('Loading applications'), true)
  assert.equal(list.includes('EMPLOYER_APPLICATIONS_EMPTY'), true)
  assert.equal(list.includes('onRetry'), true)
  assert.equal(list.includes('View Details'), true)
  assert.equal(list.includes("from '../../data/applicants.js'"), false)
  assert.equal(list.includes('compatibility'), false)
  assert.equal(list.includes('companyId'), false)

  assert.equal(detail.includes('fetchEmployerApplication'), true)
  assert.equal(detail.includes('downloadEmployerApplicationPdf'), true)
  assert.equal(detail.includes('downloadEmployerApplicationOriginal'), true)
  assert.equal(detail.includes('loadEmployerApplicationPdfBlob'), true)
  assert.equal(detail.includes('View submitted PDF'), true)
  assert.equal(detail.includes('Download submitted PDF'), true)
  assert.equal(detail.includes('Download original resume'), true)
  assert.equal(detail.includes('EMPLOYER_SNAPSHOT_COPY'), true)
  assert.equal(detail.includes('reviewEmployerApplication'), true)
  assert.equal(detail.includes('shortlistEmployerApplication'), true)
  assert.equal(detail.includes('rejectEmployerApplication'), true)
  assert.equal(detail.includes('Confirm rejection'), true)
  assert.equal(detail.includes('Internal review note'), true)
  assert.equal(detail.includes('REVIEW_NOTE_MAX'), true)
  assert.equal(detail.includes('Status history'), true)
  assert.equal(detail.includes('Move to Interview'), false)
  assert.equal(detail.includes('Offer'), false)
  assert.equal(detail.includes('compatibility'), false)
  assert.equal(detail.includes("from '../../data/applicants.js'"), false)
  assert.equal(detail.includes('structuredSnapshot'), false)
  assert.equal(detail.includes('originalFileStoredFilename'), false)

  assert.equal(candidateDetail.includes('Internal note'), false)
  assert.equal(candidateDetail.includes('reviewEmployerApplication'), false)
  assert.equal(candidateDetail.includes('/api/employer/applications'), false)

  assert.equal(dashboard.includes('StaffApplicationStatsSection'), true)
  assert.equal(dashboard.includes('fetchEmployerApplicationStats'), false)
  assert.equal(jobDetails.includes('View Applicants'), true)
  assert.equal(jobDetails.includes('employerApplicantsPath'), true)
  assert.equal(adminDashboard.includes('AdminApplicationStatsSection'), true)
  assert.equal(adminDashboard.includes('/employer/applicants'), false)
  assert.equal(adminDashboard.includes('fetchEmployerApplication'), false)
  assert.equal(list.includes('employerApplicantPath(application.id,'), true)
  assert.equal(detail.includes('useSearchParams'), true)
  assert.equal(EMPLOYER_APPLICATIONS_EMPTY.title.includes('No applications'), true)
  assert.equal(EMPLOYER_SNAPSHOT_COPY.includes('immutable'), true)

  assert.equal(app.includes('<Applicants />'), true)
  assert.equal(app.includes('<ApplicantDetails />'), true)
  assert.equal(app.includes("roles={['COMPANY_STAFF']}"), true)
  assert.equal(navigation.includes("label: 'Applicants', to: '/employer/applicants'"), true)
})

test('employer and admin stats parsers keep genuine counts and omit applicant records', async () => {
  const byStatus = {
    SUBMITTED: 2,
    UNDER_REVIEW: 1,
    SHORTLISTED: 0,
    INTERVIEW: 0,
    OFFERED: 0,
    REJECTED: 1,
    WITHDRAWN: 0,
  }
  const employer = parseEmployerApplicationStats({
    total: 4,
    byStatus,
    jobs: [
      {
        id: JOB_ID,
        title: 'Junior Software Developer',
        status: 'PUBLISHED',
        applicationCount: 4,
      },
    ],
  })
  assert.equal(employer.total, 4)
  assert.equal(employer.byStatus.SUBMITTED, 2)
  assert.equal(employer.jobs[0].applicationCount, 4)
  assert.equal(emptyApplicationStats().total, 0)

  const admin = parseAdminApplicationStats({
    total: 4,
    byStatus,
    companiesWithApplications: 1,
    applications: [{ id: APPLICATION_ID, fullName: 'Should not parse' }],
  })
  assert.equal(admin.total, 4)
  assert.equal(admin.companiesWithApplications, 1)
  assert.equal(admin.applications, undefined)

  globalThis.fetch = async (path) => {
    if (path === '/api/employer/applications/stats') {
      return jsonResponse(200, { total: 0, byStatus: emptyApplicationStats().byStatus, jobs: [] })
    }
    if (path === '/api/admin/applications/stats') {
      return jsonResponse(200, {
        total: 0,
        byStatus: emptyApplicationStats().byStatus,
        companiesWithApplications: 0,
      })
    }
    throw new Error(`unexpected ${path}`)
  }
  assert.equal((await fetchEmployerApplicationStats()).total, 0)
  assert.equal((await fetchAdminApplicationStats()).companiesWithApplications, 0)
})

test('employer application helpers map unauthorized and network failures', async () => {
  assert.equal(userFacingApplicationError(new ApiError('Sign in', 401)), 'Sign in again to manage applications.')
  assert.equal(userFacingApplicationError(new ApiError('boom', 500)), APPLICATIONS_UNAVAILABLE)

  globalThis.fetch = async () => {
    throw new Error('offline')
  }
  await assert.rejects(
    () => fetchEmployerApplications(),
    (error) => error instanceof ApiError && error.message === APPLICATIONS_UNAVAILABLE,
  )
})
