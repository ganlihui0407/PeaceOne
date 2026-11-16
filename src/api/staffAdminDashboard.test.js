import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { DASHBOARD_UNAVAILABLE, userFacingDashboardError } from './candidateDashboard.js'
import { ApiError, clearCsrfToken } from './client.js'
import { isAbortError } from './esco.js'
import {
  ADMIN_ACTIVITY_UNAVAILABLE,
  ADMIN_JOBS_UNAVAILABLE,
  ADMIN_LEARNING_UNAVAILABLE,
  ADMIN_SHORTCUTS,
  ADMIN_USERS_UNAVAILABLE,
  STAFF_ADMIN_DASHBOARD_UNAVAILABLE,
  STAFF_APPLICATIONS_EMPTY,
  STAFF_COMPANY_EMPTY,
  STAFF_INTERVIEWS_UNAVAILABLE,
  STAFF_JOBS_UNAVAILABLE,
  STAFF_PROFILE_INCOMPLETE,
  buildAdminDashboard,
  buildStaffDashboard,
  fetchAdminDashboard,
  fetchStaffDashboard,
  staffJobCountsFromApplicationStats,
  staffProfileHighlights,
} from './staffAdminDashboard.js'

const originalFetch = globalThis.fetch
const STAFF_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_ID = '22222222-2222-4222-8222-222222222222'

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

function staffPayload(overrides = {}) {
  return {
    id: STAFF_ID,
    email: 'stage65.staff@peaceone.test',
    fullName: 'Stage Six Five Staff',
    phone: '03-555 0100',
    role: 'COMPANY_STAFF',
    accountStatus: 'ACTIVE',
    educationLevel: null,
    fieldOfStudy: null,
    institution: null,
    graduationYear: null,
    location: 'Petaling Jaya',
    experienceSummary: null,
    jobTitle: 'Talent Partner',
    department: 'People Operations',
    ...overrides,
  }
}

function adminPayload(overrides = {}) {
  return {
    id: ADMIN_ID,
    email: 'stage65.admin@peaceone.test',
    fullName: 'Stage Six Five Admin',
    phone: '03-555 0200',
    role: 'ADMIN',
    accountStatus: 'ACTIVE',
    educationLevel: null,
    fieldOfStudy: null,
    institution: null,
    graduationYear: null,
    location: null,
    experienceSummary: null,
    jobTitle: null,
    department: null,
    ...overrides,
  }
}

test('staffProfileHighlights use the signed-in job title, department and location only', () => {
  assert.deepEqual(staffProfileHighlights(staffPayload()), [
    'Talent Partner',
    'People Operations',
    'Petaling Jaya',
  ])
  assert.deepEqual(
    staffProfileHighlights(staffPayload({ jobTitle: null, department: null, location: null })),
    [],
  )
  assert.deepEqual(staffProfileHighlights(staffPayload({ jobTitle: '', department: null, location: 'KL' })), ['KL'])
})

test('buildStaffDashboard maps the signed-in staff profile and does not invent recruitment totals', () => {
  const dashboard = buildStaffDashboard(staffPayload())
  assert.equal(dashboard.fullName, 'Stage Six Five Staff')
  assert.equal(dashboard.firstName, 'Stage')
  assert.equal(dashboard.email, 'stage65.staff@peaceone.test')
  assert.equal(dashboard.role, 'COMPANY_STAFF')
  assert.equal(dashboard.jobTitle, 'Talent Partner')
  assert.equal(dashboard.department, 'People Operations')
  assert.equal(dashboard.location, 'Petaling Jaya')
  assert.equal(dashboard.phone, '03-555 0100')
  assert.deepEqual(dashboard.profileHighlights, [
    'Talent Partner',
    'People Operations',
    'Petaling Jaya',
  ])
  assert.equal(dashboard.activeJobs, undefined)
  assert.equal(dashboard.recentApplications, undefined)
  assert.equal(dashboard.upcomingInterviews, undefined)
  assert.equal(dashboard.stats, undefined)
  assert.equal(dashboard.passwordHash, undefined)
  assert.equal(dashboard.companyName, undefined)
})

test('buildAdminDashboard maps the signed-in administrator profile and does not invent platform totals', () => {
  const dashboard = buildAdminDashboard(adminPayload())
  assert.equal(dashboard.fullName, 'Stage Six Five Admin')
  assert.equal(dashboard.firstName, 'Stage')
  assert.equal(dashboard.email, 'stage65.admin@peaceone.test')
  assert.equal(dashboard.role, 'ADMIN')
  assert.equal(dashboard.roleLabel, 'Administrator')
  assert.equal(dashboard.accountStatus, 'ACTIVE')
  assert.equal(dashboard.accountStatusLabel, 'Active')
  assert.equal(dashboard.phone, '03-555 0200')
  assert.equal(dashboard.stats, undefined)
  assert.equal(dashboard.reviewStats, undefined)
  assert.equal(dashboard.activity, undefined)
  assert.equal(dashboard.totalUsers, undefined)
  assert.equal(dashboard.passwordHash, undefined)
})

test('fetchStaffDashboard loads the signed-in staff profile and company only', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, headers: init.headers })
    if (path === '/api/me') {
      return jsonResponse(200, { user: staffPayload() })
    }
    if (path === '/api/me/company') {
      return jsonResponse(200, { company: null })
    }
    throw new Error(`unexpected ${path}`)
  }

  const dashboard = await fetchStaffDashboard()
  assert.equal(dashboard.fullName, 'Stage Six Five Staff')
  assert.equal(dashboard.jobTitle, 'Talent Partner')
  assert.equal(dashboard.company, null)
  assert.equal(dashboard.applicationStats.total, 0)
  assert.equal(dashboard.applicationStats.jobs.length, 0)
  assert.equal(
    calls.some((call) => call.path === '/api/me' && call.method === 'GET'),
    true,
  )
  assert.equal(
    calls.some((call) => call.path === '/api/me/company' && call.method === 'GET'),
    true,
  )
  assert.equal(calls.length, 2)
  assert.equal(
    calls.every((call) => call.headers['x-csrf-token'] === undefined),
    true,
  )
  assert.equal(
    calls.every((call) => !String(call.path).includes('userId=')),
    true,
  )
  assert.equal(
    calls.every((call) => !String(call.path).includes('companyId=')),
    true,
  )
})

test('fetchStaffDashboard loads genuine application stats when a company profile exists', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    if (path === '/api/me') {
      return jsonResponse(200, { user: staffPayload() })
    }
    if (path === '/api/me/company') {
      return jsonResponse(200, {
        company: {
          id: '33333333-3333-4333-8333-333333333333',
          companyName: 'Northwind',
          industry: 'Software',
          location: 'Kuala Lumpur',
          website: null,
          description: null,
          createdAt: '2026-11-13T00:00:00.000Z',
          updatedAt: '2026-11-13T00:00:00.000Z',
        },
      })
    }
    if (path === '/api/employer/applications/stats') {
      return jsonResponse(200, {
        total: 2,
        byStatus: {
          SUBMITTED: 1,
          UNDER_REVIEW: 1,
          SHORTLISTED: 0,
          INTERVIEW: 0,
          OFFERED: 0,
          REJECTED: 0,
          WITHDRAWN: 0,
        },
        jobs: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            title: 'Backend Engineer',
            status: 'PUBLISHED',
            applicationCount: 2,
          },
        ],
      })
    }
    if (path === '/api/employer/interviews/stats') {
      return jsonResponse(200, {
        total: 0,
        byStatus: {
          PROPOSED: 0,
          RESCHEDULE_REQUESTED: 0,
          CONFIRMED: 0,
          DECLINED: 0,
          COMPLETED: 0,
          CANCELLED: 0,
        },
        upcomingConfirmed: 0,
      })
    }
    if (String(path).startsWith('/api/employer/interviews?')) {
      return jsonResponse(200, {
        interviews: [],
        page: 1,
        limit: 5,
        total: 0,
        totalPages: 0,
      })
    }
    throw new Error(`unexpected ${path}`)
  }

  const dashboard = await fetchStaffDashboard()
  assert.equal(dashboard.company.companyName, 'Northwind')
  assert.equal(dashboard.applicationStats.total, 2)
  assert.equal(dashboard.applicationStats.byStatus.UNDER_REVIEW, 1)
  assert.equal(dashboard.applicationStats.jobs[0].applicationCount, 2)
  assert.equal(calls.some((call) => call.path === '/api/employer/applications/stats'), true)
  assert.equal(calls.some((call) => call.path === '/api/employer/interviews/stats'), true)
  assert.equal(dashboard.interviewStats.total, 0)
  assert.equal(dashboard.upcomingInterviews.length, 0)
  assert.equal(calls.length, 5)
})

test('fetchAdminDashboard loads the signed-in profile and aggregate application stats', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    if (path === '/api/me') {
      return jsonResponse(200, { user: adminPayload() })
    }
    if (path === '/api/admin/applications/stats') {
      return jsonResponse(200, {
        total: 0,
        byStatus: {
          SUBMITTED: 0,
          UNDER_REVIEW: 0,
          SHORTLISTED: 0,
          INTERVIEW: 0,
          OFFERED: 0,
          REJECTED: 0,
          WITHDRAWN: 0,
        },
        companiesWithApplications: 0,
      })
    }
    if (path === '/api/admin/interviews/stats') {
      return jsonResponse(200, {
        total: 0,
        byStatus: {
          PROPOSED: 0,
          RESCHEDULE_REQUESTED: 0,
          CONFIRMED: 0,
          DECLINED: 0,
          COMPLETED: 0,
          CANCELLED: 0,
        },
        companiesWithInterviews: 0,
      })
    }
    if (path === '/api/admin/stats') {
      return jsonResponse(200, {
        users: { total: 0, students: 0, jobSeekers: 0, companyStaff: 0, admins: 0 },
        companies: { total: 0 },
        jobs: { published: 0, draft: 0 },
        learning: { publishedCourses: 0, enrollments: 0, completed: 0 },
      })
    }
    throw new Error(`unexpected ${path}`)
  }

  const dashboard = await fetchAdminDashboard()
  assert.equal(dashboard.fullName, 'Stage Six Five Admin')
  assert.equal(dashboard.roleLabel, 'Administrator')
  assert.equal(dashboard.applicationStats.total, 0)
  assert.equal(dashboard.applicationStats.companiesWithApplications, 0)
  assert.equal(dashboard.interviewStats.total, 0)
  assert.equal(dashboard.interviewStats.companiesWithInterviews, 0)
  assert.equal(calls.some((call) => call.path === '/api/admin/interviews/stats'), true)
  assert.equal(calls.some((call) => call.path === '/api/me' && call.method === 'GET'), true)
  assert.equal(calls.some((call) => call.path === '/api/admin/applications/stats'), true)
  assert.equal(calls.some((call) => call.path === '/api/admin/stats'), true)
  assert.equal(dashboard.applicationStats.applications, undefined)
  assert.equal(
    calls.every((call) => !String(call.path).includes('userId=')),
    true,
  )
})

test('staff and admin dashboards stay empty when the signed-in profile has no extra details', () => {
  const staff = buildStaffDashboard(
    staffPayload({ jobTitle: null, department: null, location: null, phone: null }),
  )
  const admin = buildAdminDashboard(adminPayload({ phone: null }))
  assert.deepEqual(staff.profileHighlights, [])
  assert.equal(staff.jobTitle, null)
  assert.equal(admin.phone, null)
  assert.equal(STAFF_JOBS_UNAVAILABLE.title.includes('not connected'), false)
  assert.equal(STAFF_JOBS_UNAVAILABLE.title.includes('job postings'), true)
  assert.equal(STAFF_JOBS_UNAVAILABLE.description.includes('stored jobs'), true)
  assert.deepEqual(
    staffJobCountsFromApplicationStats({
      jobs: [
        { status: 'PUBLISHED' },
        { status: 'PUBLISHED' },
        { status: 'DRAFT' },
      ],
    }),
    { total: 3, published: 2, draft: 1, closed: 0, suspended: 0 },
  )
  assert.equal(STAFF_APPLICATIONS_EMPTY.title.includes('No applications'), true)
  assert.equal(STAFF_APPLICATIONS_EMPTY.description.includes('zero'), true)
  assert.equal(STAFF_INTERVIEWS_UNAVAILABLE.title.includes('upcoming'), true)
  assert.equal(STAFF_COMPANY_EMPTY.title.includes('saved yet'), true)
  assert.equal(ADMIN_USERS_UNAVAILABLE.title.includes('PostgreSQL'), true)
  assert.equal(ADMIN_JOBS_UNAVAILABLE.title.includes('not connected'), false)
  assert.equal(ADMIN_JOBS_UNAVAILABLE.title.includes('Job Monitoring'), true)
  assert.equal(ADMIN_LEARNING_UNAVAILABLE.title.includes('PostgreSQL'), true)
  assert.equal(ADMIN_ACTIVITY_UNAVAILABLE.title.includes('No recent platform events'), true)
  assert.equal(STAFF_PROFILE_INCOMPLETE.description.includes('Empty fields stay empty'), true)
  assert.deepEqual(
    ADMIN_SHORTCUTS.map((item) => item.to),
    ['/admin/users', '/admin/companies', '/admin/jobs', '/admin/learning', '/admin/reports'],
  )
})

test('API failures stay user-facing and do not fall back to mock employer or admin data', async () => {
  globalThis.fetch = async () => jsonResponse(500, { error: 'secret-dsn' })
  await assert.rejects(() => fetchStaffDashboard(), (error) => error instanceof ApiError)
  await assert.rejects(() => fetchAdminDashboard(), (error) => error instanceof ApiError)
  assert.equal(userFacingDashboardError(new ApiError('secret-dsn', 500)), DASHBOARD_UNAVAILABLE)
  assert.equal(userFacingDashboardError(new ApiError('Unauthenticated', 401)), 'Sign in again to view your dashboard.')
  assert.equal(userFacingDashboardError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(
    userFacingDashboardError(new ApiError('Forbidden', 403)),
    'You cannot view this dashboard with this account.',
  )
  assert.equal(STAFF_ADMIN_DASHBOARD_UNAVAILABLE.includes('unavailable'), true)
})

test('staff and admin dashboard fetches honour abort signals', async () => {
  const controller = new AbortController()
  globalThis.fetch = async (_path, init) => {
    assert.equal(init.signal, controller.signal)
    const error = new Error('aborted')
    error.name = 'AbortError'
    throw error
  }
  controller.abort()
  await assert.rejects(() => fetchStaffDashboard({ signal: controller.signal }), (error) => isAbortError(error))
  await assert.rejects(() => fetchAdminDashboard({ signal: controller.signal }), (error) => isAbortError(error))
})

test('employer and admin dashboards use signed-in profile data and drop mock recruitment metrics', () => {
  const employer = readFileSync(fileURLToPath(new URL('../pages/employer/Dashboard.jsx', import.meta.url)), 'utf8')
  const admin = readFileSync(fileURLToPath(new URL('../pages/admin/Dashboard.jsx', import.meta.url)), 'utf8')
  const panels = readFileSync(
    fileURLToPath(new URL('../pages/shared/StaffAdminDashboardPanels.jsx', import.meta.url)),
    'utf8',
  )
  const hook = readFileSync(fileURLToPath(new URL('../hooks/useStaffAdminDashboard.js', import.meta.url)), 'utf8')
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
  const student = readFileSync(fileURLToPath(new URL('../pages/student/Dashboard.jsx', import.meta.url)), 'utf8')
  const jobSeeker = readFileSync(fileURLToPath(new URL('../pages/jobseeker/Dashboard.jsx', import.meta.url)), 'utf8')
  const company = readFileSync(fileURLToPath(new URL('../pages/employer/CompanyProfile.jsx', import.meta.url)), 'utf8')
  const api = readFileSync(fileURLToPath(new URL('./staffAdminDashboard.js', import.meta.url)), 'utf8')
  const adminPlatform = readFileSync(fileURLToPath(new URL('./adminPlatform.js', import.meta.url)), 'utf8')

  assert.equal(employer.includes('useStaffDashboard'), true)
  assert.equal(admin.includes('useAdminDashboard'), true)
  assert.equal(hook.includes('fetchStaffDashboard'), true)
  assert.equal(hook.includes('fetchAdminDashboard'), true)
  assert.equal(api.includes("fetchMeProfile"), true)
  assert.equal(api.includes('/api/me/skills'), false)
  assert.equal(api.includes('/api/me/career-target'), false)
  assert.equal(api.includes('/api/me/skill-gap'), false)
  assert.equal(api.includes('/api/masco'), false)
  assert.equal(api.includes('/api/jobs'), false)
  assert.equal(api.includes('/api/applicants'), false)
  assert.equal(api.includes('fetchEmployerInterviewStats'), true)
  assert.equal(api.includes('fetchEmployerInterviews'), true)
  assert.equal(api.includes('fetchAdminInterviewStats'), true)
  assert.equal(api.includes('/api/users'), false)
  assert.equal(api.includes('/api/reports'), false)

  for (const source of [employer, admin, panels, hook, api]) {
    assert.equal(source.includes('employerDashboardData'), false)
    assert.equal(source.includes('adminDashboardData'), false)
    assert.equal(source.includes('Nexa Digital'), false)
    assert.equal(source.includes('Emily Tan'), false)
    assert.equal(source.includes('passwordHash'), false)
    assert.equal(source.includes('1,248'), false)
    assert.equal(source.includes("'42'"), false)
    assert.equal(source.includes('item.compatibility'), false)
    assert.equal(source.includes('Compatibility'), false)
    assert.equal(source.includes('72%'), false)
    assert.equal(source.includes('useCandidateDashboard'), false)
    assert.equal(source.includes('fetchCandidateDashboard'), false)
  }

  assert.equal(panels.includes('STAFF_JOBS_UNAVAILABLE'), true)
  assert.equal(panels.includes('StaffJobCountsSection'), true)
  assert.equal(panels.includes('StaffJobsUnavailableSection'), false)
  assert.equal(panels.includes('StaffApplicationStatsSection'), true)
  assert.equal(panels.includes('STAFF_APPLICATIONS_EMPTY'), true)
  assert.equal(panels.includes('StaffApplicantsUnavailableSection'), false)
  assert.equal(panels.includes('StaffUpcomingInterviewsSection'), true)
  assert.equal(panels.includes('STAFF_INTERVIEWS_EMPTY'), true)
  assert.equal(panels.includes('AdminInterviewStatsSection'), true)
  assert.equal(panels.includes('STAFF_COMPANY_EMPTY'), true)
  assert.equal(employer.includes('StaffCompanySection'), true)
  assert.equal(employer.includes('StaffJobCountsSection'), true)
  assert.equal(employer.includes('StaffJobsUnavailableSection'), false)
  assert.equal(employer.includes('StaffApplicationStatsSection'), true)
  assert.equal(employer.includes('StaffUpcomingInterviewsSection'), true)
  assert.equal(employer.includes('Applicants and interviews are not stored yet'), false)
  assert.equal(panels.includes('ADMIN_USERS_UNAVAILABLE'), true)
  assert.equal(panels.includes('ADMIN_ACTIVITY_UNAVAILABLE'), true)
  assert.equal(panels.includes('AdminRecentActivitySection'), true)
  assert.equal(panels.includes('fetchAdminRecentActivity'), true)
  assert.equal(panels.includes('PaginationBar'), true)
  assert.equal(employer.includes('Create Job Posting'), true)
  assert.equal(admin.includes('AdminApplicationStatsSection'), true)
  assert.equal(admin.includes('AdminInterviewStatsSection'), true)
  assert.equal(admin.includes('AdminPlatformStatsSection'), true)
  assert.equal(admin.includes('AdminShortcutsSection'), true)
  assert.equal(admin.includes('AdminRecentActivitySection'), true)
  assert.equal(admin.includes('AdminActivityUnavailableSection'), false)
  assert.equal(adminPlatform.includes('fetchAdminRecentActivity'), true)
  assert.equal(adminPlatform.includes('/api/admin/activity'), true)

  assert.equal(app.includes('<EmployerDashboard />'), true)
  assert.equal(app.includes('<AdminDashboard />'), true)
  assert.equal(app.includes("roles={['COMPANY_STAFF']}"), true)
  assert.equal(app.includes("roles={['ADMIN']}"), true)

  assert.equal(student.includes('useCandidateDashboard'), true)
  assert.equal(jobSeeker.includes('useCandidateDashboard'), true)
  assert.equal(student.includes('useStaffDashboard'), false)
  assert.equal(jobSeeker.includes('useAdminDashboard'), false)
  assert.equal(company.includes('useStaffDashboard'), false)
  assert.equal(company.includes('fetchMeProfile'), false)
  assert.equal(company.includes('useCompanyProfileForm'), true)
  assert.equal(company.includes('nexaDigital'), false)
})
