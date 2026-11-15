import { roleLabels } from '../auth/rolePaths.js'
import {
  EDUCATION_LEVELS,
  GRADUATION_YEAR_MAX,
  GRADUATION_YEAR_MIN,
  ME_PROFILE_FIELD_LIMITS,
} from './me.js'

export const PROFILE_POSITION_UNAVAILABLE = 'Position change requests are not available yet.'

const COMMON_FORM_FIELDS = ['fullName', 'phone']
const CANDIDATE_FORM_FIELDS = [
  'educationLevel',
  'fieldOfStudy',
  'institution',
  'graduationYear',
  'location',
  'experienceSummary',
]
const STAFF_FORM_FIELDS = ['location', 'department']

export function emptyProfileForm() {
  return {
    fullName: '',
    phone: '',
    educationLevel: '',
    fieldOfStudy: '',
    institution: '',
    graduationYear: '',
    location: '',
    experienceSummary: '',
    jobTitle: '',
    department: '',
  }
}

export function allowedProfileFormFields(role) {
  if (role === 'STUDENT' || role === 'JOB_SEEKER') {
    return [...COMMON_FORM_FIELDS, ...CANDIDATE_FORM_FIELDS]
  }
  if (role === 'COMPANY_STAFF') {
    return [...COMMON_FORM_FIELDS, ...STAFF_FORM_FIELDS]
  }
  return [...COMMON_FORM_FIELDS]
}

export function graduationYearToForm(value) {
  if (value == null) {
    return ''
  }
  return String(value)
}

export function graduationYearFromForm(value) {
  if (value == null) {
    return { value: null }
  }
  if (typeof value !== 'string') {
    return { error: 'Enter a 4-digit graduation year between 1950 and 2100.' }
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return { value: null }
  }
  if (!/^\d{4}$/.test(trimmed)) {
    return { error: 'Enter a 4-digit graduation year between 1950 and 2100.' }
  }
  const year = Number(trimmed)
  if (!Number.isInteger(year) || year < GRADUATION_YEAR_MIN || year > GRADUATION_YEAR_MAX) {
    return { error: 'Enter a 4-digit graduation year between 1950 and 2100.' }
  }
  return { value: year }
}

export function profileToFormValues(profile) {
  return {
    ...emptyProfileForm(),
    fullName: profile.fullName ?? '',
    phone: profile.phone ?? '',
    educationLevel: profile.educationLevel ?? '',
    fieldOfStudy: profile.fieldOfStudy ?? '',
    institution: profile.institution ?? '',
    graduationYear: graduationYearToForm(profile.graduationYear),
    location: profile.location ?? '',
    experienceSummary: profile.experienceSummary ?? '',
    jobTitle: profile.jobTitle ?? '',
    department: profile.department ?? '',
  }
}

export function formatProfileAccountStatus(status) {
  if (status === 'ACTIVE') {
    return 'Active'
  }
  if (status === 'SUSPENDED') {
    return 'Suspended'
  }
  return status
}

export function profileAccountStatusBadge(status) {
  return status === 'SUSPENDED' ? 'suspended' : 'active'
}

export function formatProfileRole(role) {
  return roleLabels[role] || role
}

function optionalLengthError(value, max, label) {
  if (value.trim().length > max) {
    return `${label} can be at most ${max} characters.`
  }
  return null
}

export function validateProfileForm(role, form) {
  const errors = {}
  const fullName = typeof form.fullName === 'string' ? form.fullName.trim() : ''
  if (!fullName) {
    errors.fullName = 'Enter your full name.'
  } else if (fullName.length > ME_PROFILE_FIELD_LIMITS.fullName) {
    errors.fullName = `Full name can be at most ${ME_PROFILE_FIELD_LIMITS.fullName} characters.`
  }

  const phoneError = optionalLengthError(form.phone ?? '', ME_PROFILE_FIELD_LIMITS.phone, 'Phone number')
  if (phoneError) {
    errors.phone = phoneError
  }

  if (role === 'STUDENT' || role === 'JOB_SEEKER') {
    const educationLevel = typeof form.educationLevel === 'string' ? form.educationLevel.trim() : ''
    if (educationLevel && !EDUCATION_LEVELS.includes(educationLevel)) {
      errors.educationLevel = 'Choose a listed education level.'
    }
    const fieldError = optionalLengthError(
      form.fieldOfStudy ?? '',
      ME_PROFILE_FIELD_LIMITS.fieldOfStudy,
      'Field of study',
    )
    if (fieldError) {
      errors.fieldOfStudy = fieldError
    }
    const institutionError = optionalLengthError(
      form.institution ?? '',
      ME_PROFILE_FIELD_LIMITS.institution,
      'Institution',
    )
    if (institutionError) {
      errors.institution = institutionError
    }
    const year = graduationYearFromForm(form.graduationYear)
    if (year.error) {
      errors.graduationYear = year.error
    }
    const locationError = optionalLengthError(form.location ?? '', ME_PROFILE_FIELD_LIMITS.location, 'Location')
    if (locationError) {
      errors.location = locationError
    }
    const experienceError = optionalLengthError(
      form.experienceSummary ?? '',
      ME_PROFILE_FIELD_LIMITS.experienceSummary,
      'Experience summary',
    )
    if (experienceError) {
      errors.experienceSummary = experienceError
    }
  }

  if (role === 'COMPANY_STAFF') {
    const locationError = optionalLengthError(form.location ?? '', ME_PROFILE_FIELD_LIMITS.location, 'Location')
    if (locationError) {
      errors.location = locationError
    }
    const departmentError = optionalLengthError(
      form.department ?? '',
      ME_PROFILE_FIELD_LIMITS.department,
      'Department',
    )
    if (departmentError) {
      errors.department = departmentError
    }
  }

  return errors
}

export function profileFormToUpdate(role, form) {
  const update = {}
  for (const field of allowedProfileFormFields(role)) {
    if (field === 'graduationYear') {
      const parsed = graduationYearFromForm(form.graduationYear)
      if (parsed.error) {
        throw new Error(parsed.error)
      }
      update.graduationYear = parsed.value
      continue
    }
    update[field] = form[field]
  }
  return update
}

export const educationLevelOptions = [
  { value: '', label: 'Select education level' },
  ...EDUCATION_LEVELS.map((value) => ({ value, label: value })),
]
