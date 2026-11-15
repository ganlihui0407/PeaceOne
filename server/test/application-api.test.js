import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import {
  APPLICATION_ALREADY_EXISTS,
  APPLICATION_CANNOT_BE_WITHDRAWN,
  APPLICATION_STORAGE_ENV,
} from '../src/lib/applicationQuery.js';
import {
  APPLICATION_TEMP_SEGMENT,
  GENERATED_PDF_STORED_FILENAME,
  applicationDir,
  applicationStorageExists,
  sha256Hex,
} from '../src/lib/applicationStorage.js';
import { hashPassword } from '../src/lib/password.js';
import { RESUME_STORAGE_ENV, resumeFilePath } from '../src/lib/resumeStorage.js';
import { PDF_CONTENT_TYPE } from '../src/lib/resumeFileValidation.js';
import { extractResumeText } from '../src/lib/resumeTextExtraction.js';
import { closeSessionStore } from '../src/lib/session.js';
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

const TEST_EMAIL_PREFIX = 'stage91-app-';
const ICT_SAFETY_URI = 'http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2';
const UNKNOWN_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const LEFTOVER_EMAILS = [
  'ganlh-am23@student.tarc.edu.my',
  'stage55.student.20261028@peaceone.test',
  'stage73.editor.1794538758951@peaceone.test',
  'stage73.editor.1794538770393@peaceone.test',
];
const LEFTOVER_RESUME_ID = '5c5fde3f-51f8-4334-a4d5-73de30e45a02';

const createdEmails = [];
const createdCompanyIds = [];
const createdJobIds = [];
const createdApplicationIds = [];
const previousResumeStorage = process.env[RESUME_STORAGE_ENV];
const previousApplicationStorage = process.env[APPLICATION_STORAGE_ENV];

let resumeTempRoot;
let applicationTempRoot;
let server;
let baseUrl;
let baseline;
let leftoverUsers;
let leftoverResume;
let ictSafety;

async function snapshot() {
  const [
    users,
    companies,
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
    jobs,
    jobSkills,
    jobStatusEvents,
    applications,
    applicationSnapshots,
    applicationStatusEvents,
    interviews,
    interviewEvents,
    notifications,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.company.count(),
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
    prisma.job.count(),
    prisma.jobSkill.count(),
    prisma.jobStatusEvent.count(),
    prisma.application.count(),
    prisma.applicationResumeSnapshot.count(),
    prisma.applicationStatusEvent.count(),
    prisma.interview.count(),
    prisma.interviewEvent.count(),
    prisma.notification.count(),
  ]);
  return {
    users,
    companies,
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
    jobs,
    jobSkills,
    jobStatusEvents,
    applications,
    applicationSnapshots,
    applicationStatusEvents,
    interviews,
    interviewEvents,
    notifications,
  };
}

async function loadLeftoverUsers() {
  return prisma.user.findMany({
    where: { email: { in: LEFTOVER_EMAILS } },
    select: { id: true, email: true, role: true, fullName: true, companyId: true },
    orderBy: { email: 'asc' },
  });
}

async function loadLeftoverResume() {
  return prisma.resume.findUnique({
    where: { id: LEFTOVER_RESUME_ID },
    select: {
      id: true,
      title: true,
      userId: true,
      _count: {
        select: {
          education: true,
          experience: true,
          skills: true,
          certifications: true,
        },
      },
    },
  });
}

function sessionOf(result) {
  return {
    csrfToken: result.json.csrfToken,
    cookies: result.cookies,
  };
}

function trackJob(result) {
  const id = result.json?.job?.id;
  if (id && !createdJobIds.includes(id)) {
    createdJobIds.push(id);
  }
  return result;
}

function trackApplication(result) {
  const id = result.json?.application?.id;
  if (id && !createdApplicationIds.includes(id)) {
    createdApplicationIds.push(id);
  }
  return result;
}

function assertNoStorageLeak(payload) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (!serialized) {
    return;
  }
  assert.equal(serialized.includes(applicationTempRoot), false);
  assert.equal(serialized.includes(resumeTempRoot), false);
  assert.equal(serialized.includes('application-storage'), false);
  assert.equal(serialized.includes('resume-storage'), false);
  assert.equal(serialized.includes('structuredSnapshot'), false);
  assert.equal(serialized.includes('originalFileStoredFilename'), false);
  assert.equal(serialized.includes('storedFilename'), false);
  assertNoSecrets(payload);
}

async function listStagingIds() {
  try {
    return await fs.readdir(path.join(applicationTempRoot, APPLICATION_TEMP_SEGMENT));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function registerStaff(label) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(
    baseUrl,
    '/api/auth/register',
    primed,
    validRegisterBody(email, { role: 'employer', currentPosition: undefined }),
  );
  assert.equal(result.response.status, 201, result.text);
  return { email, ...result };
}

async function registerStudent(label, extras = {}) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(
    baseUrl,
    '/api/auth/register',
    primed,
    validRegisterBody(email, extras),
  );
  assert.equal(result.response.status, 201, result.text);
  return { email, ...result };
}

async function registerJobSeeker(label) {
  return registerStudent(label, { currentPosition: 'jobseeker' });
}

async function createAdmin(label = 'admin') {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage Nine Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/login', primed, {
    email,
    password: TEST_PASSWORD,
  });
  assert.equal(result.response.status, 200, result.text);
  return { email, ...result };
}

async function putCompany(session, extras = {}) {
  const result = await requestJson(baseUrl, '/api/me/company', {
    method: 'PUT',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body: {
      companyName: extras.companyName || 'Northwind Analytics',
      registrationNumber: extras.registrationNumber || '1234567-A',
      industry: extras.industry || 'Technology',
      companySize: '11-50',
      website: 'www.northwind.example',
      email: extras.email || 'hello@northwind.example',
      phone: '03-555 0100',
      location: extras.location || 'Petaling Jaya',
      address: '1 Jalan Utara',
      description: 'A reporting studio for Malaysian teams.',
    },
  });
  assert.equal(result.response.status === 200 || result.response.status === 201, true, result.text);
  if (result.json?.company?.id && !createdCompanyIds.includes(result.json.company.id)) {
    createdCompanyIds.push(result.json.company.id);
  }
  return result;
}

function validJob(overrides = {}) {
  return {
    title: 'Junior Software Developer',
    description: 'Build and maintain internal web features used by reporting teams.',
    qualificationRequired: "Diploma or Bachelor's Degree in Computer Science",
    experienceRequired: '0-1 years',
    employmentType: 'FULL_TIME',
    location: 'Kuala Lumpur',
    salaryMin: 3800,
    salaryMax: 5200,
    closesAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    requiredSkills: [
      { skillId: ictSafety.id, requiredLevel: 'Intermediate' },
    ],
    ...overrides,
  };
}

function createJob(session, body) {
  return requestJson(baseUrl, '/api/me/jobs', {
    method: 'POST',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body,
  }).then(trackJob);
}

function submitJob(session, id, body = {}) {
  return postJson(baseUrl, `/api/me/jobs/${id}/submit`, session, body);
}

function closeMeJob(session, id, body = {}) {
  return postJson(baseUrl, `/api/me/jobs/${id}/close`, session, body);
}

function suspendJob(session, id, body) {
  return postJson(baseUrl, `/api/admin/jobs/${id}/suspend`, session, body);
}

function createResume(session, body) {
  return postJson(baseUrl, '/api/me/resumes', session, body);
}

function putResume(session, id, body) {
  return requestJson(baseUrl, `/api/me/resumes/${id}`, {
    method: 'PUT',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body,
  });
}

function deleteResume(session, id) {
  return requestJson(baseUrl, `/api/me/resumes/${id}`, {
    method: 'DELETE',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
  });
}

async function postResumeFile(session, resumeId, buffer, filename) {
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

async function seedPublishedJob(label, extras = {}) {
  const staff = await registerStaff(`${label}-staff`);
  const staffSession = sessionOf(staff);
  await putCompany(staffSession, extras.company);
  const created = await createJob(staffSession, validJob(extras.job));
  assert.equal(created.response.status, 201, created.text);
  const submitted = await submitJob(staffSession, created.json.job.id);
  assert.equal(submitted.response.status, 200, submitted.text);
  assert.equal(submitted.json.job.status, 'PUBLISHED');
  return { staff, staffSession, job: submitted.json.job };
}

async function seedCandidateResume(label, extras = {}) {
  const candidate = extras.seeker
    ? await registerJobSeeker(label)
    : await registerStudent(label, { fullName: extras.fullName || 'José Müller' });
  const session = sessionOf(candidate);
  const created = await createResume(session, {
    title: extras.title || 'Software internship CV',
    templateKey: extras.templateKey || 'modern',
    summary: 'Candidate for a software internship.',
  });
  assert.equal(created.response.status, 201, created.text);
  const resumeId = created.json.resume.id;
  const saved = await putResume(session, resumeId, {
    fullName: extras.fullName || 'José Müller',
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
  if (extras.fileBuffer) {
    const uploaded = await postResumeFile(
      session,
      resumeId,
      extras.fileBuffer,
      extras.filename || 'Original_CV.pdf',
    );
    assert.ok(uploaded.response.status === 200 || uploaded.response.status === 201, JSON.stringify(uploaded.json));
  }
  return { candidate, session, resume: saved.json.resume };
}

function apply(session, jobId, body) {
  return postJson(baseUrl, `/api/jobs/${jobId}/applications`, session, body).then(trackApplication);
}

function listMine(session, query = '') {
  return requestJson(baseUrl, `/api/me/applications${query}`, { cookies: session.cookies });
}

function getMine(session, id) {
  return requestJson(baseUrl, `/api/me/applications/${id}`, { cookies: session.cookies });
}

function withdrawMine(session, id, body = {}) {
  return postJson(baseUrl, `/api/me/applications/${id}/withdraw`, session, body);
}

function listEmployer(session, query = '') {
  return requestJson(baseUrl, `/api/employer/applications${query}`, { cookies: session.cookies });
}

function getEmployer(session, id) {
  return requestJson(baseUrl, `/api/employer/applications/${id}`, { cookies: session.cookies });
}

async function download(session, urlPath) {
  const headers = {};
  if (session?.cookies) {
    headers.Cookie = session.cookies;
  }
  const response = await fetch(`${baseUrl}${urlPath}`, { method: 'GET', headers });
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

before(async () => {
  resumeTempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-app-resume-'));
  applicationTempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-app-storage-'));
  process.env[RESUME_STORAGE_ENV] = resumeTempRoot;
  process.env[APPLICATION_STORAGE_ENV] = applicationTempRoot;

  leftoverUsers = await loadLeftoverUsers();
  leftoverResume = await loadLeftoverResume();
  ictSafety = await prisma.skill.findFirst({
    where: { sourceUri: ICT_SAFETY_URI, sourceSystem: 'ESCO' },
    select: { id: true, sourceUri: true, preferredLabel: true, skillType: true, sourceSystem: true },
  });
  assert.ok(ictSafety, 'expected imported ICT safety skill');
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
  const users = createdEmails.length
    ? await prisma.user.findMany({
      where: { email: { in: createdEmails } },
      select: { id: true, companyId: true },
    })
    : [];
  const userIds = users.map((user) => user.id);
  const companyIds = [...new Set([
    ...createdCompanyIds,
    ...users.map((user) => user.companyId).filter(Boolean),
  ])];

  if (userIds.length > 0) {
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { recipientUserId: { in: userIds } },
          { actorUserId: { in: userIds } },
        ],
      },
    });
  }
  if (userIds.length > 0 || createdJobIds.length > 0 || companyIds.length > 0) {
    await prisma.interview.deleteMany({
      where: {
        OR: [
          userIds.length > 0 ? { candidateUserId: { in: userIds } } : undefined,
          userIds.length > 0 ? { createdByUserId: { in: userIds } } : undefined,
          createdJobIds.length > 0 ? { jobId: { in: createdJobIds } } : undefined,
          companyIds.length > 0 ? { companyId: { in: companyIds } } : undefined,
        ].filter(Boolean),
      },
    });
  }
  if (createdApplicationIds.length > 0 || userIds.length > 0 || createdJobIds.length > 0) {
    await prisma.application.deleteMany({
      where: {
        OR: [
          createdApplicationIds.length > 0 ? { id: { in: createdApplicationIds } } : undefined,
          userIds.length > 0 ? { applicantUserId: { in: userIds } } : undefined,
          createdJobIds.length > 0 ? { jobId: { in: createdJobIds } } : undefined,
        ].filter(Boolean),
      },
    });
  }
  if (createdJobIds.length > 0 || companyIds.length > 0 || userIds.length > 0) {
    await prisma.job.deleteMany({
      where: {
        OR: [
          createdJobIds.length > 0 ? { id: { in: createdJobIds } } : undefined,
          companyIds.length > 0 ? { companyId: { in: companyIds } } : undefined,
          userIds.length > 0 ? { createdByUserId: { in: userIds } } : undefined,
        ].filter(Boolean),
      },
    });
  }
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  }
  if (companyIds.length > 0) {
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }

  const finalSnapshot = await snapshot();
  assert.deepEqual(finalSnapshot, baseline);
  assert.deepEqual(await loadLeftoverUsers(), leftoverUsers);
  assert.deepEqual(await loadLeftoverResume(), leftoverResume);

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);

  if (previousResumeStorage === undefined) {
    delete process.env[RESUME_STORAGE_ENV];
  } else {
    process.env[RESUME_STORAGE_ENV] = previousResumeStorage;
  }
  if (previousApplicationStorage === undefined) {
    delete process.env[APPLICATION_STORAGE_ENV];
  } else {
    process.env[APPLICATION_STORAGE_ENV] = previousApplicationStorage;
  }
  await fs.rm(resumeTempRoot, { recursive: true, force: true });
  await fs.rm(applicationTempRoot, { recursive: true, force: true });
});

test('unique job and applicant constraint prevents duplicate application rows', async () => {
  const { job } = await seedPublishedJob('unique');
  const { candidate } = await seedCandidateResume('unique-student');
  const user = await prisma.user.findUnique({ where: { email: candidate.email }, select: { id: true } });
  const first = await prisma.application.create({
    data: {
      jobId: job.id,
      applicantUserId: user.id,
      status: 'SUBMITTED',
    },
  });
  createdApplicationIds.push(first.id);
  await assert.rejects(
    () => prisma.application.create({
      data: {
        jobId: job.id,
        applicantUserId: user.id,
        status: 'WITHDRAWN',
      },
    }),
    (error) => error?.code === 'P2002',
  );
});

test('students submit with a saved resume and receive an immutable snapshot', async () => {
  const { job } = await seedPublishedJob('submit');
  const original = textPdf('ORIGINAL_UPLOAD_MARKER');
  const { session, resume } = await seedCandidateResume('submit-student', { fileBuffer: original });

  const missingResume = await apply(session, job.id, {});
  assert.equal(missingResume.response.status, 400);

  const extraFields = await apply(session, job.id, {
    resumeId: resume.id,
    applicantUserId: UNKNOWN_ID,
    status: 'OFFERED',
    companyId: UNKNOWN_ID,
  });
  assert.equal(extraFields.response.status, 400);

  const foreignResume = await seedCandidateResume('foreign-resume');
  const stolen = await apply(session, job.id, { resumeId: foreignResume.resume.id });
  assert.equal(stolen.response.status, 404);

  const unknownResume = await apply(session, job.id, { resumeId: UNKNOWN_ID });
  assert.equal(unknownResume.response.status, 404);

  const created = await apply(session, job.id, { resumeId: resume.id });
  assert.equal(created.response.status, 201, created.text);
  const application = created.json.application;
  assert.equal(application.status, 'SUBMITTED');
  assert.equal(application.jobId, job.id);
  assert.equal(application.selectedResumeId, resume.id);
  assert.equal(application.applicant, undefined);
  assert.equal(application.snapshot.resumeTitle, 'Software internship CV');
  assert.equal(application.snapshot.templateKey, 'modern');
  assert.equal(application.snapshot.hasOriginalFile, true);
  assert.equal(application.statusEvents[0].fromStatus, null);
  assert.equal(application.statusEvents[0].toStatus, 'SUBMITTED');
  assertNoStorageLeak(created.json);
  assert.equal(created.text.includes(applicationDir(application.id)), false);

  assert.equal(await applicationStorageExists(application.id), true);
  const storedPdf = await fs.readFile(path.join(applicationDir(application.id), GENERATED_PDF_STORED_FILENAME));
  assert.equal(storedPdf.subarray(0, 4).toString('latin1'), '%PDF');
  assert.equal(sha256Hex(storedPdf), application.snapshot.generatedPdfSha256);
  const storedOriginal = await fs.readFile(path.join(applicationDir(application.id), 'original-resume.pdf'));
  assert.equal(storedOriginal.equals(original), true);
  assert.equal(sha256Hex(storedOriginal), application.snapshot.originalFileSha256);

  const pdf = await download(session, `/api/me/applications/${application.id}/resume.pdf`);
  assert.equal(pdf.response.status, 200, pdf.text.slice(0, 300));
  assert.equal(pdf.response.headers.get('content-type'), 'application/pdf');
  assert.equal(pdf.buffer.subarray(0, 4).toString('latin1'), '%PDF');
  assert.equal(pdf.text.includes(applicationTempRoot), false);
  const extracted = await extractResumeText(pdf.buffer, PDF_CONTENT_TYPE);
  assert.equal(extracted.readable, true);
  assert.match(extracted.text, /José Müller/);
  assert.equal(extracted.text.includes('ORIGINAL_UPLOAD_MARKER'), false);

  const duplicate = await apply(session, job.id, { resumeId: resume.id });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.json.error, APPLICATION_ALREADY_EXISTS);

  const renamed = await putResume(session, resume.id, {
    fullName: 'Edited After Apply',
    education: [{ institution: 'Edited College', qualification: 'Diploma' }],
  });
  assert.equal(renamed.response.status, 200);
  const replaced = await postResumeFile(session, resume.id, textPdf('REPLACED_UPLOAD'), 'Replacement.pdf');
  assert.ok(replaced.response.status === 200 || replaced.response.status === 201);

  const afterEdit = await getMine(session, application.id);
  assert.equal(afterEdit.json.application.snapshot.resumeTitle, 'Software internship CV');
  const afterEditOriginal = await fs.readFile(path.join(applicationDir(application.id), 'original-resume.pdf'));
  assert.equal(afterEditOriginal.equals(original), true);
  const afterEditPdf = await download(session, `/api/me/applications/${application.id}/resume.pdf`);
  const afterEditText = await extractResumeText(afterEditPdf.buffer, PDF_CONTENT_TYPE);
  assert.match(afterEditText.text, /José Müller/);
  assert.equal(afterEditText.text.includes('Edited After Apply'), false);

  const deleted = await deleteResume(session, resume.id);
  assert.equal(deleted.response.status, 200);
  const afterDelete = await getMine(session, application.id);
  assert.equal(afterDelete.response.status, 200);
  assert.equal(afterDelete.json.application.selectedResumeId, null);
  assert.equal(afterDelete.json.application.snapshot.resumeTitle, 'Software internship CV');
  assert.equal(await applicationStorageExists(application.id), true);
});

test('concurrent duplicate submissions keep a single application', async () => {
  const { job } = await seedPublishedJob('concurrent');
  const { session, resume } = await seedCandidateResume('concurrent-student');
  const [first, second] = await Promise.all([
    apply(session, job.id, { resumeId: resume.id }),
    apply(session, job.id, { resumeId: resume.id }),
  ]);
  const statuses = [first.response.status, second.response.status].sort();
  assert.deepEqual(statuses, [201, 409]);
  const winner = first.response.status === 201 ? first : second;
  const loser = first.response.status === 409 ? first : second;
  assert.equal(loser.json.error, APPLICATION_ALREADY_EXISTS);
  const listed = await listMine(session, `?jobId=${job.id}`);
  assert.equal(listed.json.total, 1);
  assert.equal(listed.json.applications[0].id, winner.json.application.id);
  assert.deepEqual(await listStagingIds(), []);
});

test('draft, closed, suspended and expired jobs cannot be applied to', async () => {
  const staff = await registerStaff('blocked-staff');
  const staffSession = sessionOf(staff);
  await putCompany(staffSession);
  const draft = await createJob(staffSession, validJob({ title: 'Draft Analyst' }));
  const { session, resume } = await seedCandidateResume('blocked-student');
  const draftApply = await apply(session, draft.json.job.id, { resumeId: resume.id });
  assert.equal(draftApply.response.status, 404);

  const published = await createJob(staffSession, validJob({ title: 'Closeable Analyst' }));
  const submitted = await submitJob(staffSession, published.json.job.id);
  assert.equal(submitted.json.job.status, 'PUBLISHED');
  const closed = await closeMeJob(staffSession, published.json.job.id);
  assert.equal(closed.json.job.status, 'CLOSED');
  const closedApply = await apply(session, published.json.job.id, { resumeId: resume.id });
  assert.equal(closedApply.response.status, 404);

  const suspendable = await createJob(staffSession, validJob({ title: 'Suspendable Analyst' }));
  await submitJob(staffSession, suspendable.json.job.id);
  const admin = await createAdmin('blocked-admin');
  const suspended = await suspendJob(sessionOf(admin), suspendable.json.job.id, { reason: 'Policy review' });
  assert.equal(suspended.json.job.status, 'SUSPENDED');
  const suspendedApply = await apply(session, suspendable.json.job.id, { resumeId: resume.id });
  assert.equal(suspendedApply.response.status, 404);

  const expiring = await createJob(staffSession, validJob({ title: 'Expiring Analyst' }));
  await submitJob(staffSession, expiring.json.job.id);
  await prisma.job.update({
    where: { id: expiring.json.job.id },
    data: { closesAt: new Date(Date.now() - 60 * 1000) },
  });
  const expiredApply = await apply(session, expiring.json.job.id, { resumeId: resume.id });
  assert.equal(expiredApply.response.status, 404);
  assert.deepEqual(await listStagingIds(), []);
});

test('failed snapshot preparation leaves no application or staging files', async () => {
  const { job } = await seedPublishedJob('cleanup');
  const { session, resume } = await seedCandidateResume('cleanup-student', {
    fileBuffer: textPdf('TO_BE_REMOVED'),
  });
  const stored = await prisma.resumeFile.findUnique({
    where: { resumeId: resume.id },
    select: { storedFilename: true, userId: true },
  });
  await fs.rm(resumeFilePath(stored.userId, resume.id, stored.storedFilename), { force: true });

  const before = await prisma.application.count();
  const failed = await apply(session, job.id, { resumeId: resume.id });
  assert.equal(failed.response.status, 500);
  assert.equal(await prisma.application.count(), before);
  assert.deepEqual(await listStagingIds(), []);
});

test('candidates list, search, paginate and cannot see another candidate application', async () => {
  const firstJob = await seedPublishedJob('list-a', { job: { title: 'Frontend Engineer' }, company: { companyName: 'Northwind Analytics' } });
  const secondJob = await seedPublishedJob('list-b', {
    job: { title: 'Data Analyst' },
    company: { companyName: 'Southwind Labs', registrationNumber: '7654321-B', email: 'hello@southwind.example' },
  });
  const student = await seedCandidateResume('list-student');
  const seeker = await seedCandidateResume('list-seeker', { seeker: true, fullName: 'Seeker Candidate', title: 'Seeker CV' });

  const studentFirst = await apply(student.session, firstJob.job.id, { resumeId: student.resume.id });
  const studentSecond = await apply(student.session, secondJob.job.id, { resumeId: student.resume.id });
  const seekerApply = await apply(seeker.session, firstJob.job.id, { resumeId: seeker.resume.id });
  assert.equal(studentFirst.response.status, 201);
  assert.equal(studentSecond.response.status, 201);
  assert.equal(seekerApply.response.status, 201);

  const listed = await listMine(student.session);
  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.total, 2);
  assert.equal(listed.json.applications.every((item) => item.applicant == null), true);
  assertNoStorageLeak(listed.json);

  const searched = await listMine(student.session, '?q=Southwind');
  assert.equal(searched.json.total, 1);
  assert.equal(searched.json.applications[0].job.title, 'Data Analyst');

  const paged = await listMine(student.session, '?page=1&limit=1');
  assert.equal(paged.json.applications.length, 1);
  assert.equal(paged.json.total, 2);
  assert.equal(paged.json.totalPages, 2);

  const filtered = await listMine(student.session, '?status=SUBMITTED');
  assert.equal(filtered.json.total, 2);

  const other = await getMine(student.session, seekerApply.json.application.id);
  assert.equal(other.response.status, 404);

  const seekerList = await listMine(seeker.session);
  assert.equal(seekerList.json.total, 1);
  assert.equal(seekerList.json.applications[0].id, seekerApply.json.application.id);

  const unknown = await getMine(student.session, UNKNOWN_ID);
  assert.equal(unknown.response.status, 404);
});

test('candidates can withdraw only from SUBMITTED and cannot reapply', async () => {
  const { job } = await seedPublishedJob('withdraw');
  const { session, resume, candidate } = await seedCandidateResume('withdraw-student');
  const created = await apply(session, job.id, { resumeId: resume.id });
  assert.equal(created.response.status, 201);
  const applicationId = created.json.application.id;

  const extra = await withdrawMine(session, applicationId, { status: 'WITHDRAWN' });
  assert.equal(extra.response.status, 400);

  const withdrawn = await withdrawMine(session, applicationId);
  assert.equal(withdrawn.response.status, 200, withdrawn.text);
  assert.equal(withdrawn.json.application.status, 'WITHDRAWN');
  const events = withdrawn.json.application.statusEvents;
  assert.equal(events.some((event) => event.fromStatus === 'SUBMITTED' && event.toStatus === 'WITHDRAWN'), true);
  assertNoStorageLeak(withdrawn.json);

  const again = await withdrawMine(session, applicationId);
  assert.equal(again.response.status, 409);
  assert.equal(again.json.error, APPLICATION_CANNOT_BE_WITHDRAWN);

  const reapply = await apply(session, job.id, { resumeId: resume.id });
  assert.equal(reapply.response.status, 409);
  assert.equal(reapply.json.error, APPLICATION_ALREADY_EXISTS);

  const reviewJob = await seedPublishedJob('review');
  const reviewApply = await apply(session, reviewJob.job.id, { resumeId: resume.id });
  await prisma.application.update({
    where: { id: reviewApply.json.application.id },
    data: { status: 'UNDER_REVIEW' },
  });
  await prisma.applicationStatusEvent.create({
    data: {
      applicationId: reviewApply.json.application.id,
      fromStatus: 'SUBMITTED',
      toStatus: 'UNDER_REVIEW',
      actorUserId: (await prisma.user.findUnique({ where: { email: candidate.email }, select: { id: true } })).id,
    },
  });
  const blocked = await withdrawMine(session, reviewApply.json.application.id);
  assert.equal(blocked.response.status, 409);
  assert.equal(blocked.json.error, APPLICATION_CANNOT_BE_WITHDRAWN);
});

test('employer read-only APIs are company-scoped and cannot mutate status', async () => {
  const companyA = await seedPublishedJob('emp-a', { company: { companyName: 'Alpha Systems', registrationNumber: '1111111-A', email: 'a@alpha.example' } });
  const companyB = await seedPublishedJob('emp-b', { company: { companyName: 'Beta Systems', registrationNumber: '2222222-B', email: 'b@beta.example' } });
  const { session, resume } = await seedCandidateResume('emp-student', { fileBuffer: textPdf('EMPLOYER_ORIGINAL') });
  const mine = await apply(session, companyA.job.id, { resumeId: resume.id });
  const other = await apply(session, companyB.job.id, { resumeId: resume.id });
  assert.equal(mine.response.status, 201);
  assert.equal(other.response.status, 201);

  const listed = await listEmployer(companyA.staffSession);
  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.total, 1);
  assert.equal(listed.json.applications[0].id, mine.json.application.id);
  assert.ok(listed.json.applications[0].applicant.email);
  assertNoStorageLeak(listed.json);

  const detail = await getEmployer(companyA.staffSession, mine.json.application.id);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.application.status, 'SUBMITTED');
  assert.ok(detail.json.application.applicant.fullName);

  const cross = await getEmployer(companyA.staffSession, other.json.application.id);
  assert.equal(cross.response.status, 404);

  const pdf = await download(companyA.staffSession, `/api/employer/applications/${mine.json.application.id}/resume.pdf`);
  assert.equal(pdf.response.status, 200);
  assert.equal(pdf.buffer.subarray(0, 4).toString('latin1'), '%PDF');
  const original = await download(companyA.staffSession, `/api/employer/applications/${mine.json.application.id}/resume.original`);
  assert.equal(original.response.status, 200);
  assert.equal(original.text.includes('EMPLOYER_ORIGINAL'), true);
  const crossPdf = await download(companyA.staffSession, `/api/employer/applications/${other.json.application.id}/resume.pdf`);
  assert.equal(crossPdf.response.status, 404);
  const crossOriginal = await download(companyA.staffSession, `/api/employer/applications/${other.json.application.id}/resume.original`);
  assert.equal(crossOriginal.response.status, 404);

  const noOriginalJob = await seedPublishedJob('emp-none', { company: { companyName: 'Gamma Systems', registrationNumber: '3333333-C', email: 'g@gamma.example' } });
  const noFile = await seedCandidateResume('emp-nofile');
  const withoutFile = await apply(noFile.session, noOriginalJob.job.id, { resumeId: noFile.resume.id });
  const missingOriginal = await download(
    noOriginalJob.staffSession,
    `/api/employer/applications/${withoutFile.json.application.id}/resume.original`,
  );
  assert.equal(missingOriginal.response.status, 404);

  const patched = await requestJson(baseUrl, `/api/employer/applications/${mine.json.application.id}`, {
    method: 'PATCH',
    csrfToken: companyA.staffSession.csrfToken,
    cookies: companyA.staffSession.cookies,
    body: { status: 'SHORTLISTED', reviewNote: 'Hire' },
  });
  assert.equal(patched.response.status, 404);
  const deleted = await requestJson(baseUrl, `/api/employer/applications/${mine.json.application.id}`, {
    method: 'DELETE',
    csrfToken: companyA.staffSession.csrfToken,
    cookies: companyA.staffSession.cookies,
  });
  assert.equal(deleted.response.status, 404);
  const staffApply = await apply(companyA.staffSession, companyA.job.id, { resumeId: resume.id });
  assert.equal(staffApply.response.status, 403);
});

test('role, CSRF, authentication and suspended accounts are enforced', async () => {
  const { job } = await seedPublishedJob('sec');
  const { session, resume, candidate } = await seedCandidateResume('sec-student');
  const staff = await registerStaff('sec-staff');
  await putCompany(sessionOf(staff));
  const admin = await createAdmin('sec-admin');

  const anon = await postJson(baseUrl, `/api/jobs/${job.id}/applications`, await primeCsrf(baseUrl), {
    resumeId: resume.id,
  });
  assert.equal(anon.response.status, 401);

  const anonList = await requestJson(baseUrl, '/api/me/applications');
  assert.equal(anonList.response.status, 401);
  const anonEmployer = await requestJson(baseUrl, '/api/employer/applications');
  assert.equal(anonEmployer.response.status, 401);

  const noCsrf = await requestJson(baseUrl, `/api/jobs/${job.id}/applications`, {
    method: 'POST',
    cookies: session.cookies,
    body: { resumeId: resume.id },
  });
  assert.equal(noCsrf.response.status, 403);
  assert.equal(noCsrf.json.error, 'Invalid CSRF token');

  const staffMe = await listMine(sessionOf(staff));
  assert.equal(staffMe.response.status, 403);
  const adminMe = await listMine(sessionOf(admin));
  assert.equal(adminMe.response.status, 403);
  const adminEmployer = await listEmployer(sessionOf(admin));
  assert.equal(adminEmployer.response.status, 403);
  const studentEmployer = await listEmployer(session);
  assert.equal(studentEmployer.response.status, 403);
  const adminApply = await apply(sessionOf(admin), job.id, { resumeId: resume.id });
  assert.equal(adminApply.response.status, 403);

  const created = await apply(session, job.id, { resumeId: resume.id });
  assert.equal(created.response.status, 201);
  const otherPdf = await download(sessionOf(staff), `/api/me/applications/${created.json.application.id}/resume.pdf`);
  assert.equal(otherPdf.response.status, 403);

  await prisma.user.update({
    where: { email: candidate.email },
    data: { accountStatus: 'SUSPENDED' },
  });
  const suspended = await apply(session, job.id, { resumeId: resume.id });
  assert.equal(suspended.response.status, 403);
});
