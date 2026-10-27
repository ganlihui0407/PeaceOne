export const roleDashboards = {
  STUDENT: '/student/dashboard',
  JOB_SEEKER: '/jobseeker/dashboard',
  COMPANY_STAFF: '/employer/dashboard',
  ADMIN: '/admin/dashboard',
}

export const roleLabels = {
  STUDENT: 'Student',
  JOB_SEEKER: 'Job Seeker',
  COMPANY_STAFF: 'Company Staff',
  ADMIN: 'Administrator',
}

export function dashboardForRole(role) {
  return roleDashboards[role] || '/login'
}
