import { COMPANY_FIELD_LIMITS } from './company.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emptyCompanyForm() {
  return {
    companyName: '',
    registrationNumber: '',
    industry: '',
    companySize: '',
    website: '',
    email: '',
    phone: '',
    location: '',
    address: '',
    description: '',
  }
}

export function companyToFormValues(company) {
  if (!company) {
    return emptyCompanyForm()
  }
  return {
    companyName: company.companyName ?? '',
    registrationNumber: company.registrationNumber ?? '',
    industry: company.industry ?? '',
    companySize: company.companySize ?? '',
    website: company.website ?? '',
    email: company.email ?? '',
    phone: company.phone ?? '',
    location: company.location ?? '',
    address: company.address ?? '',
    description: company.description ?? '',
  }
}

function optionalLengthError(value, max, label) {
  if (value.trim().length > max) {
    return `${label} can be at most ${max} characters.`
  }
  return null
}

export function validateCompanyForm(form) {
  const errors = {}
  const companyName = typeof form.companyName === 'string' ? form.companyName.trim() : ''
  if (!companyName) {
    errors.companyName = 'Enter the company name.'
  } else if (companyName.length > COMPANY_FIELD_LIMITS.companyName) {
    errors.companyName = `Company name can be at most ${COMPANY_FIELD_LIMITS.companyName} characters.`
  }

  const checks = [
    ['registrationNumber', COMPANY_FIELD_LIMITS.registrationNumber, 'Registration number'],
    ['industry', COMPANY_FIELD_LIMITS.industry, 'Industry'],
    ['companySize', COMPANY_FIELD_LIMITS.companySize, 'Company size'],
    ['website', COMPANY_FIELD_LIMITS.website, 'Website'],
    ['phone', COMPANY_FIELD_LIMITS.phone, 'Phone number'],
    ['location', COMPANY_FIELD_LIMITS.location, 'Location'],
    ['address', COMPANY_FIELD_LIMITS.address, 'Address'],
    ['description', COMPANY_FIELD_LIMITS.description, 'Company description'],
  ]
  for (const [field, max, label] of checks) {
    const error = optionalLengthError(form[field] ?? '', max, label)
    if (error) {
      errors[field] = error
    }
  }

  const email = typeof form.email === 'string' ? form.email.trim() : ''
  if (email) {
    if (email.length > COMPANY_FIELD_LIMITS.email) {
      errors.email = `Email can be at most ${COMPANY_FIELD_LIMITS.email} characters.`
    } else if (!EMAIL_RE.test(email)) {
      errors.email = 'Enter a valid email address.'
    }
  }

  return errors
}

export function companyFormToUpdate(form) {
  return {
    companyName: form.companyName,
    registrationNumber: form.registrationNumber,
    industry: form.industry,
    companySize: form.companySize,
    website: form.website,
    email: form.email,
    phone: form.phone,
    location: form.location,
    address: form.address,
    description: form.description,
  }
}
