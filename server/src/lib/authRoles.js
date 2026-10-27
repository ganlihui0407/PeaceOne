const PUBLIC_REGISTER_ROLES = new Set(['student-jobseeker', 'employer']);
const BLOCKED_REGISTER_ROLES = new Set(['admin', 'ADMIN', 'administrator']);

export function mapRegistrationRole(role, currentPosition) {
  if (typeof role !== 'string') {
    return { error: 'invalid' };
  }

  if (BLOCKED_REGISTER_ROLES.has(role) || role.toUpperCase() === 'ADMIN') {
    return { error: 'forbidden' };
  }

  if (!PUBLIC_REGISTER_ROLES.has(role)) {
    return { error: 'invalid' };
  }

  if (role === 'employer') {
    return { role: 'COMPANY_STAFF' };
  }

  if (currentPosition === 'student') {
    return { role: 'STUDENT' };
  }

  if (currentPosition === 'jobseeker') {
    return { role: 'JOB_SEEKER' };
  }

  return { error: 'invalid' };
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
