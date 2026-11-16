import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, apiDownload, apiRequest } from './client.js'
import { buildSearchParams, isAbortError } from './esco.js'
import {
  formatEmploymentType,
  formatJobDate,
  formatJobDateTime,
  parseJob,
} from './jobs.js'
import { saveBlobAsFile } from './resumes.js'
import { parseUserSkill } from './userSkills.js'

export const APPLICATIONS_UNAVAILABLE = 'Application data is unavailable right now.'
export const APPLICATION_ALREADY_EXISTS = 'You have already applied for this job'
export const APPLICATION_CANNOT_BE_WITHDRAWN = 'Application cannot be withdrawn'
export const APPLICATION_CANNOT_BE_UPDATED = 'Application cannot be updated'
export const COMPANY_PROFILE_REQUIRED = 'Company profile required'
export const APPLICATION_LIST_LIMIT = 20
export const REVIEW_NOTE_MAX = 500
export const APPLICATION_RESUME_REQUIRED =
  'You need to create a resume before applying for this job.'
export const APPLICATION_SNAPSHOT_COPY =
  'PeaceOne keeps an independent copy of the selected resume. Later edits or deletion of My Resume do not change this submission.'
export const APPLICATION_WITHDRAWN_COPY =
  'This application has been withdrawn. Reapplication for the same job is not permitted.'
export const APPLICATION_OFFERED_COPY =
  'The employer recorded a job offer. PeaceOne does not support accepting or declining offers in this workspace.'
export const EMPLOYER_OFFER_COPY =
  'Record an offer for this candidate. PeaceOne notifies the candidate and stores OFFERED status. Candidates cannot accept or decline offers here.'
export const APPLICATION_EMPTY = {
  title: 'No applications yet.',
  description: 'Submitted applications appear here after you apply for a published job.',
}
export const EMPLOYER_APPLICATIONS_EMPTY = {
  title: 'No applications yet.',
  description: 'Applications for your company’s jobs appear here after candidates apply.',
}
export const EMPLOYER_SNAPSHOT_COPY =
  'This is the immutable resume snapshot submitted with the application. It does not change if the candidate later edits or deletes My Resume.'

export const APPLICATION_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'OFFERED',
  'REJECTED',
  'WITHDRAWN',
]

export const APPLICATION_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'OFFERED', label: 'Offered' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
]

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireObject(value, fallback = APPLICATIONS_UNAVAILABLE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireString(value, fallback = APPLICATIONS_UNAVAILABLE) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function requireInteger(value, fallback = APPLICATIONS_UNAVAILABLE) {
  if (!Number.isInteger(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalInteger(value, fallback = APPLICATIONS_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  return requireInteger(value, fallback)
}

export function isApplicationId(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function candidateApplicationsPath(basePath) {
  return `${basePath}/applications`
}

export function candidateApplicationPath(basePath, id) {
  return `${basePath}/applications/${encodeURIComponent(id)}`
}

export function candidateApplyPath(basePath, jobId) {
  return `${basePath}/jobs/${encodeURIComponent(jobId)}/apply`
}

export function employerApplicantsPath({ jobId, q, status } = {}) {
  return `/employer/applicants${buildSearchParams({ q, status, jobId })}`
}

export function employerApplicantPath(id, { jobId, q, status } = {}) {
  return `/employer/applicants/${encodeURIComponent(id)}${buildSearchParams({ q, status, jobId })}`
}

export function formatApplicationStatus(status) {
  const match = APPLICATION_STATUS_OPTIONS.find((option) => option.value === status)
  return match ? match.label : status
}

export function applicationStatusTone(status) {
  if (status === 'SUBMITTED') return 'primary'
  if (status === 'UNDER_REVIEW' || status === 'SHORTLISTED' || status === 'INTERVIEW') return 'warning'
  if (status === 'OFFERED') return 'success'
  if (status === 'REJECTED' || status === 'WITHDRAWN') return 'danger'
  return 'default'
}

export function canWithdrawApplication(application) {
  return application?.status === 'SUBMITTED'
}

export function canReviewEmployerApplication(application) {
  return application?.status === 'SUBMITTED'
}

export function canShortlistEmployerApplication(application) {
  return application?.status === 'SUBMITTED' || application?.status === 'UNDER_REVIEW'
}

export function canRejectEmployerApplication(application) {
  return (
    application?.status === 'SUBMITTED'
    || application?.status === 'UNDER_REVIEW'
    || application?.status === 'SHORTLISTED'
    || application?.status === 'INTERVIEW'
  )
}

export function canOfferEmployerApplication(application) {
  return application?.status === 'SHORTLISTED' || application?.status === 'INTERVIEW'
}

export function reviewNoteBody(reviewNote) {
  if (typeof reviewNote !== 'string') {
    return {}
  }
  const trimmed = reviewNote.trim()
  if (!trimmed) {
    return {}
  }
  return { reviewNote: trimmed.slice(0, REVIEW_NOTE_MAX) }
}

function parseActor(value, fallback = APPLICATIONS_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  const actor = requireObject(value, fallback)
  return {
    id: requireString(actor.id, fallback),
    fullName: requireString(actor.fullName, fallback),
  }
}

function parseApplicant(value, fallback = APPLICATIONS_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  const applicant = requireObject(value, fallback)
  return {
    id: requireString(applicant.id, fallback),
    fullName: requireString(applicant.fullName, fallback),
    email: requireString(applicant.email, fallback),
    phone: optionalString(applicant.phone),
    location: optionalString(applicant.location),
    educationLevel: optionalString(applicant.educationLevel),
    fieldOfStudy: optionalString(applicant.fieldOfStudy),
    institution: optionalString(applicant.institution),
    graduationYear: optionalInteger(applicant.graduationYear, fallback),
    experienceSummary: optionalString(applicant.experienceSummary),
    skills: Array.isArray(applicant.skills)
      ? applicant.skills.map((item) => parseUserSkill(item, fallback))
      : [],
  }
}

export function parseApplicationSnapshot(value, fallback = APPLICATIONS_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  const snapshot = requireObject(value, fallback)
  if ('structuredSnapshot' in snapshot || 'originalFileStoredFilename' in snapshot) {
    throw new ApiError(fallback, 500)
  }
  return {
    resumeTitle: requireString(snapshot.resumeTitle, fallback),
    templateKey: requireString(snapshot.templateKey, fallback),
    generatedPdfFilename: requireString(snapshot.generatedPdfFilename, fallback),
    generatedPdfContentType: requireString(snapshot.generatedPdfContentType, fallback),
    generatedPdfSize: requireInteger(snapshot.generatedPdfSize, fallback),
    generatedPdfSha256: requireString(snapshot.generatedPdfSha256, fallback),
    hasOriginalFile: snapshot.hasOriginalFile === true,
    originalFileFilename: optionalString(snapshot.originalFileFilename),
    originalFileContentType: optionalString(snapshot.originalFileContentType),
    originalFileSize: optionalInteger(snapshot.originalFileSize, fallback),
    originalFileSha256: optionalString(snapshot.originalFileSha256),
    createdAt: requireString(snapshot.createdAt, fallback),
  }
}

export function parseApplicationStatusEvent(value, fallback = APPLICATIONS_UNAVAILABLE) {
  const event = requireObject(value, fallback)
  const toStatus = requireString(event.toStatus, fallback)
  if (!APPLICATION_STATUSES.includes(toStatus)) {
    throw new ApiError(fallback, 500)
  }
  const fromStatus = event.fromStatus == null ? null : requireString(event.fromStatus, fallback)
  if (fromStatus && !APPLICATION_STATUSES.includes(fromStatus)) {
    throw new ApiError(fallback, 500)
  }
  return {
    id: requireString(event.id, fallback),
    fromStatus,
    toStatus,
    reviewNote: optionalString(event.reviewNote),
    createdAt: requireString(event.createdAt, fallback),
    actor: parseActor(event.actor, fallback),
  }
}

export function parseApplication(value, fallback = APPLICATIONS_UNAVAILABLE) {
  const record = requireObject(value, fallback)
  const status = requireString(record.status, fallback)
  if (!APPLICATION_STATUSES.includes(status)) {
    throw new ApiError(fallback, 500)
  }
  if (record.storagePath || record.generatedPdfPath || record.originalFileStoredFilename) {
    throw new ApiError(fallback, 500)
  }
  return {
    id: requireString(record.id, fallback),
    jobId: requireString(record.jobId, fallback),
    status,
    appliedAt: requireString(record.appliedAt, fallback),
    updatedAt: requireString(record.updatedAt, fallback),
    selectedResumeId: optionalString(record.selectedResumeId),
    job: record.job ? parseJob(record.job, fallback) : null,
    snapshot: parseApplicationSnapshot(record.snapshot, fallback),
    applicant: parseApplicant(record.applicant, fallback),
    statusEvents: Array.isArray(record.statusEvents)
      ? record.statusEvents.map((event) => parseApplicationStatusEvent(event, fallback))
      : [],
  }
}

function emptyStatusCounts() {
  return Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0]))
}

export function emptyApplicationStats() {
  return {
    total: 0,
    byStatus: emptyStatusCounts(),
    jobs: [],
  }
}

export function emptyAdminApplicationStats() {
  return {
    total: 0,
    byStatus: emptyStatusCounts(),
    companiesWithApplications: 0,
  }
}

function parseStatusCounts(value, fallback = APPLICATIONS_UNAVAILABLE) {
  const counts = requireObject(value, fallback)
  const byStatus = emptyStatusCounts()
  for (const status of APPLICATION_STATUSES) {
    byStatus[status] = requireInteger(counts[status], fallback)
  }
  return byStatus
}

function parseJobApplicationCount(value, fallback = APPLICATIONS_UNAVAILABLE) {
  const job = requireObject(value, fallback)
  return {
    id: requireString(job.id, fallback),
    title: requireString(job.title, fallback),
    status: requireString(job.status, fallback),
    applicationCount: requireInteger(job.applicationCount, fallback),
  }
}

export function parseEmployerApplicationStats(payload, fallback = APPLICATIONS_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  if (!Array.isArray(body.jobs)) {
    throw new ApiError(fallback, 500)
  }
  return {
    total: requireInteger(body.total, fallback),
    byStatus: parseStatusCounts(body.byStatus, fallback),
    jobs: body.jobs.map((job) => parseJobApplicationCount(job, fallback)),
  }
}

export function parseAdminApplicationStats(payload, fallback = APPLICATIONS_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  return {
    total: requireInteger(body.total, fallback),
    byStatus: parseStatusCounts(body.byStatus, fallback),
    companiesWithApplications: requireInteger(body.companiesWithApplications, fallback),
  }
}

export function parseApplicationPage(payload, fallback = APPLICATIONS_UNAVAILABLE) {
  const body = requireObject(payload, fallback)
  if (!Array.isArray(body.applications)) {
    throw new ApiError(fallback, 500)
  }
  return {
    items: body.applications.map((item) => parseApplication(item, fallback)),
    page: requireInteger(body.page, fallback),
    limit: requireInteger(body.limit, fallback),
    total: requireInteger(body.total, fallback),
    totalPages: requireInteger(body.totalPages, fallback),
  }
}

export function userFacingApplicationError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to manage applications.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403 && error.message === COMPANY_PROFILE_REQUIRED) {
      return COMPANY_PROFILE_REQUIRED
    }
    if (error.status === 403) {
      return 'You cannot manage these applications with this account.'
    }
    if (error.status === 404 || error.message === 'Not found') {
      return 'This application is not available.'
    }
    if (
      error.message === APPLICATION_ALREADY_EXISTS
      || error.message === APPLICATION_CANNOT_BE_WITHDRAWN
      || error.message === APPLICATION_CANNOT_BE_UPDATED
      || error.message === COMPANY_PROFILE_REQUIRED
      || error.message === 'Invalid request'
    ) {
      return error.message
    }
  }
  return APPLICATIONS_UNAVAILABLE
}

async function requestApplications(path, options = {}) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(APPLICATIONS_UNAVAILABLE, 500)
  }
}

function requireApplicationPayload(payload) {
  const application = parseApplication(payload?.application)
  if (!application) {
    throw new ApiError(APPLICATIONS_UNAVAILABLE, 500)
  }
  return application
}

export async function fetchMyApplications({ q, status, jobId, page, limit, signal } = {}) {
  const payload = await requestApplications(
    `/api/me/applications${buildSearchParams({ q, status, jobId, page, limit })}`,
    { signal },
  )
  return parseApplicationPage(payload)
}

export async function fetchMyApplication(id, { signal } = {}) {
  if (!isApplicationId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestApplications(`/api/me/applications/${encodeURIComponent(id)}`, { signal })
  return requireApplicationPayload(payload)
}

export async function fetchMyApplicationForJob(jobId, { signal } = {}) {
  if (!isApplicationId(jobId)) {
    throw new ApiError('Invalid request', 400)
  }
  const page = await fetchMyApplications({ jobId, page: 1, limit: 1, signal })
  return page.items[0] || null
}

export async function submitJobApplication(jobId, resumeId, { signal } = {}) {
  if (!isApplicationId(jobId) || !isApplicationId(resumeId)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestApplications(`/api/jobs/${encodeURIComponent(jobId)}/applications`, {
    method: 'POST',
    mutate: true,
    body: { resumeId },
    signal,
  })
  return requireApplicationPayload(payload)
}

export async function withdrawMyApplication(id, { signal } = {}) {
  if (!isApplicationId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestApplications(`/api/me/applications/${encodeURIComponent(id)}/withdraw`, {
    method: 'POST',
    mutate: true,
    body: {},
    signal,
  })
  return requireApplicationPayload(payload)
}

async function downloadNamedFile(path, fallbackName) {
  const response = await apiDownload(path)
  const blob = await response.blob()
  const header = response.headers.get('content-disposition') || ''
  const match = header.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i)
  const encoded = match?.[1] ? decodeURIComponent(match[1]) : match?.[2]
  saveBlobAsFile(blob, encoded || fallbackName)
}

export async function downloadMyApplicationPdf(application, { signal } = {}) {
  if (!isApplicationId(application?.id)) {
    throw new ApiError('Invalid request', 400)
  }
  await downloadNamedFile(
    `/api/me/applications/${encodeURIComponent(application.id)}/resume.pdf`,
    'submitted-resume.pdf',
  )
  return { ok: true, signal }
}

export async function fetchEmployerApplications({ q, status, jobId, page, limit, signal } = {}) {
  const payload = await requestApplications(
    `/api/employer/applications${buildSearchParams({ q, status, jobId, page, limit })}`,
    { signal },
  )
  return parseApplicationPage(payload)
}

export async function fetchEmployerApplication(id, { signal } = {}) {
  if (!isApplicationId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestApplications(`/api/employer/applications/${encodeURIComponent(id)}`, {
    signal,
  })
  return requireApplicationPayload(payload)
}

async function mutateEmployerApplication(id, action, reviewNote, signal) {
  if (!isApplicationId(id)) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestApplications(
    `/api/employer/applications/${encodeURIComponent(id)}/${action}`,
    {
      method: 'POST',
      mutate: true,
      body: reviewNoteBody(reviewNote),
      signal,
    },
  )
  return requireApplicationPayload(payload)
}

export async function reviewEmployerApplication(id, { reviewNote, signal } = {}) {
  return mutateEmployerApplication(id, 'review', reviewNote, signal)
}

export async function shortlistEmployerApplication(id, { reviewNote, signal } = {}) {
  return mutateEmployerApplication(id, 'shortlist', reviewNote, signal)
}

export async function rejectEmployerApplication(id, { reviewNote, signal } = {}) {
  return mutateEmployerApplication(id, 'reject', reviewNote, signal)
}

export async function offerEmployerApplication(id, { reviewNote, signal } = {}) {
  return mutateEmployerApplication(id, 'offer', reviewNote, signal)
}

export async function downloadEmployerApplicationPdf(application, { signal } = {}) {
  if (!isApplicationId(application?.id)) {
    throw new ApiError('Invalid request', 400)
  }
  await downloadNamedFile(
    `/api/employer/applications/${encodeURIComponent(application.id)}/resume.pdf`,
    'submitted-resume.pdf',
  )
  return { ok: true, signal }
}

export async function downloadEmployerApplicationOriginal(application, { signal } = {}) {
  if (!isApplicationId(application?.id) || !application.snapshot?.hasOriginalFile) {
    throw new ApiError('Invalid request', 400)
  }
  const contentType = application.snapshot.originalFileContentType || ''
  const fallbackName = contentType.includes('wordprocessingml')
    ? 'original-resume.docx'
    : 'original-resume.pdf'
  await downloadNamedFile(
    `/api/employer/applications/${encodeURIComponent(application.id)}/resume.original`,
    fallbackName,
  )
  return { ok: true, signal }
}

export async function fetchEmployerApplicationStats({ signal } = {}) {
  const payload = await requestApplications('/api/employer/applications/stats', { signal })
  return parseEmployerApplicationStats(payload)
}

export async function fetchAdminApplicationStats({ signal } = {}) {
  const payload = await requestApplications('/api/admin/applications/stats', { signal })
  return parseAdminApplicationStats(payload)
}

export async function loadEmployerApplicationPdfBlob(application, { signal } = {}) {
  if (!isApplicationId(application?.id)) {
    throw new ApiError('Invalid request', 400)
  }
  const response = await apiDownload(
    `/api/employer/applications/${encodeURIComponent(application.id)}/resume.pdf`,
    { signal },
  )
  return response.blob()
}

export {
  formatEmploymentType,
  formatJobDate,
  formatJobDateTime,
  isAbortError,
}
