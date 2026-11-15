import assert from 'node:assert/strict'
import { test } from 'node:test'
import { educationLevels } from '../data/candidateData.js'
import { EDUCATION_LEVELS } from './me.js'
import {
  PROFILE_POSITION_UNAVAILABLE,
  allowedProfileFormFields,
  educationLevelOptions,
  formatProfileAccountStatus,
  formatProfileRole,
  graduationYearFromForm,
  graduationYearToForm,
  profileAccountStatusBadge,
  profileFormToUpdate,
  profileToFormValues,
  validateProfileForm,
} from './meForm.js'

const candidateProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'stage63.student@peaceone.test',
  fullName: 'Stage Six Three',
  phone: '012-345 6789',
  role: 'STUDENT',
  accountStatus: 'ACTIVE',
  educationLevel: "Bachelor's Degree",
  fieldOfStudy: 'Information Systems',
  institution: 'Universiti Malaya',
  graduationYear: 2027,
  location: 'Kuala Lumpur',
  experienceSummary: 'Internship reporting.',
  jobTitle: 'Analyst',
  department: 'Human Resources',
}

test('educationLevel options match the existing profile UI and include an empty choice', () => {
  assert.deepEqual(EDUCATION_LEVELS, educationLevels)
  assert.deepEqual(
    educationLevelOptions.map((option) => option.value),
    ['', ...educationLevels],
  )
})

test('role-specific forms expose only permitted profile fields', () => {
  assert.deepEqual(allowedProfileFormFields('STUDENT'), [
    'fullName',
    'phone',
    'educationLevel',
    'fieldOfStudy',
    'institution',
    'graduationYear',
    'location',
    'experienceSummary',
  ])
  assert.deepEqual(allowedProfileFormFields('JOB_SEEKER'), allowedProfileFormFields('STUDENT'))
  assert.deepEqual(allowedProfileFormFields('COMPANY_STAFF'), [
    'fullName',
    'phone',
    'location',
    'department',
  ])
  assert.deepEqual(allowedProfileFormFields('ADMIN'), ['fullName', 'phone'])
})

test('graduationYear converts between the form string and API integer', () => {
  assert.equal(graduationYearToForm(null), '')
  assert.equal(graduationYearToForm(2027), '2027')
  assert.deepEqual(graduationYearFromForm(''), { value: null })
  assert.deepEqual(graduationYearFromForm(' 2027 '), { value: 2027 })
  assert.equal(graduationYearFromForm('1949').error.includes('1950'), true)
  assert.equal(graduationYearFromForm('2101').error.includes('2100'), true)
  assert.equal(graduationYearFromForm('2027.5').error.includes('4-digit'), true)
  assert.equal(graduationYearFromForm('abcd').error.includes('4-digit'), true)
})

test('profileToFormValues maps null API fields to empty inputs', () => {
  const form = profileToFormValues({
    ...candidateProfile,
    phone: null,
    educationLevel: null,
    graduationYear: null,
    location: null,
  })
  assert.equal(form.fullName, 'Stage Six Three')
  assert.equal(form.phone, '')
  assert.equal(form.educationLevel, '')
  assert.equal(form.graduationYear, '')
  assert.equal(form.location, '')
  assert.equal(form.jobTitle, 'Analyst')
})

test('candidate updates send an integer graduationYear and omit protected fields', () => {
  const form = profileToFormValues(candidateProfile)
  form.graduationYear = '2028'
  form.phone = ''
  const update = profileFormToUpdate('STUDENT', form)
  assert.equal(update.graduationYear, 2028)
  assert.equal(update.phone, '')
  assert.equal(update.educationLevel, "Bachelor's Degree")
  assert.equal(update.jobTitle, undefined)
  assert.equal(update.department, undefined)
  assert.equal(update.email, undefined)
  assert.equal(update.role, undefined)
  assert.equal(update.accountStatus, undefined)
  assert.equal(update.id, undefined)
})

test('staff updates send location and department, not jobTitle or candidate education fields', () => {
  const update = profileFormToUpdate('COMPANY_STAFF', {
    fullName: 'Sarah Lim',
    phone: '013-220 8841',
    location: 'Petaling Jaya',
    jobTitle: 'Recruitment Executive',
    department: 'Human Resources',
    educationLevel: "Bachelor's Degree",
    graduationYear: '2027',
  })
  assert.deepEqual(update, {
    fullName: 'Sarah Lim',
    phone: '013-220 8841',
    location: 'Petaling Jaya',
    department: 'Human Resources',
  })
  assert.equal(update.jobTitle, undefined)
})

test('admin updates send only fullName and phone', () => {
  const update = profileFormToUpdate('ADMIN', {
    fullName: 'Alex Tan',
    phone: '011-560 2291',
    location: 'Kuala Lumpur',
    jobTitle: 'Administrator',
  })
  assert.deepEqual(update, {
    fullName: 'Alex Tan',
    phone: '011-560 2291',
  })
})

test('field validation keeps invalid values out of the API payload', () => {
  const errors = validateProfileForm('STUDENT', {
    fullName: '',
    phone: '1'.repeat(31),
    educationLevel: 'PhD',
    fieldOfStudy: 'a'.repeat(101),
    institution: 'a'.repeat(151),
    graduationYear: '1949',
    location: 'a'.repeat(101),
    experienceSummary: 'a'.repeat(2001),
    jobTitle: '',
    department: '',
  })
  assert.equal(errors.fullName.includes('full name'), true)
  assert.equal(errors.phone.includes('30'), true)
  assert.equal(errors.educationLevel.includes('listed'), true)
  assert.equal(errors.graduationYear.includes('1950'), true)
  assert.equal(errors.fieldOfStudy.includes('100'), true)
  assert.equal(Object.keys(validateProfileForm('ADMIN', {
    fullName: 'Alex Tan',
    phone: '011',
    educationLevel: 'PhD',
    graduationYear: '1949',
    location: 'a'.repeat(101),
  })).length, 0)
})

test('account status and role labels stay read-only display values', () => {
  assert.equal(formatProfileAccountStatus('ACTIVE'), 'Active')
  assert.equal(formatProfileAccountStatus('SUSPENDED'), 'Suspended')
  assert.equal(profileAccountStatusBadge('SUSPENDED'), 'suspended')
  assert.equal(formatProfileRole('STUDENT'), 'Student')
  assert.equal(formatProfileRole('JOB_SEEKER'), 'Job Seeker')
  assert.equal(formatProfileRole('COMPANY_STAFF'), 'Company Staff')
  assert.equal(formatProfileRole('ADMIN'), 'Administrator')
  assert.equal(PROFILE_POSITION_UNAVAILABLE.includes('not available'), true)
})
