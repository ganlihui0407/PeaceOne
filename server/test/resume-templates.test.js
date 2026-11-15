import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  generateResumePdf,
  RESUME_FONT_BOLD,
  RESUME_FONT_JP_REGULAR,
  RESUME_FONT_KR_REGULAR,
  RESUME_FONT_REGULAR,
  RESUME_FONT_SC_BOLD,
  RESUME_FONT_SC_REGULAR,
} from '../src/lib/resumePdf.js';
import {
  DEFAULT_RESUME_TEMPLATE,
  isResumeTemplateKey,
  resolveResumeTemplateKey,
  RESUME_TEMPLATE_KEYS,
  resumeTemplateByKey,
} from '../src/lib/resumeTemplates.js';
import { PDF_CONTENT_TYPE } from '../src/lib/resumeFileValidation.js';
import { extractResumeText } from '../src/lib/resumeTextExtraction.js';
import { buildResumeViewModel, pdfFilenameFromTitle } from '../src/lib/resumeViewModel.js';

function sampleResume(overrides = {}) {
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
        startYear: 2022,
        endYear: 2026,
        notes: 'Dean list.',
      },
    ],
    experience: [
      {
        jobTitle: 'Intern',
        organization: 'PeaceOne Labs',
        location: 'Remote',
        startDate: '2025-06-01',
        endDate: null,
        isCurrent: true,
        description: 'Built candidate pages.',
      },
    ],
    skills: [
      { label: 'ICT safety', proficiencyLevel: 'Intermediate' },
      { label: 'JavaScript' },
    ],
    certifications: [
      {
        name: 'AWS Cloud Practitioner',
        issuer: 'Amazon',
        year: 2025,
        credentialId: 'AWS-1',
      },
    ],
    ...overrides,
  };
}

async function inspectPdf(buffer) {
  const extracted = await extractResumeText(buffer, PDF_CONTENT_TYPE);
  const loadingTask = getDocument({
    data: Uint8Array.from(buffer),
    disableRange: true,
    disableStream: true,
    disableAutoFetch: true,
    disableFontFace: true,
    useSystemFonts: false,
    useWasm: false,
    useWorkerFetch: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    enableXfa: false,
    stopAtErrors: true,
    verbosity: VerbosityLevel.ERRORS,
  });
  try {
    const pdf = await loadingTask.promise;
    const metadata = await pdf.getMetadata();
    const pageCount = pdf.numPages;
    await pdf.cleanup();
    return {
      pageCount,
      info: metadata.info || {},
      text: extracted.text,
      readable: extracted.readable,
    };
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      // Loading-task cleanup is best-effort.
    }
  }
}

test('resume templates include classic, modern and compact with ATS-friendly names', () => {
  assert.deepEqual([...RESUME_TEMPLATE_KEYS], ['classic', 'modern', 'compact']);
  assert.equal(DEFAULT_RESUME_TEMPLATE, 'classic');
  assert.equal(isResumeTemplateKey('classic'), true);
  assert.equal(isResumeTemplateKey('modern'), true);
  assert.equal(isResumeTemplateKey('compact'), true);
  assert.equal(isResumeTemplateKey('creative'), false);
  assert.equal(isResumeTemplateKey(''), false);
  assert.equal(resolveResumeTemplateKey('unknown'), 'classic');
  assert.equal(resumeTemplateByKey('classic').name, 'Classic Professional');
  assert.equal(resumeTemplateByKey('modern').name, 'Modern Professional');
  assert.equal(resumeTemplateByKey('compact').name, 'Compact Professional');
});

test('view model populates contact, sections and hides empty entries', () => {
  const view = buildResumeViewModel(sampleResume());
  assert.equal(view.templateKey, 'classic');
  assert.equal(view.fullName, 'José Müller');
  assert.equal(view.hasContact, true);
  assert.match(view.contactLine, /jose\.muller@peaceone\.test/);
  assert.match(view.contactLine, /Kuala Lumpur/);
  assert.equal(view.hasSummary, true);
  assert.equal(view.hasEducation, true);
  assert.equal(view.education[0].institution, 'TAR UMT');
  assert.equal(view.education[0].years, '2022 – 2026');
  assert.equal(view.hasExperience, true);
  assert.equal(view.experience[0].dates, 'Jun 2025 – Present');
  assert.equal(view.hasSkills, true);
  assert.equal(view.skills[0].display, 'ICT safety (Intermediate)');
  assert.equal(view.skills[1].display, 'JavaScript');
  assert.equal(view.hasCertifications, true);
  assert.match(view.certifications[0].display, /AWS Cloud Practitioner/);

  const empty = buildResumeViewModel({
    templateKey: 'modern',
    fullName: 'Amina Rahman',
    education: [{ institution: '   ', notes: '' }],
    experience: [{ jobTitle: '', organization: '', description: '' }],
    skills: [{ label: '  ' }],
    certifications: [{ name: '', issuer: '' }],
  });
  assert.equal(empty.templateKey, 'modern');
  assert.equal(empty.hasContact, false);
  assert.equal(empty.hasSummary, false);
  assert.equal(empty.hasEducation, false);
  assert.equal(empty.hasExperience, false);
  assert.equal(empty.hasSkills, false);
  assert.equal(empty.hasCertifications, false);
});

test('unsaved editor-shaped changes appear in the view model immediately', () => {
  const view = buildResumeViewModel({
    templateKey: 'compact',
    fullName: 'Draft Name',
    email: 'draft@peaceone.test',
    summary: 'Unsaved summary',
    education: [{ institution: 'Unsaved College', startYear: '2024', endYear: '2025' }],
  });
  assert.equal(view.templateKey, 'compact');
  assert.equal(view.fullName, 'Draft Name');
  assert.equal(view.summary, 'Unsaved summary');
  assert.equal(view.education[0].institution, 'Unsaved College');
});

test('PDF filenames are sanitised from the resume title', () => {
  assert.equal(pdfFilenameFromTitle('Software internship CV'), 'Software internship CV.pdf');
  assert.equal(pdfFilenameFromTitle('../../etc/passwd'), 'etc passwd.pdf');
  assert.equal(pdfFilenameFromTitle('My Resume: 2026/Q1'), 'My Resume 2026 Q1.pdf');
  assert.equal(pdfFilenameFromTitle('already.pdf'), 'already.pdf');
  assert.equal(pdfFilenameFromTitle('   '), 'resume.pdf');
});

test('embedded Noto Sans and Noto CJK fonts are present for PDF output', () => {
  assert.equal(fs.existsSync(RESUME_FONT_REGULAR), true);
  assert.equal(fs.existsSync(RESUME_FONT_BOLD), true);
  assert.equal(fs.existsSync(RESUME_FONT_SC_REGULAR), true);
  assert.equal(fs.existsSync(RESUME_FONT_SC_BOLD), true);
  assert.equal(fs.existsSync(RESUME_FONT_JP_REGULAR), true);
  assert.equal(fs.existsSync(RESUME_FONT_KR_REGULAR), true);
});

test('generated PDFs embed Chinese, Japanese and Korean characters from bundled CJK fonts', async () => {
  const pdf = await generateResumePdf(
    sampleResume({
      fullName: '李慧 Müller',
      summary: '熟悉 JavaScript。日本語テスト 한글',
    }),
  );
  const inspected = await inspectPdf(pdf);
  assert.equal(inspected.readable, true);
  assert.match(inspected.text, /李慧/);
  assert.match(inspected.text, /Müller/);
  assert.match(inspected.text, /日本語テスト/);
  assert.match(inspected.text, /한글/);
  assert.equal(inspected.text.includes('\u0000'), false);
});

test('classic, modern and compact PDFs contain structured resume text and selected template metadata', async () => {
  for (const templateKey of RESUME_TEMPLATE_KEYS) {
    const pdf = await generateResumePdf(sampleResume({ templateKey }));
    assert.equal(Buffer.isBuffer(pdf), true);
    assert.equal(pdf.subarray(0, 4).toString('latin1'), '%PDF');
    const inspected = await inspectPdf(pdf);
    assert.equal(inspected.readable, true);
    assert.match(inspected.info.Keywords || inspected.info.keywords || '', new RegExp(templateKey, 'i'));
    assert.match(inspected.info.Subject || inspected.info.subject || '', /Professional/);
    assert.match(inspected.text, /José Müller/);
    assert.match(inspected.text, /jose\.muller@peaceone\.test/);
    assert.match(inspected.text, /TAR UMT/);
    assert.match(inspected.text, /Intern/);
    assert.match(inspected.text, /PeaceOne Labs/);
    assert.match(inspected.text, /ICT safety/);
    assert.match(inspected.text, /JavaScript/);
    assert.match(inspected.text, /AWS Cloud Practitioner/);
    assert.match(inspected.text, /Professional summary/i);
    assert.match(inspected.text, /Education/i);
    assert.match(inspected.text, /Work experience/i);
    assert.equal(inspected.text.includes('Software internship CV'), false);
  }
});

test('generated PDFs omit empty sections, wrap long descriptions across pages and keep Unicode text', async () => {
  const emptyPdf = await generateResumePdf({
    title: 'Empty CV',
    templateKey: 'classic',
    fullName: 'Amina Rahman',
    education: [],
    experience: [],
    skills: [],
    certifications: [],
  });
  const emptyInspected = await inspectPdf(emptyPdf);
  assert.match(emptyInspected.text, /Amina Rahman/);
  assert.equal(/professional summary/i.test(emptyInspected.text), false);
  assert.equal(/education/i.test(emptyInspected.text), false);
  assert.equal(/work experience/i.test(emptyInspected.text), false);
  assert.equal(/certifications/i.test(emptyInspected.text), false);

  const longDescription = 'Designed reporting dashboards for operations teams. '.repeat(70);
  const longPdf = await generateResumePdf(
    sampleResume({
      templateKey: 'compact',
      experience: Array.from({ length: 8 }, (_, index) => ({
        jobTitle: `Analyst ${index + 1}`,
        organization: `Harbour Analytics ${index + 1}`,
        location: 'Petaling Jaya',
        startDate: '2020-01-01',
        endDate: '2021-12-31',
        isCurrent: false,
        description: longDescription,
      })),
    }),
  );
  const longInspected = await inspectPdf(longPdf);
  assert.ok(longInspected.pageCount >= 2, `expected multiple pages, received ${longInspected.pageCount}`);
  assert.match(longInspected.text, /Analyst 1/);
  assert.match(longInspected.text, /Analyst 8/);
  assert.match(longInspected.text, /Designed reporting dashboards/);
  assert.match(longInspected.text, /1 \/ /);
});
