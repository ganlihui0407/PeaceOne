import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';
import { closeSessionStore } from '../src/lib/session.js';
import { RESUME_STORAGE_ENV } from '../src/lib/resumeStorage.js';
import { extractResumeText } from '../src/lib/resumeTextExtraction.js';
import { PDF_CONTENT_TYPE } from '../src/lib/resumeFileValidation.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';
import { textPdf } from './resumeFileFixtures.js';

const TEST_EMAIL_PREFIX = 'stage77-pdf-';
const UNKNOWN_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const createdEmails = [];
const previousStorage = process.env[RESUME_STORAGE_ENV];

let tempRoot;
let server;
let baseUrl;
let baseline;

async function snapshot() {
  const [
    occupations,
    skills,
    relations,
    mascoUnitGroups,
    mascoOccupations,
    mascoCrosswalks,
    userSkills,
    resumes,
    education,
    experience,
    resumeSkills,
    certifications,
    resumeFiles,
  ] = await Promise.all([
    prisma.occupation.count(),
    prisma.skill.count(),
    prisma.occupationSkillRelation.count(),
    prisma.mascoUnitGroup.count(),
    prisma.mascoOccupationRecord.count(),
    prisma.mascoHistoricalCrosswalk.count(),
    prisma.userSkill.count(),
    prisma.resume.count(),
    prisma.resumeEducation.count(),
    prisma.resumeExperience.count(),
    prisma.resumeSkill.count(),
    prisma.resumeCertification.count(),
    prisma.resumeFile.count(),
  ]);
  return {
    occupations,
    skills,
    relations,
    mascoUnitGroups,
    mascoOccupations,
    mascoCrosswalks,
    userSkills,
    resumes,
    education,
    experience,
    resumeSkills,
    certifications,
    resumeFiles,
  };
}

async function registerAs(label, extras = {}) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/register', primed, validRegisterBody(email, extras));
  assert.equal(result.response.status, 201, result.text);
  return { email, ...result };
}

async function loginAs(email) {
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/login', primed, {
    email,
    password: TEST_PASSWORD,
  });
  assert.equal(result.response.status, 200, result.text);
  return result;
}

async function createAdmin() {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'admin');
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage Seven Seven Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  return { email, ...(await loginAs(email)) };
}

function sessionOf(result) {
  return {
    csrfToken: result.json.csrfToken,
    cookies: result.cookies,
  };
}

function createResume(session, body) {
  return postJson(baseUrl, '/api/me/resumes', session, body);
}

function getResume(session, id) {
  return requestJson(baseUrl, `/api/me/resumes/${id}`, { cookies: session.cookies });
}

function putResume(session, id, body) {
  return requestJson(baseUrl, `/api/me/resumes/${id}`, {
    method: 'PUT',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body,
  });
}

async function getPdf(session, id, extraHeaders = {}) {
  const headers = {
    ...extraHeaders,
  };
  if (session?.cookies) {
    headers.Cookie = session.cookies;
  }
  const response = await fetch(`${baseUrl}/api/me/resumes/${id}/pdf`, {
    method: 'GET',
    headers,
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  let json = null;
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try {
      json = JSON.parse(buffer.toString('utf8'));
    } catch {
      json = null;
    }
  }
  return { response, buffer, json, text: buffer.toString('utf8') };
}

async function postFile(session, resumeId, buffer, filename) {
  const form = new FormData();
  form.append('file', new Blob([buffer]), filename);
  const response = await fetch(`${baseUrl}/api/me/resumes/${resumeId}/file`, {
    method: 'POST',
    headers: {
      Cookie: session.cookies,
      'x-csrf-token': session.csrfToken,
    },
    body: form,
  });
  const json = await response.json();
  return { response, json };
}

before(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-resume-pdf-'));
  process.env[RESUME_STORAGE_ENV] = tempRoot;
  baseline = await snapshot();

  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: createdEmails } },
    });
  }

  const finalSnapshot = await snapshot();
  assert.deepEqual(finalSnapshot, baseline);

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);

  if (previousStorage === undefined) {
    delete process.env[RESUME_STORAGE_ENV];
  } else {
    process.env[RESUME_STORAGE_ENV] = previousStorage;
  }
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test('students can persist classic, modern and compact templates without replacing resume sections', async () => {
  const student = await registerAs('templates', {
    currentPosition: 'student',
    fullName: 'Stage Seven Seven Student',
  });
  const session = sessionOf(student);
  const created = await createResume(session, { title: 'Software internship CV', templateKey: 'modern' });
  assert.equal(created.response.status, 201, created.text);
  assert.equal(created.json.resume.templateKey, 'modern');

  const resumeId = created.json.resume.id;
  const saved = await putResume(session, resumeId, {
    education: [{ institution: 'TAR UMT', qualification: 'Bachelor of Computer Science', startYear: 2022, endYear: 2026 }],
    experience: [
      {
        jobTitle: 'Intern',
        organization: 'Harbour Analytics',
        startDate: '2025-06-01',
        isCurrent: true,
        description: 'Assisted with reporting.',
      },
    ],
    skills: [{ label: 'ICT safety', proficiencyLevel: 'Beginner' }],
    certifications: [{ name: 'First Aid', issuer: 'St John', year: 2024 }],
  });
  assert.equal(saved.response.status, 200, saved.text);
  assert.equal(saved.json.resume.templateKey, 'modern');
  assert.equal(saved.json.resume.education[0].institution, 'TAR UMT');

  const switched = await putResume(session, resumeId, { templateKey: 'compact' });
  assert.equal(switched.response.status, 200, switched.text);
  assert.equal(switched.json.resume.templateKey, 'compact');
  assert.equal(switched.json.resume.education.length, 1);
  assert.equal(switched.json.resume.education[0].institution, 'TAR UMT');
  assert.equal(switched.json.resume.experience[0].jobTitle, 'Intern');
  assert.equal(switched.json.resume.skills[0].label, 'ICT safety');
  assert.equal(switched.json.resume.certifications[0].name, 'First Aid');

  const classic = await putResume(session, resumeId, { templateKey: 'classic' });
  assert.equal(classic.json.resume.templateKey, 'classic');
  assert.equal(classic.json.resume.experience.length, 1);

  const invalid = await putResume(session, resumeId, { templateKey: 'creative' });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.json.error, 'Invalid request');

  const afterInvalid = await getResume(session, resumeId);
  assert.equal(afterInvalid.json.resume.templateKey, 'classic');
  assert.equal(afterInvalid.json.resume.education[0].institution, 'TAR UMT');
});

test('authenticated candidates download a generated PDF from structured resume data', async () => {
  const student = await registerAs('download', {
    currentPosition: 'student',
    fullName: 'José Müller',
  });
  const session = sessionOf(student);
  const created = await createResume(session, {
    title: 'Software internship CV',
    templateKey: 'modern',
    summary: 'Candidate for a software internship.',
  });
  const resumeId = created.json.resume.id;
  const saved = await putResume(session, resumeId, {
    fullName: 'José Müller',
    location: 'Kuala Lumpur',
    education: [{ institution: 'TAR UMT', qualification: 'Bachelor of Computer Science' }],
    experience: [
      {
        jobTitle: 'Intern',
        organization: 'PeaceOne Labs',
        startDate: '2025-06-01',
        isCurrent: true,
        description: 'Built candidate pages.',
      },
    ],
    skills: [{ label: 'JavaScript', proficiencyLevel: 'Intermediate' }],
    certifications: [{ name: 'AWS Cloud Practitioner', year: 2025 }],
  });
  assert.equal(saved.response.status, 200, saved.text);
  const updatedAt = saved.json.resume.updatedAt;

  const uploaded = await postFile(session, resumeId, textPdf('ORIGINAL_UPLOAD_MARKER'), 'Original_CV.pdf');
  assert.ok(uploaded.response.status === 200 || uploaded.response.status === 201, JSON.stringify(uploaded.json));

  const pdf = await getPdf(session, resumeId);
  assert.equal(pdf.response.status, 200, pdf.text.slice(0, 300));
  assert.equal(pdf.response.headers.get('content-type'), 'application/pdf');
  assert.match(pdf.response.headers.get('content-disposition') || '', /Software internship CV\.pdf/);
  assert.equal(pdf.buffer.subarray(0, 4).toString('latin1'), '%PDF');
  assert.equal(pdf.text.includes(tempRoot), false);
  assert.equal(pdf.text.includes('storedFilename'), false);
  assertNoSecrets(pdf.json ?? {});

  const extracted = await extractResumeText(pdf.buffer, PDF_CONTENT_TYPE);
  assert.equal(extracted.readable, true);
  assert.match(extracted.text, /José Müller/);
  assert.match(extracted.text, /TAR UMT/);
  assert.match(extracted.text, /JavaScript/);
  assert.equal(extracted.text.includes('ORIGINAL_UPLOAD_MARKER'), false);

  const afterPdf = await getResume(session, resumeId);
  assert.equal(afterPdf.json.resume.updatedAt, updatedAt);
  assert.equal(afterPdf.json.resume.templateKey, 'modern');
  assert.equal(afterPdf.json.resume.file.originalFilename, 'Original_CV.pdf');
});

test('PDF download rejects unauthenticated, wrong-role, missing and cross-user access', async () => {
  const student = await registerAs('owner', { currentPosition: 'student', fullName: 'Owner Candidate' });
  const other = await registerAs('other', { currentPosition: 'jobseeker', fullName: 'Other Candidate' });
  const staff = await registerAs('staff', { role: 'employer', currentPosition: undefined });
  const admin = await createAdmin();
  const ownerSession = sessionOf(student);
  const created = await createResume(ownerSession, { title: 'Owned CV' });
  const resumeId = created.json.resume.id;

  const anonymous = await getPdf({ cookies: '' }, resumeId);
  assert.equal(anonymous.response.status, 401);
  assert.equal(anonymous.json.error, 'Unauthenticated');

  const staffPdf = await getPdf(sessionOf(staff), resumeId);
  assert.equal(staffPdf.response.status, 403);
  assert.equal(staffPdf.json.error, 'Forbidden');

  const adminPdf = await getPdf(sessionOf(admin), resumeId);
  assert.equal(adminPdf.response.status, 403);

  const foreign = await getPdf(sessionOf(other), resumeId);
  assert.equal(foreign.response.status, 404);
  assert.equal(foreign.json.error, 'Not found');
  assert.equal(foreign.buffer.subarray(0, 4).toString('latin1') === '%PDF', false);

  const missing = await getPdf(ownerSession, UNKNOWN_ID);
  assert.equal(missing.response.status, 404);
  assert.equal(missing.json.error, 'Not found');

  const invalidId = await getPdf(ownerSession, 'not-a-uuid');
  assert.equal(invalidId.response.status, 400);
  assert.equal(invalidId.json.error, 'Invalid request');
  assertNoSecrets(invalidId.json);

  const jobSeeker = await registerAs('seeker', { currentPosition: 'jobseeker', fullName: 'Seeker Candidate' });
  const seekerResume = await createResume(sessionOf(jobSeeker), { title: 'Seeker CV', templateKey: 'compact' });
  const seekerPdf = await getPdf(sessionOf(jobSeeker), seekerResume.json.resume.id);
  assert.equal(seekerPdf.response.status, 200);
  assert.equal(seekerPdf.response.headers.get('content-type'), 'application/pdf');
});
