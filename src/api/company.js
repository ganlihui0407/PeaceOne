import { ACCOUNT_UNAVAILABLE_ERROR, ACCOUNT_UNAVAILABLE_MESSAGE } from '../auth/sessionStatus.js'
import { ApiError, apiRequest } from './client.js'
import { buildSearchParams, isAbortError } from './esco.js'

export const COMPANY_UNAVAILABLE = 'Company profile data is unavailable right now.'
export const COMPANY_EMPTY = {
  title: 'No company profile is saved yet.',
  description: 'Add the company details for this staff account. Empty optional fields stay empty.',
}

export const COMPANY_FIELD_LIMITS = {
  companyName: 150,
  registrationNumber: 50,
  industry: 100,
  companySize: 50,
  website: 200,
  email: 254,
  phone: 30,
  location: 100,
  address: 200,
  description: 2000,
}

export const COMPANY_LOGO_UNAVAILABLE =
  'Company logos are not stored yet. PeaceOne does not have an upload API for logos.'

function requireObject(value, fallback = COMPANY_UNAVAILABLE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function requireString(value, fallback = COMPANY_UNAVAILABLE) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(fallback, 500)
  }
  return value
}

function optionalString(value, max, fallback = COMPANY_UNAVAILABLE) {
  if (value == null || value === '') {
    return null
  }
  if (typeof value !== 'string' || value.length > max) {
    throw new ApiError(fallback, 500)
  }
  return value
}

export function parseCompany(value, fallback = COMPANY_UNAVAILABLE) {
  if (value == null) {
    return null
  }
  const company = requireObject(value, fallback)
  return {
    id: requireString(company.id, fallback),
    companyName: requireString(company.companyName, fallback),
    registrationNumber: optionalString(company.registrationNumber, COMPANY_FIELD_LIMITS.registrationNumber, fallback),
    industry: optionalString(company.industry, COMPANY_FIELD_LIMITS.industry, fallback),
    companySize: optionalString(company.companySize, COMPANY_FIELD_LIMITS.companySize, fallback),
    website: optionalString(company.website, COMPANY_FIELD_LIMITS.website, fallback),
    email: optionalString(company.email, COMPANY_FIELD_LIMITS.email, fallback),
    phone: optionalString(company.phone, COMPANY_FIELD_LIMITS.phone, fallback),
    location: optionalString(company.location, COMPANY_FIELD_LIMITS.location, fallback),
    address: optionalString(company.address, COMPANY_FIELD_LIMITS.address, fallback),
    description: optionalString(company.description, COMPANY_FIELD_LIMITS.description, fallback),
    createdAt: requireString(company.createdAt, fallback),
    updatedAt: requireString(company.updatedAt, fallback),
  }
}

export function userFacingCompanyError(error) {
  if (isAbortError(error)) {
    return ''
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Sign in again to manage the company profile.'
    }
    if (error.status === 403 && error.message === ACCOUNT_UNAVAILABLE_ERROR) {
      return ACCOUNT_UNAVAILABLE_MESSAGE
    }
    if (error.status === 403) {
      return 'You cannot manage this company profile with this account.'
    }
    if (error.message === 'Invalid request' || error.message === 'Not found') {
      return error.message
    }
  }
  return COMPANY_UNAVAILABLE
}

async function requestCompany(path, options = {}) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(COMPANY_UNAVAILABLE, 500)
  }
}

export async function fetchCompanyProfile({ signal } = {}) {
  const payload = await requestCompany('/api/me/company', { signal })
  const body = requireObject(payload)
  return parseCompany(body.company)
}

export async function saveCompanyProfile(input = {}) {
  const { signal, ...fields } = input
  const payload = await requestCompany('/api/me/company', {
    method: 'PUT',
    mutate: true,
    body: buildCompanyUpdate(fields),
    signal,
  })
  const company = parseCompany(payload?.company)
  if (!company) {
    throw new ApiError(COMPANY_UNAVAILABLE, 500)
  }
  return company
}

export function buildCompanyUpdate(input = {}) {
  const companyName = typeof input.companyName === 'string' ? input.companyName.trim() : ''
  if (!companyName) {
    throw new ApiError('Invalid request', 400)
  }
  if (companyName.length > COMPANY_FIELD_LIMITS.companyName) {
    throw new ApiError('Invalid request', 400)
  }
  const body = { companyName }
  for (const [key, max] of Object.entries(COMPANY_FIELD_LIMITS)) {
    if (key === 'companyName' || input[key] === undefined) {
      continue
    }
    if (key === 'email') {
      const email = typeof input.email === 'string' ? input.email.trim() : ''
      body.email = email.length > 0 ? email : null
      continue
    }
    if (input[key] == null || input[key] === '') {
      body[key] = null
      continue
    }
    if (typeof input[key] !== 'string') {
      throw new ApiError('Invalid request', 400)
    }
    const trimmed = input[key].trim()
    if (trimmed.length > max) {
      throw new ApiError('Invalid request', 400)
    }
    body[key] = trimmed.length > 0 ? trimmed : null
  }
  return body
}

export async function fetchAdminCompanies({ q, page = 1, limit = 20, signal } = {}) {
  const payload = await requestCompany(
    `/api/admin/companies${buildSearchParams({ q, page, limit })}`,
    { signal },
  )
  const body = requireObject(payload)
  const companies = Array.isArray(body.companies) ? body.companies.map(parseAdminCompany) : []
  return {
    items: companies,
    page: Number(body.page) || 1,
    limit: Number(body.limit) || 20,
    total: Number(body.total) || 0,
    totalPages: Number(body.totalPages) || 0,
  }
}

function optionalCount(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function parseAdminCompany(value) {
  const company = parseCompany(value)
  if (!company) {
    throw new ApiError(COMPANY_UNAVAILABLE, 500)
  }
  return {
    ...company,
    staffCount: optionalCount(value.staffCount),
    jobCount: optionalCount(value.jobCount),
    publishedJobCount: optionalCount(value.publishedJobCount),
    draftJobCount: optionalCount(value.draftJobCount),
    closedJobCount: optionalCount(value.closedJobCount),
    suspendedJobCount: optionalCount(value.suspendedJobCount),
  }
}

export async function fetchAdminCompany(id, { signal } = {}) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new ApiError('Invalid request', 400)
  }
  const payload = await requestCompany(`/api/admin/companies/${encodeURIComponent(id)}`, { signal })
  const company = parseAdminCompany(payload?.company)
  return {
    company,
    staff: Array.isArray(payload?.staff)
      ? payload.staff.map((member) => ({
        id: member.id,
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        accountStatus: member.accountStatus,
        jobTitle: member.jobTitle ?? null,
      }))
      : [],
  }
}

export { isAbortError }
