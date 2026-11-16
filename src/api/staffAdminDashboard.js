import { fetchAdminPlatformStats } from './adminPlatform.js'
import {
  emptyApplicationStats,
  fetchAdminApplicationStats,
  fetchEmployerApplicationStats,
} from './applications.js'
import {
  emptyEmployerInterviewStats,
  fetchAdminInterviewStats,
  fetchEmployerInterviewStats,
  fetchEmployerInterviews,
} from './interviews.js'
import { firstNameFromFullName, userFacingDashboardError } from './candidateDashboard.js'
import { ApiError } from './client.js'
import { fetchCompanyProfile } from './company.js'
import { isAbortError } from './esco.js'
import { fetchMeProfile } from './me.js'
import { formatProfileAccountStatus, formatProfileRole } from './meForm.js'

export const STAFF_ADMIN_DASHBOARD_UNAVAILABLE = 'Dashboard data is unavailable right now.'

export const STAFF_COMPANY_EMPTY = {
  title: 'No company profile is saved yet.',
  description: 'Add company details on Company Profile. This dashboard does not invent a company.',
}

export const STAFF_JOBS_UNAVAILABLE = {
  title: 'No job postings yet.',
  description:
    'Open Jobs to create, edit, publish or close company vacancies. Counts below are calculated from this company’s stored jobs.',
}

export function staffJobCountsFromApplicationStats(stats) {
  const jobs = Array.isArray(stats?.jobs) ? stats.jobs : []
  const counts = {
    total: jobs.length,
    published: 0,
    draft: 0,
    closed: 0,
    suspended: 0,
  }
  for (const job of jobs) {
    if (job.status === 'PUBLISHED') counts.published += 1
    else if (job.status === 'DRAFT') counts.draft += 1
    else if (job.status === 'CLOSED') counts.closed += 1
    else if (job.status === 'SUSPENDED') counts.suspended += 1
  }
  return counts
}

export const STAFF_APPLICATIONS_EMPTY = {
  title: 'No applications yet.',
  description: 'Counts stay at zero until a candidate applies to one of this company’s jobs.',
}

export { STAFF_INTERVIEWS_EMPTY as STAFF_INTERVIEWS_UNAVAILABLE } from './interviews.js'
export { STAFF_INTERVIEWS_EMPTY } from './interviews.js'

export const STAFF_PROFILE_INCOMPLETE = {
  title: 'Your staff profile is still missing a position or location.',
  description: 'Add those details on My Profile when you want them shown here. Empty fields stay empty.',
}

export const ADMIN_USERS_UNAVAILABLE = {
  title: 'User totals load from PostgreSQL.',
  description: 'Open Users to search and suspend accounts. Counts on this dashboard are live aggregates, not mock figures.',
}

export const ADMIN_JOBS_UNAVAILABLE = {
  title: 'Job moderation is on Job Monitoring.',
  description:
    'Open Job Monitoring to search, inspect, suspend or close vacancies. This dashboard does not invent posting totals.',
}

export const ADMIN_LEARNING_UNAVAILABLE = {
  title: 'Learning totals load from PostgreSQL.',
  description: 'Open Learning Content to publish courses. Enrolment counts on this dashboard are live aggregates.',
}

export const ADMIN_ACTIVITY_UNAVAILABLE = {
  title: 'No recent platform events yet.',
  description:
    'Registrations, published jobs, applications, interview invitations, offers and course completions appear here from stored PostgreSQL records.',
}

export const ADMIN_SHORTCUTS = [
  { label: 'Manage Users', to: '/admin/users' },
  { label: 'Companies', to: '/admin/companies' },
  { label: 'Review Jobs', to: '/admin/jobs' },
  { label: 'Manage Learning Content', to: '/admin/learning' },
  { label: 'View Reports', to: '/admin/reports' },
]

export function staffProfileHighlights(profile) {
  return [profile.jobTitle, profile.department, profile.location].filter(
    (value) => typeof value === 'string' && value.length > 0,
  )
}

export function buildStaffDashboard(profile, company = null) {
  return {
    fullName: profile.fullName,
    firstName: firstNameFromFullName(profile.fullName),
    email: profile.email,
    role: profile.role,
    accountStatus: profile.accountStatus,
    jobTitle: profile.jobTitle,
    department: profile.department,
    location: profile.location,
    phone: profile.phone,
    profileHighlights: staffProfileHighlights(profile),
    company,
  }
}

export function buildAdminDashboard(profile) {
  return {
    fullName: profile.fullName,
    firstName: firstNameFromFullName(profile.fullName),
    email: profile.email,
    role: profile.role,
    roleLabel: formatProfileRole(profile.role),
    accountStatus: profile.accountStatus,
    accountStatusLabel: formatProfileAccountStatus(profile.accountStatus),
    phone: profile.phone,
  }
}

export async function fetchStaffDashboard({ signal } = {}) {
  try {
    const [profile, company] = await Promise.all([
      fetchMeProfile({ signal }),
      fetchCompanyProfile({ signal }),
    ])
    const applicationStats = company
      ? await fetchEmployerApplicationStats({ signal })
      : emptyApplicationStats()
    const interviewStats = company
      ? await fetchEmployerInterviewStats({ signal })
      : emptyEmployerInterviewStats()
    const upcomingInterviews = company
      ? (await fetchEmployerInterviews({ status: 'CONFIRMED', page: 1, limit: 5, signal })).items
      : []
    return {
      ...buildStaffDashboard(profile, company),
      applicationStats,
      interviewStats,
      upcomingInterviews,
    }
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(STAFF_ADMIN_DASHBOARD_UNAVAILABLE, 500)
  }
}

export async function fetchAdminDashboard({ signal } = {}) {
  try {
    const [profile, applicationStats, interviewStats, platformStats] = await Promise.all([
      fetchMeProfile({ signal }),
      fetchAdminApplicationStats({ signal }),
      fetchAdminInterviewStats({ signal }),
      fetchAdminPlatformStats({ signal }),
    ])
    return {
      ...buildAdminDashboard(profile),
      applicationStats,
      interviewStats,
      platformStats,
    }
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error
    }
    throw new ApiError(STAFF_ADMIN_DASHBOARD_UNAVAILABLE, 500)
  }
}

export { firstNameFromFullName, userFacingDashboardError }
