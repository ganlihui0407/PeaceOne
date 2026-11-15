import {
  EMPLOYMENT_TYPES,
  JOB_FIELD_LIMITS,
  JOB_REQUIRED_LEVELS,
  JOB_REQUIRED_SKILL_MAX,
} from './jobs.js'

export function emptyJobForm() {
  return {
    title: '',
    description: '',
    qualificationRequired: '',
    experienceRequired: '',
    employmentType: 'FULL_TIME',
    location: '',
    salaryMin: '',
    salaryMax: '',
    closesAt: '',
    requiredSkills: [],
  }
}

function dateInputValue(value) {
  if (typeof value !== 'string' || value.length < 10) {
    return ''
  }
  return value.slice(0, 10)
}

export function jobToFormValues(job) {
  if (!job) {
    return emptyJobForm()
  }
  return {
    title: job.title ?? '',
    description: job.description ?? '',
    qualificationRequired: job.qualificationRequired ?? '',
    experienceRequired: job.experienceRequired ?? '',
    employmentType: job.employmentType ?? 'FULL_TIME',
    location: job.location ?? '',
    salaryMin: job.salaryMin == null ? '' : String(job.salaryMin),
    salaryMax: job.salaryMax == null ? '' : String(job.salaryMax),
    closesAt: dateInputValue(job.closesAt),
    requiredSkills: (job.requiredSkills ?? []).map((item) => ({
      skillId: item.skill.id,
      preferredLabel: item.skill.preferredLabel,
      skillType: item.skill.skillType ?? null,
      requiredLevel: item.requiredLevel,
    })),
  }
}

function parseSalaryField(value, errors, key) {
  if (value == null || value === '') {
    return null
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    errors[key] = 'Enter a whole number in ringgit, or leave this blank.'
    return null
  }
  const amount = Number.parseInt(value.trim(), 10)
  if (amount > JOB_FIELD_LIMITS.salaryMax) {
    errors[key] = 'Salary is too large.'
    return null
  }
  return amount
}

export function validateJobForm(form) {
  const errors = {}
  const title = form.title.trim()
  const description = form.description.trim()
  const qualificationRequired = form.qualificationRequired.trim()
  const experienceRequired = form.experienceRequired.trim()
  const location = form.location.trim()

  if (!title) errors.title = 'Enter a job title.'
  else if (title.length > JOB_FIELD_LIMITS.title) errors.title = 'Job title is too long.'

  if (!description) errors.description = 'Enter a job description.'
  else if (description.length > JOB_FIELD_LIMITS.description) errors.description = 'Job description is too long.'

  if (!qualificationRequired) errors.qualificationRequired = 'Enter the qualification required.'
  else if (qualificationRequired.length > JOB_FIELD_LIMITS.qualificationRequired) {
    errors.qualificationRequired = 'Qualification text is too long.'
  }

  if (!experienceRequired) errors.experienceRequired = 'Enter the experience required.'
  else if (experienceRequired.length > JOB_FIELD_LIMITS.experienceRequired) {
    errors.experienceRequired = 'Experience text is too long.'
  }

  if (!EMPLOYMENT_TYPES.includes(form.employmentType)) {
    errors.employmentType = 'Choose an employment type.'
  }

  if (!location) errors.location = 'Enter a location.'
  else if (location.length > JOB_FIELD_LIMITS.location) errors.location = 'Location is too long.'

  const salaryMin = parseSalaryField(form.salaryMin, errors, 'salaryMin')
  const salaryMax = parseSalaryField(form.salaryMax, errors, 'salaryMax')
  if (
    salaryMin != null
    && salaryMax != null
    && !errors.salaryMin
    && !errors.salaryMax
    && salaryMin > salaryMax
  ) {
    errors.salaryMin = 'Minimum salary cannot be higher than maximum salary.'
  }

  if (form.closesAt && !/^\d{4}-\d{2}-\d{2}$/.test(form.closesAt)) {
    errors.closesAt = 'Enter a valid closing date.'
  }

  if (!Array.isArray(form.requiredSkills)) {
    errors.requiredSkills = 'Select skills from the ESCO catalogue.'
  } else if (form.requiredSkills.length > JOB_REQUIRED_SKILL_MAX) {
    errors.requiredSkills = `You can add up to ${JOB_REQUIRED_SKILL_MAX} skills.`
  } else {
    const ids = new Set()
    for (const skill of form.requiredSkills) {
      if (!skill?.skillId || ids.has(skill.skillId)) {
        errors.requiredSkills = 'Each ESCO skill can only be added once.'
        break
      }
      if (!JOB_REQUIRED_LEVELS.includes(skill.requiredLevel)) {
        errors.requiredSkills = 'Choose Beginner, Intermediate or Advanced for each skill.'
        break
      }
      ids.add(skill.skillId)
    }
  }

  return errors
}

export function jobFormToWriteBody(form) {
  const salaryMin = form.salaryMin === '' ? null : Number.parseInt(form.salaryMin, 10)
  const salaryMax = form.salaryMax === '' ? null : Number.parseInt(form.salaryMax, 10)
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    qualificationRequired: form.qualificationRequired.trim(),
    experienceRequired: form.experienceRequired.trim(),
    employmentType: form.employmentType,
    location: form.location.trim(),
    salaryMin,
    salaryMax,
    closesAt: form.closesAt
      ? new Date(`${form.closesAt}T23:59:59`).toISOString()
      : null,
    requiredSkills: form.requiredSkills.map((skill) => ({
      skillId: skill.skillId,
      requiredLevel: skill.requiredLevel,
    })),
  }
}

export function hasJobSkill(skills, skillId) {
  return skills.some((skill) => skill.skillId === skillId)
}
