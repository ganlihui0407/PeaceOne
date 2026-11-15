import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canAddSection,
  customSkillItem,
  emptyEducationItem,
  emptyExperienceItem,
  formToUpdate,
  hasEscoSkill,
  hasResumeFormErrors,
  moveItemByKey,
  resumeFormSnapshot,
  resumeToForm,
  skillFromCatalogue,
  skillFromSavedRecord,
  validateResumeForm,
} from './resumeForm.js'

const ESCO_ID = '426ceaba-6867-481c-bb6b-aee3933da7d2'
const OTHER_ESCO_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'

function sampleResume(overrides = {}) {
  return {
    id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    title: 'Software internship CV',
    summary: 'Looking for a software role.',
    templateKey: 'classic',
    isPrimary: true,
    fullName: 'Stage Seven Three Student',
    email: 'stage73.student@peaceone.test',
    phone: '012-680 0001',
    location: 'Kuala Lumpur',
    education: [
      {
        id: 'edu-should-not-persist',
        institution: 'TAR UMT',
        qualification: 'Bachelor of Computer Science',
        fieldOfStudy: 'Software Engineering',
        startYear: 2022,
        endYear: 2026,
        notes: 'Deans list.',
        sortOrder: 0,
      },
    ],
    experience: [
      {
        id: 'exp-should-not-persist',
        jobTitle: 'Intern',
        organization: 'PeaceOne Labs',
        location: 'Remote',
        startDate: '2025-06-01',
        endDate: null,
        isCurrent: true,
        description: 'Built candidate pages.',
        sortOrder: 0,
      },
    ],
    skills: [
      {
        id: 'skill-row-should-not-persist',
        skillId: ESCO_ID,
        label: 'ICT safety',
        proficiencyLevel: 'Intermediate',
        skill: { preferredLabel: 'ICT safety' },
        sortOrder: 0,
      },
    ],
    certifications: [
      {
        id: 'cert-should-not-persist',
        name: 'AWS Cloud Practitioner',
        issuer: 'Amazon',
        year: 2025,
        credentialId: 'AWS-1',
        sortOrder: 0,
      },
    ],
    createdAt: '2026-11-13T02:40:00.000Z',
    updatedAt: '2026-11-13T03:10:00.000Z',
    ...overrides,
  }
}

test('resumeToForm populates every editor section from a saved resume', () => {
  const form = resumeToForm(sampleResume())
  assert.equal(form.title, 'Software internship CV')
  assert.equal(form.fullName, 'Stage Seven Three Student')
  assert.equal(form.email, 'stage73.student@peaceone.test')
  assert.equal(form.phone, '012-680 0001')
  assert.equal(form.location, 'Kuala Lumpur')
  assert.equal(form.summary, 'Looking for a software role.')
  assert.equal(form.education[0].institution, 'TAR UMT')
  assert.equal(form.education[0].qualification, 'Bachelor of Computer Science')
  assert.equal(form.education[0].fieldOfStudy, 'Software Engineering')
  assert.equal(form.education[0].startYear, '2022')
  assert.equal(form.education[0].notes, 'Deans list.')
  assert.equal(form.experience[0].jobTitle, 'Intern')
  assert.equal(form.experience[0].organization, 'PeaceOne Labs')
  assert.equal(form.experience[0].isCurrent, true)
  assert.equal(form.skills[0].skillId, ESCO_ID)
  assert.equal(form.skills[0].label, 'ICT safety')
  assert.equal(form.certifications[0].name, 'AWS Cloud Practitioner')
  assert.equal(form.certifications[0].year, '2025')
  assert.equal(form.certifications[0].credentialId, 'AWS-1')
  assert.equal('id' in form.education[0], false)
  assert.equal('sortOrder' in form.experience[0], false)
})

test('formToUpdate sends every nested section and strips row ids', () => {
  const body = formToUpdate(resumeToForm(sampleResume()))
  assert.deepEqual(Object.keys(body), [
    'title',
    'summary',
    'templateKey',
    'fullName',
    'email',
    'phone',
    'location',
    'education',
    'experience',
    'skills',
    'certifications',
  ])
  assert.equal(body.education.length, 1)
  assert.equal(body.experience.length, 1)
  assert.equal(body.skills.length, 1)
  assert.equal(body.certifications.length, 1)
  assert.equal(body.education[0].institution, 'TAR UMT')
  assert.equal(body.education[0].startYear, 2022)
  assert.equal(body.experience[0].isCurrent, true)
  assert.equal(body.experience[0].endDate, null)
  assert.equal(body.skills[0].skillId, ESCO_ID)
  assert.equal(body.skills[0].label, 'ICT safety')
  assert.equal(body.certifications[0].year, 2025)
  assert.equal('id' in body.education[0], false)
  assert.equal('userId' in body, false)
  assert.equal('expiryDate' in body.certifications[0], false)
  assert.equal('credentialUrl' in body.certifications[0], false)
})

test('education, experience and certification entries can be added, removed and reordered in the form', () => {
  const form = resumeToForm(sampleResume({ education: [], experience: [], certifications: [] }))
  const first = { ...emptyEducationItem(), institution: 'First College' }
  const second = { ...emptyEducationItem(), institution: 'Second College' }
  form.education = [first, second]
  form.education = moveItemByKey(form.education, first.key, 1)
  assert.deepEqual(
    form.education.map((item) => item.institution),
    ['Second College', 'First College'],
  )
  form.education = form.education.filter((item) => item.key !== second.key)
  assert.equal(form.education.length, 1)
  assert.equal(form.education[0].institution, 'First College')

  const older = { ...emptyExperienceItem(), jobTitle: 'Older role', organization: 'A' }
  const newer = { ...emptyExperienceItem(), jobTitle: 'Newer role', organization: 'B' }
  form.experience = [older, newer]
  form.experience = moveItemByKey(form.experience, newer.key, -1)
  assert.equal(form.experience[0].jobTitle, 'Newer role')
})

test('personal information, years, current role and duplicate ESCO skills are validated', () => {
  const form = resumeToForm(sampleResume())
  form.title = ''
  form.fullName = ''
  form.email = 'not-an-email'
  form.education[0].institution = ''
  form.education[0].endYear = '2020'
  form.experience[0].organization = ''
  form.experience[0].isCurrent = true
  form.experience[0].endDate = '2025-07-01'
  form.skills.push({
    key: 'dup',
    skillId: ESCO_ID,
    label: 'ICT safety copy',
    proficiencyLevel: 'Beginner',
  })
  const errors = validateResumeForm(form)
  assert.equal(hasResumeFormErrors(errors), true)
  assert.equal(errors.title.includes('title'), true)
  assert.equal(errors.fullName.includes('full name'), true)
  assert.equal(errors.email.includes('valid email'), true)
  assert.equal(errors.education[form.education[0].key].institution.includes('institution'), true)
  assert.equal(errors.education[form.education[0].key].endYear.includes('before start year'), true)
  assert.equal(errors.experience[form.experience[0].key].organization.includes('company'), true)
  assert.equal(errors.experience[form.experience[0].key].endDate.includes('currently working'), true)
  assert.equal(errors.skills.dup.skillId.includes('already on the resume'), true)
})

test('valid forms snapshot the same payload until an editor field changes', () => {
  const form = resumeToForm(sampleResume())
  assert.equal(hasResumeFormErrors(validateResumeForm(form)), false)
  const first = resumeFormSnapshot(form)
  form.phone = '012-680 0002'
  assert.notEqual(resumeFormSnapshot(form), first)
})

test('saved ESCO skills are copied as resume snapshots without using the UserSkill row id', () => {
  const copied = skillFromSavedRecord({
    id: 'user-skill-row',
    proficiencyLevel: 'Advanced',
    skill: { id: ESCO_ID, preferredLabel: 'ICT safety' },
  })
  assert.equal(copied.skillId, ESCO_ID)
  assert.equal(copied.label, 'ICT safety')
  assert.equal(copied.proficiencyLevel, 'Advanced')
  assert.notEqual(copied.key, 'user-skill-row')

  const form = resumeToForm(sampleResume())
  assert.equal(hasEscoSkill(form, ESCO_ID), true)
  assert.equal(hasEscoSkill(form, OTHER_ESCO_ID), false)
  assert.equal(canAddSection(form, 'skills'), true)

  const custom = customSkillItem('Public speaking', 'Beginner')
  assert.equal(custom.skillId, '')
  assert.equal(custom.label, 'Public speaking')
  const catalogue = skillFromCatalogue({ id: OTHER_ESCO_ID, preferredLabel: 'Teamwork' })
  assert.equal(catalogue.skillId, OTHER_ESCO_ID)
  assert.equal(catalogue.label, 'Teamwork')
})
