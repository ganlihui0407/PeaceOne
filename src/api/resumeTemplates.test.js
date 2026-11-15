import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildResumeViewModel, pdfFilenameFromTitle } from './resumeViewModel.js'
import {
  DEFAULT_RESUME_TEMPLATE,
  isResumeTemplateKey,
  resolveResumeTemplateKey,
  RESUME_TEMPLATE_KEYS,
  resumeTemplateByKey,
} from './resumeTemplates.js'

function sampleForm(overrides = {}) {
  return {
    title: 'Software internship CV',
    templateKey: 'classic',
    fullName: 'José Müller',
    email: 'jose.muller@peaceone.test',
    phone: '012-680 0001',
    location: 'Kuala Lumpur',
    summary: 'Candidate for a software internship.',
    education: [
      {
        institution: 'TAR UMT',
        qualification: 'Bachelor of Computer Science',
        fieldOfStudy: 'Software Engineering',
        startYear: '2022',
        endYear: '2026',
        notes: 'Dean list.',
      },
    ],
    experience: [
      {
        jobTitle: 'Intern',
        organization: 'PeaceOne Labs',
        location: 'Remote',
        startDate: '2025-06-01',
        endDate: '',
        isCurrent: true,
        description: 'Built candidate pages.',
      },
    ],
    skills: [
      { label: 'ICT safety', proficiencyLevel: 'Intermediate' },
      { label: 'JavaScript', proficiencyLevel: '' },
    ],
    certifications: [
      { name: 'AWS Cloud Practitioner', issuer: 'Amazon', year: '2025', credentialId: 'AWS-1' },
    ],
    ...overrides,
  }
}

test('frontend resume templates match classic, modern and compact keys', () => {
  assert.deepEqual(RESUME_TEMPLATE_KEYS, ['classic', 'modern', 'compact'])
  assert.equal(DEFAULT_RESUME_TEMPLATE, 'classic')
  assert.equal(isResumeTemplateKey('modern'), true)
  assert.equal(isResumeTemplateKey('creative'), false)
  assert.equal(resolveResumeTemplateKey(''), 'classic')
  assert.equal(resumeTemplateByKey('classic').name, 'Classic Professional')
  assert.equal(resumeTemplateByKey('modern').name, 'Modern Professional')
  assert.equal(resumeTemplateByKey('compact').name, 'Compact Professional')
})

test('live preview view model uses unsaved editor state and hides empty sections', () => {
  const view = buildResumeViewModel(sampleForm({ summary: 'Unsaved summary', templateKey: 'modern' }))
  assert.equal(view.templateKey, 'modern')
  assert.equal(view.summary, 'Unsaved summary')
  assert.equal(view.hasContact, true)
  assert.equal(view.hasEducation, true)
  assert.equal(view.hasExperience, true)
  assert.equal(view.experience[0].dates, 'Jun 2025 – Present')
  assert.equal(view.hasSkills, true)
  assert.equal(view.hasCertifications, true)

  const empty = buildResumeViewModel({
    templateKey: 'compact',
    fullName: 'Draft Name',
    education: [],
    experience: [],
    skills: [],
    certifications: [],
  })
  assert.equal(empty.hasSummary, false)
  assert.equal(empty.hasEducation, false)
  assert.equal(empty.hasExperience, false)
  assert.equal(empty.hasSkills, false)
  assert.equal(empty.hasCertifications, false)
})

test('generated PDF filenames stay sanitised on the client helper', () => {
  assert.equal(pdfFilenameFromTitle('../../secret.pdf'), 'secret.pdf')
  assert.equal(pdfFilenameFromTitle('../../etc/passwd'), 'etc passwd.pdf')
  assert.equal(pdfFilenameFromTitle('My Resume: Q1'), 'My Resume Q1.pdf')
})

test('resume editor wires template picker, live preview and PDF download from editor state', () => {
  const editor = readFileSync(fileURLToPath(new URL('../pages/shared/ResumeEditorPage.jsx', import.meta.url)), 'utf8')
  const hook = readFileSync(fileURLToPath(new URL('../hooks/useResumeEditor.js', import.meta.url)), 'utf8')
  const preview = readFileSync(fileURLToPath(new URL('../components/resume/ResumePreview.jsx', import.meta.url)), 'utf8')
  const picker = readFileSync(fileURLToPath(new URL('../components/resume/ResumeTemplatePicker.jsx', import.meta.url)), 'utf8')
  const catalog = readFileSync(fileURLToPath(new URL('./resumeTemplates.js', import.meta.url)), 'utf8')
  const classic = readFileSync(fileURLToPath(new URL('../components/resume/templates/ClassicResume.jsx', import.meta.url)), 'utf8')
  const modern = readFileSync(fileURLToPath(new URL('../components/resume/templates/ModernResume.jsx', import.meta.url)), 'utf8')
  const compact = readFileSync(fileURLToPath(new URL('../components/resume/templates/CompactResume.jsx', import.meta.url)), 'utf8')
  const sections = readFileSync(fileURLToPath(new URL('../components/resume/ResumeSections.jsx', import.meta.url)), 'utf8')

  assert.equal(editor.includes('ResumeTemplatePicker'), true)
  assert.equal(editor.includes('ResumePreview'), true)
  assert.equal(editor.includes('Download PDF'), true)
  assert.equal(editor.includes('persistTemplate'), true)
  assert.equal(editor.includes('downloadPdf'), true)
  assert.equal(editor.includes('form={form}'), true)
  assert.equal(catalog.includes('Classic Professional'), true)
  assert.equal(catalog.includes('Modern Professional'), true)
  assert.equal(catalog.includes('Compact Professional'), true)
  assert.equal(picker.includes('template.name'), true)
  assert.equal(picker.includes('Selected'), true)
  assert.equal(preview.includes('buildResumeViewModel'), true)
  assert.equal(classic.includes('data-resume-template="classic"'), true)
  assert.equal(modern.includes('data-resume-template="modern"'), true)
  assert.equal(compact.includes('data-resume-template="compact"'), true)
  assert.equal(sections.includes('if (!view.hasEducation)'), true)
  assert.equal(sections.includes('if (!view.hasExperience)'), true)
  assert.equal(sections.includes('if (!view.hasSkills)'), true)
  assert.equal(sections.includes('if (!view.hasCertifications)'), true)
  assert.equal(hook.includes('updateResume(resume.id, { templateKey })'), true)
  assert.equal(hook.includes('downloadResumePdf'), true)
  assert.equal(hook.includes('RESUME_PDF_UNSAVED_COPY'), true)
  assert.equal(hook.includes('if (dirty)'), true)
  assert.equal(editor.includes('createSavedSkill'), false)
  assert.equal(editor.includes('saveCareerTarget'), false)
})
