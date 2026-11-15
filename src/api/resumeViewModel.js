import { resolveResumeTemplateKey } from './resumeTemplates.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function text(value) {
  if (value == null) {
    return ''
  }
  return String(value).replace(/\s+/g, ' ').trim()
}

function yearText(value) {
  if (value == null || value === '') {
    return ''
  }
  const numeric = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10)
  if (!Number.isInteger(numeric)) {
    return text(value)
  }
  return String(numeric)
}

function formatMonthYear(value) {
  const raw = text(value)
  if (!raw) {
    return ''
  }
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return raw
  }
  const month = Number(match[2])
  if (month < 1 || month > 12) {
    return raw
  }
  return `${MONTHS[month - 1]} ${match[1]}`
}

function joinParts(parts, separator = ' · ') {
  return parts.map((part) => text(part)).filter(Boolean).join(separator)
}

function formatYearRange(startYear, endYear) {
  const start = yearText(startYear)
  const end = yearText(endYear)
  if (start && end) {
    return `${start} – ${end}`
  }
  return start || end
}

function formatDateRange(startDate, endDate, isCurrent) {
  const start = formatMonthYear(startDate)
  if (isCurrent) {
    return start ? `${start} – Present` : 'Present'
  }
  const end = formatMonthYear(endDate)
  if (start && end) {
    return `${start} – ${end}`
  }
  return start || end
}

export function buildResumeViewModel(source = {}) {
  const education = (source.education ?? [])
    .map((item) => {
      const institution = text(item?.institution)
      const qualification = text(item?.qualification)
      const fieldOfStudy = text(item?.fieldOfStudy)
      const notes = text(item?.notes)
      const years = formatYearRange(item?.startYear, item?.endYear)
      const detail = joinParts([qualification, fieldOfStudy])
      if (!institution && !detail && !years && !notes) {
        return null
      }
      return { institution, detail, years, notes }
    })
    .filter(Boolean)

  const experience = (source.experience ?? [])
    .map((item) => {
      const jobTitle = text(item?.jobTitle)
      const organization = text(item?.organization)
      const location = text(item?.location)
      const description = text(item?.description)
      const dates = formatDateRange(item?.startDate, item?.endDate, Boolean(item?.isCurrent))
      if (!jobTitle && !organization && !location && !description && !dates) {
        return null
      }
      return { jobTitle, organization, location, dates, description }
    })
    .filter(Boolean)

  const skills = (source.skills ?? [])
    .map((item) => {
      const label = text(item?.label)
      if (!label) {
        return null
      }
      const proficiencyLevel = text(item?.proficiencyLevel)
      return {
        label,
        proficiencyLevel,
        display: proficiencyLevel ? `${label} (${proficiencyLevel})` : label,
      }
    })
    .filter(Boolean)

  const certifications = (source.certifications ?? [])
    .map((item) => {
      const name = text(item?.name)
      const issuer = text(item?.issuer)
      const year = yearText(item?.year)
      const credentialId = text(item?.credentialId)
      if (!name && !issuer && !year && !credentialId) {
        return null
      }
      return {
        name,
        issuer,
        year,
        credentialId,
        display: joinParts([name, issuer, year, credentialId ? `ID ${credentialId}` : '']),
      }
    })
    .filter(Boolean)

  const fullName = text(source.fullName)
  const email = text(source.email)
  const phone = text(source.phone)
  const location = text(source.location)
  const summary = text(source.summary)
  const contactLine = joinParts([email, phone, location])

  return {
    templateKey: resolveResumeTemplateKey(source.templateKey),
    title: text(source.title),
    fullName,
    email,
    phone,
    location,
    contactLine,
    summary,
    education,
    experience,
    skills,
    certifications,
    hasContact: Boolean(contactLine),
    hasSummary: Boolean(summary),
    hasEducation: education.length > 0,
    hasExperience: experience.length > 0,
    hasSkills: skills.length > 0,
    hasCertifications: certifications.length > 0,
  }
}

export function pdfFilenameFromTitle(title) {
  const cleaned = text(title)
    .replaceAll('..', ' ')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const base = (cleaned || 'resume').slice(0, 80)
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`
}
