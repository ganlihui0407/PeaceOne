import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, clearCsrfToken } from './client.js'
import {
  emptyJobForm,
  hasJobSkill,
  jobFormToWriteBody,
  jobToFormValues,
  validateJobForm,
} from './jobForm.js'
import {
  COMPANY_PROFILE_REQUIRED,
  JOBS_UNAVAILABLE,
  JOB_CANNOT_BE_PUBLISHED,
  SUSPEND_REASON_REQUIRED,
  adminJobPath,
  buildJobWriteBody,
  canDeleteJob,
  canPublishJob,
  closeAdminJob,
  closeStaffJob,
  createStaffJob,
  deleteStaffJob,
  fetchAdminJob,
  fetchAdminJobs,
  fetchPublishedJob,
  fetchPublishedJobs,
  fetchStaffJobs,
  formatJobStatus,
  formatSalaryRange,
  isAbortError,
  parseJob,
  parseJobPage,
  publishStaffJob,
  staffJobEditPath,
  staffJobPath,
  suspendAdminJob,
  updateStaffJob,
  userFacingJobError,
  userFacingPublishedJobError,
} from './jobs.js'

const originalFetch = globalThis.fetch
const JOB_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const COMPANY_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const SKILL_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_SKILL_ID = '44444444-4444-4444-8444-444444444444'

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

function skillPayload(overrides = {}) {
  return {
    id: SKILL_ID,
    sourceUri: 'http://data.europa.eu/esco/skill/example',
    preferredLabel: 'use ICT safety measures',
    skillType: 'knowledge',
    sourceSystem: 'ESCO',
    ...overrides,
  }
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
    status: 'DRAFT',
    publishedAt: null,
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
        skill: skillPayload(),
      },
    ],
    statusEvents: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        fromStatus: null,
        toStatus: 'DRAFT',
        note: null,
        createdAt: '2026-11-13T02:40:00.000Z',
        actor: { id: USER_ID, fullName: 'Stage Staff' },
      },
    ],
    ...overrides,
  }
}

function pagePayload(jobs = [jobPayload()], extras = {}) {
  return {
    jobs,
    page: 1,
    limit: 20,
    total: jobs.length,
    totalPages: 1,
    ...extras,
  }
}

function candidateJobPayload(overrides = {}) {
  const record = jobPayload({
    status: 'PUBLISHED',
    publishedAt: '2026-11-13T03:00:00.000Z',
    ...overrides,
  })
  delete record.companyId
  delete record.createdByUserId
  delete record.createdBy
  delete record.statusEvents
  return record
}

test('fetchStaffJobs loads paginated company jobs and query parameters', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    if (path === '/api/me/jobs?q=analyst&status=DRAFT&page=2&limit=20') {
      return jsonResponse(200, pagePayload())
    }
    throw new Error(`unexpected ${path}`)
  }
  const result = await fetchStaffJobs({ q: 'analyst', status: 'DRAFT', page: 2, limit: 20 })
  assert.equal(result.items[0].title, 'Junior Software Developer')
  assert.equal(result.page, 1)
  assert.equal(result.total, 1)
  assert.equal(result.items[0].company.companyName, 'Northwind Analytics')
  assert.equal(calls[0].method, 'GET')
})

test('fetchAdminJobs searches title or company and filters status', async () => {
  globalThis.fetch = async (path) => {
    assert.equal(path, '/api/admin/jobs?q=Northwind&status=PUBLISHED&page=1&limit=20')
    return jsonResponse(200, pagePayload([jobPayload({ status: 'PUBLISHED', publishedAt: '2026-11-13T03:00:00.000Z' })]))
  }
  const result = await fetchAdminJobs({ q: 'Northwind', status: 'PUBLISHED', page: 1, limit: 20 })
  assert.equal(result.items[0].status, 'PUBLISHED')
})

test('fetchPublishedJobs sends search, location, employment type, industry and pagination', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method })
    if (
      path
      === '/api/jobs?q=analyst&location=Penang&employmentType=INTERNSHIP&industry=Technology&page=2&limit=20'
    ) {
      return jsonResponse(200, pagePayload([candidateJobPayload()], { page: 2, total: 21, totalPages: 2 }))
    }
    throw new Error(`unexpected ${path}`)
  }
  const result = await fetchPublishedJobs({
    q: 'analyst',
    location: 'Penang',
    employmentType: 'INTERNSHIP',
    industry: 'Technology',
    page: 2,
    limit: 20,
  })
  assert.equal(result.items[0].title, 'Junior Software Developer')
  assert.equal(result.items[0].company.companyName, 'Northwind Analytics')
  assert.equal(result.items[0].company.industry, 'Technology')
  assert.equal(result.items[0].createdBy, null)
  assert.equal(result.items[0].companyId, null)
  assert.equal(result.page, 2)
  assert.equal(result.totalPages, 2)
  assert.equal(calls[0].method, 'GET')
})

test('fetchPublishedJobs treats an empty published list as valid', async () => {
  globalThis.fetch = async (path) => {
    assert.equal(path, '/api/jobs?page=1&limit=20')
    return jsonResponse(200, pagePayload([], { total: 0, totalPages: 0 }))
  }
  const result = await fetchPublishedJobs({ page: 1, limit: 20 })
  assert.deepEqual(result.items, [])
  assert.equal(result.total, 0)
})

test('fetchPublishedJob loads a published vacancy and rejects invalid or missing ids', async () => {
  const calls = []
  globalThis.fetch = async (path) => {
    calls.push(path)
    if (path === `/api/jobs/${JOB_ID}`) {
      return jsonResponse(200, { job: candidateJobPayload() })
    }
    if (path === `/api/jobs/${OTHER_SKILL_ID}`) {
      return jsonResponse(404, { error: 'Not found' })
    }
    throw new Error(`unexpected ${path}`)
  }

  const job = await fetchPublishedJob(JOB_ID)
  assert.equal(job.status, 'PUBLISHED')
  assert.equal(job.requiredSkills[0].skill.preferredLabel, 'use ICT safety measures')
  assert.equal(job.requiredSkills[0].requiredLevel, 'Intermediate')
  assert.equal(job.company.registrationNumber, undefined)
  assert.equal(job.createdByUserId, null)

  await assert.rejects(
    () => fetchPublishedJob('not-a-uuid'),
    (error) => error instanceof ApiError && error.status === 400 && calls.length === 1,
  )
  await assert.rejects(
    () => fetchPublishedJob(OTHER_SKILL_ID),
    (error) => error instanceof ApiError && error.status === 404 && error.message === 'Not found',
  )
})

test('candidate job parsers accept public payloads and reject incomplete records', () => {
  const parsed = parseJob(candidateJobPayload())
  assert.equal(parsed.company.companyName, 'Northwind Analytics')
  assert.equal(parsed.company.description, 'A reporting studio.')
  assert.equal(formatSalaryRange(parsed).replaceAll(',', '').includes('3800'), true)
  const empty = parseJobPage(pagePayload([]), JOBS_UNAVAILABLE)
  assert.equal(empty.total, 0)
  assert.throws(() => parseJob({ title: 'Visible Engineer' }), (error) => error instanceof ApiError)
})

test('published-job errors stay user-facing and do not invent vacancies', () => {
  assert.equal(userFacingPublishedJobError(new ApiError('Unauthenticated', 401)).includes('view published jobs'), true)
  assert.equal(userFacingPublishedJobError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(userFacingPublishedJobError(new ApiError('Forbidden', 403)).includes('cannot view'), true)
  assert.equal(userFacingPublishedJobError(new ApiError('Not found', 404)), 'This job is not available.')
  assert.equal(userFacingPublishedJobError(new ApiError('secret-dsn', 500)), JOBS_UNAVAILABLE)
  const abort = new Error('aborted')
  abort.name = 'AbortError'
  assert.equal(userFacingPublishedJobError(abort), '')
})

test('create and update send CSRF and omit ownership fields', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body, headers: init.headers })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-job' })
    }
    if (path === '/api/me/jobs' && init.method === 'POST') {
      return jsonResponse(201, { job: jobPayload() })
    }
    if (path === `/api/me/jobs/${JOB_ID}` && init.method === 'PATCH') {
      return jsonResponse(200, { job: jobPayload({ title: 'Updated Analyst' }) })
    }
    throw new Error(`unexpected ${path}`)
  }

  const created = await createStaffJob({
    title: 'Junior Software Developer',
    description: 'Build internal web features.',
    qualificationRequired: "Bachelor's Degree",
    experienceRequired: '0-1 years',
    employmentType: 'FULL_TIME',
    location: 'Kuala Lumpur',
    salaryMin: 3800,
    salaryMax: 5200,
    closesAt: '2026-12-01T15:59:59.000Z',
    requiredSkills: [{ skillId: SKILL_ID, requiredLevel: 'Intermediate' }],
    companyId: 'spoof',
    createdByUserId: 'spoof',
    status: 'PUBLISHED',
    applicants: 18,
  })
  assert.equal(created.status, 'DRAFT')
  const createCall = calls.find((call) => call.path === '/api/me/jobs' && call.method === 'POST')
  assert.equal(createCall.headers['x-csrf-token'], 'csrf-job')
  const createBody = JSON.parse(createCall.body)
  assert.equal(createBody.companyId, undefined)
  assert.equal(createBody.createdByUserId, undefined)
  assert.equal(createBody.status, undefined)
  assert.equal(createBody.applicants, undefined)
  assert.equal(createBody.title, 'Junior Software Developer')
  assert.deepEqual(createBody.requiredSkills, [{ skillId: SKILL_ID, requiredLevel: 'Intermediate' }])

  const updated = await updateStaffJob(JOB_ID, {
    title: 'Updated Analyst',
    description: 'Build internal web features.',
    qualificationRequired: "Bachelor's Degree",
    experienceRequired: '0-1 years',
    employmentType: 'FULL_TIME',
    location: 'Kuala Lumpur',
    requiredSkills: [{ skillId: SKILL_ID, requiredLevel: 'Advanced' }],
  })
  assert.equal(updated.title, 'Updated Analyst')
})

test('publish, close and delete use CSRF and the existing endpoints', async () => {
  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, headers: init.headers })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-job' })
    }
    if (path === `/api/me/jobs/${JOB_ID}/submit`) {
      return jsonResponse(200, { job: jobPayload({ status: 'PUBLISHED', publishedAt: '2026-11-13T03:00:00.000Z' }) })
    }
    if (path === `/api/me/jobs/${JOB_ID}/close`) {
      return jsonResponse(200, { job: jobPayload({ status: 'CLOSED' }) })
    }
    if (path === `/api/me/jobs/${JOB_ID}` && init.method === 'DELETE') {
      return jsonResponse(200, { ok: true })
    }
    throw new Error(`unexpected ${path}`)
  }

  const published = await publishStaffJob(JOB_ID)
  assert.equal(published.status, 'PUBLISHED')
  const closed = await closeStaffJob(JOB_ID)
  assert.equal(closed.status, 'CLOSED')
  const removed = await deleteStaffJob(JOB_ID)
  assert.deepEqual(removed, { ok: true })
  assert.equal(calls.filter((call) => call.headers?.['x-csrf-token']).length >= 3, true)
})

test('admin suspend requires a reason and close uses the admin path', async () => {
  await assert.rejects(() => suspendAdminJob(JOB_ID, { reason: '  ' }), (error) => {
    return error instanceof ApiError && error.message === SUSPEND_REASON_REQUIRED
  })

  const calls = []
  globalThis.fetch = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body, headers: init.headers })
    if (path === '/api/csrf-token') {
      return jsonResponse(200, { csrfToken: 'csrf-admin-job' })
    }
    if (path === `/api/admin/jobs/${JOB_ID}/suspend`) {
      return jsonResponse(200, { job: jobPayload({ status: 'SUSPENDED' }) })
    }
    if (path === `/api/admin/jobs/${JOB_ID}/close`) {
      return jsonResponse(200, { job: jobPayload({ status: 'CLOSED' }) })
    }
    if (path === `/api/admin/jobs/${JOB_ID}`) {
      return jsonResponse(200, { job: jobPayload({ status: 'PUBLISHED' }) })
    }
    throw new Error(`unexpected ${path}`)
  }

  const detail = await fetchAdminJob(JOB_ID)
  assert.equal(detail.statusEvents.length, 1)
  const suspended = await suspendAdminJob(JOB_ID, { reason: 'Misleading salary wording.' })
  assert.equal(suspended.status, 'SUSPENDED')
  const suspendBody = JSON.parse(calls.find((call) => call.path.endsWith('/suspend')).body)
  assert.equal(suspendBody.reason, 'Misleading salary wording.')
  const closed = await closeAdminJob(JOB_ID, { reason: 'Role filled.' })
  assert.equal(closed.status, 'CLOSED')
})

test('invalid job payloads and missing pagination metadata are rejected', async () => {
  assert.throws(() => parseJob({ title: 'Broken' }), (error) => error instanceof ApiError)
  globalThis.fetch = async () => jsonResponse(200, { items: [jobPayload()] })
  await assert.rejects(() => fetchStaffJobs(), (error) => error instanceof ApiError && error.message === JOBS_UNAVAILABLE)
})

test('user-facing errors cover CSRF, company profile, publish failure and abort', async () => {
  assert.equal(userFacingJobError(new ApiError('Unauthenticated', 401)).includes('Sign in'), true)
  assert.equal(userFacingJobError(new ApiError(ACCOUNT_UNAVAILABLE_ERROR, 403)), ACCOUNT_UNAVAILABLE_MESSAGE)
  assert.equal(
    userFacingJobError(new ApiError(COMPANY_PROFILE_REQUIRED, 403)).includes('company profile'),
    true,
  )
  assert.equal(userFacingJobError(new ApiError(JOB_CANNOT_BE_PUBLISHED, 400)), JOB_CANNOT_BE_PUBLISHED)
  assert.equal(userFacingJobError(new ApiError('secret-dsn', 500)), JOBS_UNAVAILABLE)
  const abort = new Error('aborted')
  abort.name = 'AbortError'
  assert.equal(isAbortError(abort), true)
  assert.equal(userFacingJobError(abort), '')
})

test('job forms validate fields, block duplicate skills and omit ownership', () => {
  const emptyErrors = validateJobForm(emptyJobForm())
  assert.equal(Boolean(emptyErrors.title), true)
  const valid = {
    ...emptyJobForm(),
    title: 'Analyst',
    description: 'Support weekly reporting.',
    qualificationRequired: 'Diploma',
    experienceRequired: 'Internship',
    location: 'Penang',
    salaryMin: '4000',
    salaryMax: '3000',
    requiredSkills: [
      { skillId: SKILL_ID, requiredLevel: 'Beginner' },
      { skillId: SKILL_ID, requiredLevel: 'Advanced' },
    ],
  }
  const salaryErrors = validateJobForm({ ...valid, requiredSkills: [{ skillId: SKILL_ID, requiredLevel: 'Beginner' }] })
  assert.equal(salaryErrors.salaryMin.includes('Minimum salary'), true)
  const duplicateErrors = validateJobForm(valid)
  assert.equal(duplicateErrors.requiredSkills.includes('once'), true)

  const body = jobFormToWriteBody({
    ...valid,
    salaryMin: '4000',
    salaryMax: '5000',
    closesAt: '2026-12-01',
    requiredSkills: [{ skillId: SKILL_ID, requiredLevel: 'Beginner' }],
  })
  assert.equal(body.companyId, undefined)
  assert.equal(body.status, undefined)
  assert.equal(body.salaryMin, 4000)
  assert.equal(hasJobSkill(body.requiredSkills, SKILL_ID), true)
  const fromJob = jobToFormValues(jobPayload())
  assert.equal(fromJob.title, 'Junior Software Developer')
  assert.equal(fromJob.requiredSkills[0].skillId, SKILL_ID)
  assert.equal(canPublishJob(jobPayload()), true)
  assert.equal(canDeleteJob(jobPayload({ status: 'PUBLISHED' })), false)
  assert.equal(formatJobStatus('PUBLISHED'), 'Published')
  assert.equal(formatSalaryRange(jobPayload()).replaceAll(',', '').includes('3800'), true)
  assert.equal(staffJobPath(JOB_ID).includes(JOB_ID), true)
  assert.equal(staffJobEditPath(JOB_ID).includes('/edit'), true)
  assert.equal(adminJobPath(JOB_ID).startsWith('/admin/jobs/'), true)
  const write = buildJobWriteBody({
    title: 'Analyst',
    description: 'Support weekly reporting.',
    qualificationRequired: 'Diploma',
    experienceRequired: 'Internship',
    employmentType: 'INTERNSHIP',
    location: 'Penang',
    requiredSkills: [{ skillId: OTHER_SKILL_ID, requiredLevel: 'Advanced' }],
    applicants: 9,
  })
  assert.equal(write.applicants, undefined)
})

test('employer and admin job pages use the live API and drop mock records', () => {
  const manage = readFileSync(fileURLToPath(new URL('../pages/employer/ManageJobs.jsx', import.meta.url)), 'utf8')
  const form = readFileSync(fileURLToPath(new URL('../pages/employer/JobPostingFormPage.jsx', import.meta.url)), 'utf8')
  const details = readFileSync(fileURLToPath(new URL('../pages/employer/JobPostingDetails.jsx', import.meta.url)), 'utf8')
  const adminList = readFileSync(fileURLToPath(new URL('../pages/admin/JobMonitoring.jsx', import.meta.url)), 'utf8')
  const adminDetail = readFileSync(fileURLToPath(new URL('../pages/admin/JobModeration.jsx', import.meta.url)), 'utf8')
  const picker = readFileSync(fileURLToPath(new URL('../components/jobs/EscoJobSkillPicker.jsx', import.meta.url)), 'utf8')
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
  const hook = readFileSync(fileURLToPath(new URL('../hooks/useJobPostingForm.js', import.meta.url)), 'utf8')

  assert.equal(manage.includes('fetchStaffJobs'), true)
  assert.equal(manage.includes('employerJobs'), false)
  assert.equal(manage.includes('applicants'), false)
  assert.equal(manage.includes('Publish'), true)
  assert.equal(manage.includes('visible to students and job seekers immediately'), true)
  assert.equal(manage.includes('deleteStaffJob'), true)
  assert.equal(form.includes('useJobPostingForm'), true)
  assert.equal(form.includes('EscoJobSkillPicker'), true)
  assert.equal(form.includes('Nexa Digital'), false)
  assert.equal(form.includes('skillCatalogue'), false)
  assert.equal(form.includes('Save draft'), true)
  assert.equal(form.includes('publishStaffJob'), true)
  assert.equal(form.includes('companyId'), false)
  assert.equal(details.includes('fetchStaffJob'), true)
  assert.equal(details.includes('View Applicants'), true)
  assert.equal(details.includes('employerApplicantsPath'), true)
  assert.equal(details.includes('fetchEmployerApplications'), true)
  assert.equal(details.includes('job.applicants'), false)
  assert.equal(details.includes('Application review is not available'), false)
  assert.equal(details.includes('canDeleteJob'), true)
  assert.equal(details.includes('statusEvents'), true)
  assert.equal(adminList.includes('fetchAdminJobs'), true)
  assert.equal(adminList.includes('adminJobSummary'), false)
  assert.equal(adminList.includes('Approve'), false)
  assert.equal(adminList.includes('applicants'), false)
  assert.equal(adminDetail.includes('fetchAdminJob'), true)
  assert.equal(adminDetail.includes('suspendAdminJob'), true)
  assert.equal(adminDetail.includes('Enter a reason before suspending'), true)
  assert.equal(adminDetail.includes('statusEvents'), true)
  assert.equal(adminDetail.includes('Approve Posting'), false)
  assert.equal(picker.includes('fetchSkills'), true)
  assert.equal(picker.includes('Already added') || picker.includes('Added'), true)
  assert.equal(picker.includes('<form'), false)
  assert.equal(picker.includes('type="button"'), true)
  assert.equal(hook.includes('updateStaffJob'), true)
  assert.equal(hook.includes('createStaffJob'), true)
  assert.equal(app.includes("roles={['COMPANY_STAFF']}"), true)
  assert.equal(app.includes("roles={['ADMIN']}"), true)
  assert.equal(app.includes('<ManageJobs />'), true)
  assert.equal(app.includes('<AdminJobMonitoring />'), true)
  assert.equal(app.includes('CandidateJobsPage'), true)
})

test('candidate job pages load live published jobs and drop mock records', () => {
  const list = readFileSync(fileURLToPath(new URL('../pages/shared/CandidateJobsPage.jsx', import.meta.url)), 'utf8')
  const details = readFileSync(fileURLToPath(new URL('../pages/shared/CandidateJobDetailPage.jsx', import.meta.url)), 'utf8')
  const apply = readFileSync(fileURLToPath(new URL('../pages/shared/ApplyPage.jsx', import.meta.url)), 'utf8')
  const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')

  assert.equal(list.includes('fetchPublishedJobs'), true)
  assert.equal(list.includes("from '../../data/candidateJobs.js'"), false)
  assert.equal(list.includes('studentJobs'), false)
  assert.equal(list.includes('jobSeekerJobs'), false)
  assert.equal(list.includes('No jobs are currently available.'), true)
  assert.equal(list.includes('Clear filters'), true)
  assert.equal(list.includes('employmentType'), true)
  assert.equal(list.includes('industry'), true)
  assert.equal(list.includes('PaginationBar'), true)
  assert.equal(list.includes('% Match'), false)
  assert.equal(list.includes('Nexa Digital'), false)
  assert.equal(details.includes('fetchPublishedJob'), true)
  assert.equal(details.includes('getCandidateJob'), false)
  assert.equal(details.includes("from '../../data/candidateJobs.js'"), false)
  assert.equal(details.includes('This job is not available.'), true)
  assert.equal(details.includes('requiredLevel'), true)
  assert.equal(details.includes('company.description'), true)
  assert.equal(details.includes('registrationNumber'), false)
  assert.equal(details.includes('matchBreakdown'), false)
  assert.equal(details.includes('JobSkillMatchPanel'), true)
  assert.equal(details.includes('Save Job'), false)
  assert.equal(details.includes('Apply Now'), true)
  assert.equal(details.includes('Already Applied'), true)
  assert.equal(details.includes('fetchMyApplicationForJob'), true)
  assert.equal(details.includes('Applications are not available in this stage'), false)
  assert.equal(list.includes('useRecordedSkills'), true)
  assert.equal(list.includes('useSearchParams'), true)
  assert.equal(list.includes('initialQuery'), true)
  assert.equal(list.includes('% Match'), false)
  assert.equal(apply.includes('getCandidateJob'), false)
  assert.equal(apply.includes('submitJobApplication'), true)
  assert.equal(apply.includes('APPLICATION_RESUME_REQUIRED'), true)
  assert.equal(apply.includes('Already Applied'), true)
  assert.equal(apply.includes('Application submitted'), true)
  assert.equal(app.includes("roles={['STUDENT']}"), true)
  assert.equal(app.includes("roles={['JOB_SEEKER']}"), true)
  assert.equal(app.includes('<CandidateJobsPage basePath="/student"'), true)
  assert.equal(app.includes('<CandidateJobsPage basePath="/jobseeker"'), true)
  assert.equal(app.includes('<CandidateJobDetailPage basePath="/student"'), true)
  assert.equal(app.includes('<CandidateJobDetailPage basePath="/jobseeker"'), true)
})
