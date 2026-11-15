import {
  RESUME_FIELD_LIMITS,
  RESUME_SECTION_LIMITS,
  RESUME_SKILL_PROFICIENCY_LEVELS,
  RESUME_TEMPLATE_KEYS,
  RESUME_YEAR_MAX,
  RESUME_YEAR_MIN,
} from './resumes.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function nextKey() {
  return `row-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function asText(value) {
  return value == null ? '' : String(value)
}

function optionalText(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length > 0 ? trimmed : null
}

function yearOrNull(value) {
  const trimmed = asText(value).trim()
  if (!trimmed) {
    return null
  }
  const year = Number(trimmed)
  return Number.isInteger(year) ? year : null
}

export function emptyEducationItem() {
  return {
    key: nextKey(),
    institution: '',
    qualification: '',
    fieldOfStudy: '',
    startYear: '',
    endYear: '',
    notes: '',
  }
}

export function emptyExperienceItem() {
  return {
    key: nextKey(),
    jobTitle: '',
    organization: '',
    location: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    description: '',
  }
}

export function emptySkillItem() {
  return {
    key: nextKey(),
    skillId: '',
    label: '',
    proficiencyLevel: '',
  }
}

export function emptyCertificationItem() {
  return {
    key: nextKey(),
    name: '',
    issuer: '',
    year: '',
    credentialId: '',
  }
}

export function emptyResumeFormErrors() {
  return {
    education: {},
    experience: {},
    skills: {},
    certifications: {},
  }
}

export function emptyResumeForm(templateKey = 'classic') {
  return {
    title: '',
    summary: '',
    templateKey: RESUME_TEMPLATE_KEYS.includes(templateKey) ? templateKey : 'classic',
    fullName: '',
    email: '',
    phone: '',
    location: '',
    education: [],
    experience: [],
    skills: [],
    certifications: [],
  }
}

export function resumeToForm(resume) {
  if (!resume) {
    return emptyResumeForm()
  }
  return {
    title: asText(resume.title),
    summary: asText(resume.summary),
    templateKey: RESUME_TEMPLATE_KEYS.includes(resume.templateKey) ? resume.templateKey : 'classic',
    fullName: asText(resume.fullName),
    email: asText(resume.email),
    phone: asText(resume.phone),
    location: asText(resume.location),
    education: (resume.education ?? []).map((item) => ({
      key: nextKey(),
      institution: asText(item.institution),
      qualification: asText(item.qualification),
      fieldOfStudy: asText(item.fieldOfStudy),
      startYear: asText(item.startYear),
      endYear: asText(item.endYear),
      notes: asText(item.notes),
    })),
    experience: (resume.experience ?? []).map((item) => ({
      key: nextKey(),
      jobTitle: asText(item.jobTitle),
      organization: asText(item.organization),
      location: asText(item.location),
      startDate: asText(item.startDate),
      endDate: asText(item.endDate),
      isCurrent: Boolean(item.isCurrent),
      description: asText(item.description),
    })),
    skills: (resume.skills ?? []).map((item) => ({
      key: nextKey(),
      skillId: asText(item.skillId),
      label: asText(item.label),
      proficiencyLevel: asText(item.proficiencyLevel),
    })),
    certifications: (resume.certifications ?? []).map((item) => ({
      key: nextKey(),
      name: asText(item.name),
      issuer: asText(item.issuer),
      year: asText(item.year),
      credentialId: asText(item.credentialId),
    })),
  }
}

function lengthError(value, max, label) {
  if (value.length > max) {
    return `${label} can be at most ${max} characters.`
  }
  return null
}

function requiredText(value, max, emptyMessage, label) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) {
    return { value: '', error: emptyMessage }
  }
  return { value: trimmed, error: lengthError(trimmed, max, label) }
}

function optionalLimited(value, max, label) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return { value: trimmed, error: lengthError(trimmed, max, label) }
}

function parseYearField(value, label) {
  const trimmed = asText(value).trim()
  if (!trimmed) {
    return { value: null, error: null }
  }
  if (!/^\d{4}$/.test(trimmed)) {
    return { value: null, error: `Enter a valid ${label}.` }
  }
  const year = Number(trimmed)
  if (year < RESUME_YEAR_MIN || year > RESUME_YEAR_MAX) {
    return {
      value: year,
      error: `${label} must be between ${RESUME_YEAR_MIN} and ${RESUME_YEAR_MAX}.`,
    }
  }
  return { value: year, error: null }
}

function parseIsoDateField(value, label) {
  const trimmed = asText(value).trim()
  if (!trimmed) {
    return { value: null, error: null }
  }
  if (!ISO_DATE_RE.test(trimmed)) {
    return { value: null, error: `Enter a valid ${label}.` }
  }
  return { value: trimmed, error: null }
}

function setRowError(bucket, key, field, message) {
  if (!message) {
    return
  }
  bucket[key] = { ...(bucket[key] || {}), [field]: message }
}

export function validateResumeForm(form) {
  const errors = emptyResumeFormErrors()
  const title = requiredText(form.title, RESUME_FIELD_LIMITS.title, 'Enter a resume title.', 'Resume title')
  if (title.error) {
    errors.title = title.error
  }

  const summary = optionalLimited(form.summary, RESUME_FIELD_LIMITS.summary, 'Summary')
  if (summary.error) {
    errors.summary = summary.error
  }

  const fullName = requiredText(form.fullName, RESUME_FIELD_LIMITS.fullName, 'Enter a full name.', 'Full name')
  if (fullName.error) {
    errors.fullName = fullName.error
  }

  const email = requiredText(form.email, RESUME_FIELD_LIMITS.email, 'Enter an email address.', 'Email')
  if (email.error) {
    errors.email = email.error
  } else if (!EMAIL_RE.test(email.value)) {
    errors.email = 'Enter a valid email address.'
  }

  const phone = optionalLimited(form.phone, RESUME_FIELD_LIMITS.phone, 'Phone')
  if (phone.error) {
    errors.phone = phone.error
  }

  const location = optionalLimited(form.location, RESUME_FIELD_LIMITS.location, 'Location')
  if (location.error) {
    errors.location = location.error
  }

  if ((form.education ?? []).length > RESUME_SECTION_LIMITS.education) {
    errors.educationLimit = `You can save up to ${RESUME_SECTION_LIMITS.education} education entries.`
  }
  if ((form.experience ?? []).length > RESUME_SECTION_LIMITS.experience) {
    errors.experienceLimit = `You can save up to ${RESUME_SECTION_LIMITS.experience} experience entries.`
  }
  if ((form.skills ?? []).length > RESUME_SECTION_LIMITS.skills) {
    errors.skillsLimit = `You can save up to ${RESUME_SECTION_LIMITS.skills} skills.`
  }
  if ((form.certifications ?? []).length > RESUME_SECTION_LIMITS.certifications) {
    errors.certificationsLimit = `You can save up to ${RESUME_SECTION_LIMITS.certifications} certifications.`
  }

  for (const item of form.education ?? []) {
    const institution = requiredText(
      item.institution,
      RESUME_FIELD_LIMITS.institution,
      'Enter an institution.',
      'Institution',
    )
    setRowError(errors.education, item.key, 'institution', institution.error)
    setRowError(
      errors.education,
      item.key,
      'qualification',
      optionalLimited(item.qualification, RESUME_FIELD_LIMITS.qualification, 'Qualification').error,
    )
    setRowError(
      errors.education,
      item.key,
      'fieldOfStudy',
      optionalLimited(item.fieldOfStudy, RESUME_FIELD_LIMITS.fieldOfStudy, 'Field of study').error,
    )
    setRowError(errors.education, item.key, 'notes', optionalLimited(item.notes, RESUME_FIELD_LIMITS.notes, 'Description').error)
    const startYear = parseYearField(item.startYear, 'start year')
    const endYear = parseYearField(item.endYear, 'end year')
    setRowError(errors.education, item.key, 'startYear', startYear.error)
    setRowError(errors.education, item.key, 'endYear', endYear.error)
    if (!startYear.error && !endYear.error && startYear.value != null && endYear.value != null && endYear.value < startYear.value) {
      setRowError(errors.education, item.key, 'endYear', 'End year cannot be before start year.')
    }
  }

  for (const item of form.experience ?? []) {
    setRowError(
      errors.experience,
      item.key,
      'jobTitle',
      requiredText(item.jobTitle, RESUME_FIELD_LIMITS.jobTitle, 'Enter a job title.', 'Job title').error,
    )
    setRowError(
      errors.experience,
      item.key,
      'organization',
      requiredText(item.organization, RESUME_FIELD_LIMITS.organization, 'Enter a company.', 'Company').error,
    )
    setRowError(
      errors.experience,
      item.key,
      'location',
      optionalLimited(item.location, RESUME_FIELD_LIMITS.location, 'Location').error,
    )
    setRowError(
      errors.experience,
      item.key,
      'description',
      optionalLimited(item.description, RESUME_FIELD_LIMITS.description, 'Description').error,
    )
    const startDate = parseIsoDateField(item.startDate, 'start date')
    const endDate = parseIsoDateField(item.isCurrent ? '' : item.endDate, 'end date')
    setRowError(errors.experience, item.key, 'startDate', startDate.error)
    if (item.isCurrent && optionalText(item.endDate)) {
      setRowError(errors.experience, item.key, 'endDate', 'Clear the end date while currently working.')
    } else {
      setRowError(errors.experience, item.key, 'endDate', endDate.error)
    }
    if (
      !startDate.error &&
      !endDate.error &&
      !item.isCurrent &&
      startDate.value &&
      endDate.value &&
      endDate.value < startDate.value
    ) {
      setRowError(errors.experience, item.key, 'endDate', 'End date cannot be before start date.')
    }
  }

  const seenSkillIds = new Set()
  for (const item of form.skills ?? []) {
    const label = optionalLimited(item.label, RESUME_FIELD_LIMITS.skillLabel, 'Skill')
    setRowError(errors.skills, item.key, 'label', label.error)
    if (!optionalText(item.label) && !optionalText(item.skillId)) {
      setRowError(errors.skills, item.key, 'label', 'Enter a skill name.')
    }
    const proficiency = asText(item.proficiencyLevel).trim()
    if (proficiency && !RESUME_SKILL_PROFICIENCY_LEVELS.includes(proficiency)) {
      setRowError(errors.skills, item.key, 'proficiencyLevel', 'Choose a valid proficiency level.')
    }
    const skillId = optionalText(item.skillId)
    if (skillId) {
      if (seenSkillIds.has(skillId)) {
        setRowError(errors.skills, item.key, 'skillId', 'This ESCO skill is already on the resume.')
      }
      seenSkillIds.add(skillId)
    }
  }

  for (const item of form.certifications ?? []) {
    setRowError(
      errors.certifications,
      item.key,
      'name',
      requiredText(item.name, RESUME_FIELD_LIMITS.certificationName, 'Enter a certification name.', 'Certification name')
        .error,
    )
    setRowError(
      errors.certifications,
      item.key,
      'issuer',
      optionalLimited(item.issuer, RESUME_FIELD_LIMITS.issuer, 'Issuing organisation').error,
    )
    setRowError(
      errors.certifications,
      item.key,
      'credentialId',
      optionalLimited(item.credentialId, RESUME_FIELD_LIMITS.credentialId, 'Credential ID').error,
    )
    setRowError(errors.certifications, item.key, 'year', parseYearField(item.year, 'year issued').error)
  }

  return errors
}

function rowHasErrors(row) {
  return Boolean(row && Object.values(row).some(Boolean))
}

export function hasResumeFormErrors(errors) {
  if (!errors) {
    return false
  }
  if (
    errors.title ||
    errors.summary ||
    errors.fullName ||
    errors.email ||
    errors.phone ||
    errors.location ||
    errors.educationLimit ||
    errors.experienceLimit ||
    errors.skillsLimit ||
    errors.certificationsLimit
  ) {
    return true
  }
  return ['education', 'experience', 'skills', 'certifications'].some((section) =>
    Object.values(errors[section] || {}).some(rowHasErrors),
  )
}

function mapEducation(item) {
  return {
    institution: item.institution.trim(),
    qualification: optionalText(item.qualification),
    fieldOfStudy: optionalText(item.fieldOfStudy),
    startYear: yearOrNull(item.startYear),
    endYear: yearOrNull(item.endYear),
    notes: optionalText(item.notes),
  }
}

function mapExperience(item) {
  return {
    jobTitle: item.jobTitle.trim(),
    organization: item.organization.trim(),
    location: optionalText(item.location),
    startDate: optionalText(item.startDate),
    endDate: item.isCurrent ? null : optionalText(item.endDate),
    isCurrent: Boolean(item.isCurrent),
    description: optionalText(item.description),
  }
}

function mapSkill(item) {
  const skillId = optionalText(item.skillId)
  const proficiency = asText(item.proficiencyLevel).trim()
  return {
    skillId,
    label: optionalText(item.label),
    proficiencyLevel: RESUME_SKILL_PROFICIENCY_LEVELS.includes(proficiency) ? proficiency : null,
  }
}

function mapCertification(item) {
  return {
    name: item.name.trim(),
    issuer: optionalText(item.issuer),
    year: yearOrNull(item.year),
    credentialId: optionalText(item.credentialId),
  }
}

export function formToUpdate(form) {
  return {
    title: typeof form.title === 'string' ? form.title.trim() : '',
    summary: optionalText(form.summary),
    templateKey: RESUME_TEMPLATE_KEYS.includes(form.templateKey) ? form.templateKey : 'classic',
    fullName: typeof form.fullName === 'string' ? form.fullName.trim() : '',
    email: optionalText(form.email),
    phone: optionalText(form.phone),
    location: optionalText(form.location),
    education: (form.education ?? []).map(mapEducation),
    experience: (form.experience ?? []).map(mapExperience),
    skills: (form.skills ?? []).map(mapSkill),
    certifications: (form.certifications ?? []).map(mapCertification),
  }
}

export function resumeFormSnapshot(form) {
  return JSON.stringify(formToUpdate(form))
}

export function moveItemByKey(items, key, offset) {
  if (!Array.isArray(items)) {
    return items
  }
  const index = items.findIndex((item) => item.key === key)
  const next = index + offset
  if (index < 0 || next < 0 || next >= items.length) {
    return items
  }
  const copy = [...items]
  const [row] = copy.splice(index, 1)
  copy.splice(next, 0, row)
  return copy
}

export function canAddSection(form, section) {
  const limit = RESUME_SECTION_LIMITS[section]
  if (!limit) {
    return false
  }
  return (form?.[section] ?? []).length < limit
}

export function hasEscoSkill(form, skillId) {
  const id = optionalText(skillId)
  if (!id) {
    return false
  }
  return (form?.skills ?? []).some((item) => item.skillId === id)
}

export function skillFromSavedRecord(record) {
  return {
    ...emptySkillItem(),
    skillId: asText(record?.skill?.id),
    label: asText(record?.skill?.preferredLabel),
    proficiencyLevel: asText(record?.proficiencyLevel),
  }
}

export function skillFromCatalogue(skill, proficiencyLevel = '') {
  return {
    ...emptySkillItem(),
    skillId: asText(skill?.id),
    label: asText(skill?.preferredLabel),
    proficiencyLevel: asText(proficiencyLevel),
  }
}

export function customSkillItem(label, proficiencyLevel = '') {
  return {
    ...emptySkillItem(),
    skillId: '',
    label: asText(label).trim(),
    proficiencyLevel: asText(proficiencyLevel),
  }
}
