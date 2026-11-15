import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { PROFICIENCY_LEVELS } from './userSkills.js'
import { ApiError, apiRequest } from './client.js'
import { buildSearchParams, isAbortError, parseSkillSummary } from './esco.js'

export const JOBS_UNAVAILABLE = 'Job postings are unavailable right now.'
export const COMPANY_PROFILE_REQUIRED = 'Company profile required'
export const JOB_CANNOT_BE_PUBLISHED = 'Job cannot be published'
export const JOB_CANNOT_BE_CLOSED = 'Job cannot be closed'
export const JOB_CANNOT_BE_SUSPENDED = 'Job cannot be suspended'
export const JOB_CANNOT_BE_DELETED = 'Job cannot be deleted'
export const JOB_CANNOT_BE_UPDATED = 'Job cannot be updated'
export const SUSPEND_REASON_REQUIRED = 'Suspension reason is required'
export const JOB_LIST_LIMIT = 20
export const JOB_REQUIRED_SKILL_MAX = 50

export const JOB_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'SUSPENDED']
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']
export const JOB_REQUIRED_LEVELS = PROFICIENCY_LEVELS

export const JOB_FIELD_LIMITS = {
  title: 150,
  description: 5000,
  qualificationRequired: 2000,
  experienceRequired: 2000,
  location: 100,
  requiredSkills: JOB_REQUIRED_SKILL_MAX,
  reason: 1000,
  salaryMax: 10_000_000,
}

export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
]

export const CANDIDATE_EMPLOYMENT_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  ...EMPLOYMENT_TYPE_OPTIONS,
]

export const JOB_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'SUSPENDED', label: 'Suspended' },
]

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireObject(value, fallback = JOBS_UNAVAILABLE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireString(value, fallback = JOBS_UNAVAILABLE) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function requireInteger(value, fallback = JOBS_UNAVAILABLE) {
  if (!Number.isInteger(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalInteger(value, fallback = JOBS_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  return requireInteger(value, fallback)
}

export function isJobId(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function staffJobsPath() {
  return '/employer/jobs'
}

export function staffJobCreatePath() {
  return '/employer/jobs/create'
}

export function staffJobPath(id) {
  return `/employer/jobs/${encodeURIComponent(id)}`
}

export function staffJobEditPath(id) {
  return `/employer/jobs/${encodeURIComponent(id)}/edit`
}

export function adminJobsPath() {
  return '/admin/jobs'
}

export function adminJobPath(id) {
  return `/admin/jobs/${encodeURIComponent(id)}`
}

export function candidateJobsPath(basePath) {
  return `${basePath}/jobs`
}

export function candidateJobPath(basePath, id) {
  return `${basePath}/jobs/${encodeURIComponent(id)}`
}

export function formatEmploymentType(value) {
  const match = EMPLOYMENT_TYPE_OPTIONS.find((option) => option.value === value)
  return match ? match.label : value
}

export function formatJobStatus(status) {
  if (status === 'DRAFT') return 'Draft'
  if (status === 'PUBLISHED') return 'Published'
  if (status === 'CLOSED') return 'Closed'
  if (status === 'SUSPENDED') return 'Suspended'
  return status
}

export function jobStatusTone(status) {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'DRAFT') return 'warning'
  if (status === 'SUSPENDED') return 'danger'
  return 'default'
}

export function formatJobDate(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleString('en-GB', { dateStyle: 'medium' })
}

export function formatJobDateTime(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatSalaryRange(job) {
  if (!job || (job.salaryMin == null && job.salaryMax == null)) {
    return 'Not specified'
  }
  const format = (amount) => `RM ${amount.toLocaleString('en-MY')}`
  if (job.salaryMin != null && job.salaryMax != null) {
    return `${format(job.salaryMin)} – ${format(job.salaryMax)}`
  }
  if (job.salaryMin != null) {
    return `From ${format(job.salaryMin)}`
  }
  return `Up to ${format(job.salaryMax)}`
}

export function canEditJob(job) {
  return job?.status === 'DRAFT' || job?.status === 'PUBLISHED'
}

export function canPublishJob(job) {
  return job?.status === 'DRAFT'
}

export function canCloseStaffJob(job) {
  return job?.status === 'PUBLISHED'
}

export function canDeleteJob(job) {
  return job?.status === 'DRAFT'
}

export function canSuspendJob(job) {
  return job?.status === 'PUBLISHED'
}

export function canAdminCloseJob(job) {
  return job?.status === 'PUBLISHED' || job?.status === 'SUSPENDED'
}

function parseJobCompany(value, fallback = JOBS_UNAVAILABLE) {
  const company = requireObject(value, fallback)
  return {
    id: requireString(company.id, fallback),
    companyName: requireString(company.companyName, fallback),
    industry: optionalString(company.industry),
    location: optionalString(company.location),
    website: optionalString(company.website),
    description: optionalString(company.description),
  }
}

function parseActor(value, fallback = JOBS_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  const actor = requireObject(value, fallback)
  return {
    id: requireString(actor.id, fallback),
    fullName: requireString(actor.fullName, fallback),
  }
}

export function parseJobSkill(value, fallback = JOBS_UNAVAILABLE) {
  const record = requireObject(value, fallback)
  const requiredLevel = requireString(record.requiredLevel, fallback)
  if (!JOB_REQUIRED_LEVELS.includes(requiredLevel)) {
    throw new ApiError(fallback, 500)
  }
  return {
    id: requireString(record.id, fallback),
    requiredLevel,
    skill: parseSkillSummary(record.skill, fallback),
  }
}

export function parseJobStatusEvent(value, fallback = JOBS_UNAVAILABLE) {
  const event = requireObject(value, fallback)
  const toStatus = requireString(event.toStatus, fallback)
  if (!JOB_STATUSES.includes(toStatus)) {
    throw new ApiError(fallback, 500)
  }
  const fromStatus = event.fromStatus == null ? null : requireString(event.fromStatus, fallback)
  if (fromStatus && !JOB_STATUSES.includes(fromStatus)) {
    throw new ApiError(fallback, 500)
  }
  return {
    id: requireString(event.id, fallback),
    fromStatus,
    toStatus,
    note: optionalString(event.note),
    createdAt: requireString(event.createdAt, fallback),
    actor: parseActor(event.actor, fallback),
  }
}

export function parseJob(value, fallback = JOBS_UNAVAILABLE) {
  const record = requireObject(value, fallback)
  const status = requireString(record.status, fallback)
  const employmentType = requireString(record.employmentType, fallback)
  if (!JOB_STATUSES.includes(status) || !EMPLOYMENT_TYPES.includes(employmentType)) {
    throw new ApiError(fallback, 500)
  }
  if (!Array.isArray(record.requiredSkills)) {
    throw new ApiError(fallback, 500)
  }
  return {
    id: requireString(record.id, fallback),
    title: requireString(record.title, fallback),
    description: requireString(record.description, fallback),
    qualificationRequired: requireString(record.qualificationRequired, fallback),
    experienceRequired: requireString(record.experienceRequired, fallback),
    employmentType,
    location: requireString(record.location, fallback),
    salaryMin: optionalInteger(record.salaryMin, fallback),
    salaryMax: optionalInteger(record.salaryMax, fallback),
    closesAt: optionalString(record.closesAt),
    status,
    publishedAt: optionalString(record.publishedAt),
    createdAt: requireString(record.createdAt, fallback),
    updatedAt: requireString(record.updatedAt, fallback),
    companyId: optionalString(record.companyId),
    createdByUserId: optionalString(record.createdByUserId),
    company: parseJobCompany(record.company, fallback),
    createdBy: parseActor(record.createdBy, fallback),
    requiredSkills: record.requiredSkills.map((skill) => parseJobSkill(skill, fallback)),
    statusEvents: Array.isArray(record.statusEvents)
      ? record.statusEvents.map((event) => parseJobStatusEvent(event, fallback))
      : [],
  }
}

export function parseJobPage(payload, fallback = JOBS_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  if (!Array.isArray(body.jobs)) {
    throw new ApiError(fallback, 500)
  }
  return {
    items: body.jobs.map((job) => parseJob(job, fallback)),
    page: requireInteger(body.page, fallback),
    limit: requireInteger(body.limit, fallback),
    total: requireInteger(body.total, fallback),
    totalPages: requireInteger(body.totalPages, fallback),
  }
}

export function userFacingPublishedJobError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to view published jobs.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot view published jobs with this account.'
    }
    if (error.status === 404 || error.message === 'Not found') {
      return 'This job is not available.'
    }
    if (error.message === 'Invalid request') {
      return error.message
    }
  }
  return JOBS_UNAVAILABLE
}

export function userFacingJobError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to manage job postings.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403 && error.message === COMPANY_PROFILE_REQUIRED) {
      return 'Save a company profile before creating or managing job postings.'
    }
    if (error.status === 403) {
      return 'You cannot manage these job postings with this account.'
    }
    if (
      error.message === JOB_CANNOT_BE_PUBLISHED
      || error.message === JOB_CANNOT_BE_CLOSED
      || error.message === JOB_CANNOT_BE_SUSPENDED
      || error.message === JOB_CANNOT_BE_DELETED
      || error.message === JOB_CANNOT_BE_UPDATED
      || error.message === SUSPEND_REASON_REQUIRED
      || error.message === 'Invalid request'
      || error.message === 'Not found'
    ) {
      return error.message
    }
  }
  return JOBS_UNAVAILABLE
}

async function requestJobs(path, options = {}) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(JOBS_UNAVAILABLE, 500)
  }
}

function requireJobPayload(payload) {
  const job = parseJob(payload?.job)
  if (!job) {
    throw new ApiError(JOBS_UNAVAILABLE, 500)
  }
  return job
}

export function buildRequiredSkillsPayload(skills = []) {
  if (!Array.isArray(skills)) {
    throw new ApiError('Invalid request', 400)
  }
  if (skills.length > JOB_FIELD_LIMITS.requiredSkills) {
    throw new ApiError('Invalid request', 400)
  }
  const ids = new Set()
  return skills.map((skill) => {
    const skillId = skill?.skillId || skill?.skill?.id
    const requiredLevel = skill?.requiredLevel
    if (typeof skillId !== 'string' || !UUID_RE.test(skillId)) {
      throw new ApiError('Invalid request', 400)
    }
    if (!JOB_REQUIRED_LEVELS.includes(requiredLevel)) {
      throw new ApiError('Invalid request', 400)
    }
    if (ids.has(skillId)) {
      throw new ApiError('Invalid request', 400)
    }
    ids.add(skillId)
    return { skillId, requiredLevel }
  })
}

function optionalSalary(value) {
  if (value == null || value === '') {
    return null
  }
  if (!Number.isInteger(value) || value < 0 || value > JOB_FIELD_LIMITS.salaryMax) {
    throw new ApiError('Invalid request', 400)
  }
  return value
}

export function buildJobWriteBody(input = {}, { includeSkills = true } = {}) {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  const qualificationRequired =
    typeof input.qualificationRequired === 'string' ? input.qualificationRequired.trim() : ''
  const experienceRequired =
    typeof input.experienceRequired === 'string' ? input.experienceRequired.trim() : ''
  const location = typeof input.location === 'string' ? input.location.trim() : ''
  if (
    !title
    || !description
    || !qualificationRequired
    || !experienceRequired
    || !location
    || !EMPLOYMENT_TYPES.includes(input.employmentType)
  ) {
    throw new ApiError('Invalid request', 400)
  }
  if (
    title.length > JOB_FIELD_LIMITS.title
    || description.length > JOB_FIELD_LIMITS.description
    || qualificationRequired.length > JOB_FIELD_LIMITS.qualificationRequired
    || experienceRequired.length > JOB_FIELD_LIMITS.experienceRequired
    || location.length > JOB_FIELD_LIMITS.location
  ) {
    throw new ApiError('Invalid request', 400)
  }

  const body = {
    title,
    description,
    qualificationRequired,
    experienceRequired,
    employmentType: input.employmentType,
    location,
    salaryMin: optionalSalary(input.salaryMin),
    salaryMax: optionalSalary(input.salaryMax),
    closesAt: input.closesAt == null || input.closesAt === '' ? null : input.closesAt,
  }
  if (includeSkills) {
    body.requiredSkills = buildRequiredSkillsPayload(input.requiredSkills)
  }
  return body
}

export async function fetchStaffJobs({ q, status, page, limit, signal } = {}) {
  const payload = await requestJobs(
    `/api/me/jobs${buildSearchParams({ q, status, page, limit })}`,
    { signal },
  )
  return parseJobPage(payload)
}

export async function fetchStaffJob(id, { signal } = {}) {
  if (!isJobId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestJobs(`/api/me/jobs/${encodeURIComponent(id)}`, { signal })
  return requireJobPayload(payload)
}

export async function createStaffJob(input = {}) {
  const { signal, ...fields } = input
  const payload = await requestJobs('/api/me/jobs', {
    method: 'POST',
    mutate: true,
    body: buildJobWriteBody(fields),
    signal,
  })
  return requireJobPayload(payload)
}

export async function updateStaffJob(id, input = {}) {
  if (!isJobId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const { signal, includeSkills = true, ...fields } = input
  const payload = await requestJobs(`/api/me/jobs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    mutate: true,
    body: buildJobWriteBody(fields, { includeSkills }),
    signal,
  })
  return requireJobPayload(payload)
}

export async function publishStaffJob(id, { signal } = {}) {
  if (!isJobId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestJobs(`/api/me/jobs/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
    mutate: true,
    body: {},
    signal,
  })
  return requireJobPayload(payload)
}

export async function closeStaffJob(id, { signal } = {}) {
  if (!isJobId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestJobs(`/api/me/jobs/${encodeURIComponent(id)}/close`, {
    method: 'POST',
    mutate: true,
    body: {},
    signal,
  })
  return requireJobPayload(payload)
}

export async function deleteStaffJob(id, { signal } = {}) {
  if (!isJobId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestJobs(`/api/me/jobs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    mutate: true,
    signal,
  })
  if (!payload || payload.ok !== true) {
    throw new ApiError(JOBS_UNAVAILABLE, 500)
  }
  return payload
}

export async function fetchAdminJobs({ q, status, companyId, page, limit, signal } = {}) {
  const payload = await requestJobs(
    `/api/admin/jobs${buildSearchParams({ q, status, companyId, page, limit })}`,
    { signal },
  )
  return parseJobPage(payload)
}

export async function fetchAdminJob(id, { signal } = {}) {
  if (!isJobId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestJobs(`/api/admin/jobs/${encodeURIComponent(id)}`, { signal })
  return requireJobPayload(payload)
}

export async function suspendAdminJob(id, { reason, signal } = {}) {
  if (!isJobId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const trimmed = typeof reason === 'string' ? reason.trim() : ''
  if (!trimmed) {
    throw new ApiError(SUSPEND_REASON_REQUIRED, 400)
  }
  if (trimmed.length > JOB_FIELD_LIMITS.reason) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestJobs(`/api/admin/jobs/${encodeURIComponent(id)}/suspend`, {
    method: 'POST',
    mutate: true,
    body: { reason: trimmed },
    signal,
  })
  return requireJobPayload(payload)
}

export async function closeAdminJob(id, { reason, signal } = {}) {
  if (!isJobId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const trimmed = typeof reason === 'string' ? reason.trim() : ''
  const body = trimmed ? { reason: trimmed } : {}
  const payload = await requestJobs(`/api/admin/jobs/${encodeURIComponent(id)}/close`, {
    method: 'POST',
    mutate: true,
    body,
    signal,
  })
  return requireJobPayload(payload)
}

export async function fetchPublishedJobs({ q, location, employmentType, industry, page, limit, signal } = {}) {
  const payload = await requestJobs(
    `/api/jobs${buildSearchParams({ q, location, employmentType, industry, page, limit })}`,
    { signal },
  )
  return parseJobPage(payload)
}

export async function fetchPublishedJob(id, { signal } = {}) {
  if (!isJobId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestJobs(`/api/jobs/${encodeURIComponent(id)}`, { signal })
  return requireJobPayload(payload)
}

export { isAbortError }
