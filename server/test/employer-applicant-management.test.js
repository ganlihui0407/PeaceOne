import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import {
  APPLICATION_CANNOT_BE_UPDATED,
  APPLICATION_CANNOT_BE_WITHDRAWN,
  APPLICATION_STORAGE_ENV,
  APPLICATION_STATUSES,
} from '../src/lib/applicationQuery.js';
import { hashPassword } from '../src/lib/password.js';
import { RESUME_STORAGE_ENV } from '../src/lib/resumeStorage.js';
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

const TEST_EMAIL_PREFIX = 'stage10-eam-';
const ICT_SAFETY_URI = 'http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2';
const UNKNOWN_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const LEFTOVER_EMAILS = [
  'ganlh-am23@student.tarc.edu.my',
  'stage55.student.20261028@peaceone.test',
  'stage73.editor.1794538758951@peaceone.test',
  'stage73.editor.1794538770393@peaceone.test',
];
const LEFTOVER_RESUME_ID = '5c5fde3f-51f8-4334-a4d5-73de30e45a02';
const SENSITIVE_NOTE = 'Internal hiring note: do not share with the candidate.';

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

function assertEmployerPayloadSafe(payload) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  assert.equal(serialized.includes(applicationTempRoot), false);
  assert.equal(serialized.includes(resumeTempRoot), false);
  assert.equal(serialized.includes('structuredSnapshot'), false);
  assert.equal(serialized.includes('originalFileStoredFilename'), false);
  assert.equal(serialized.includes('passwordHash'), false);
  assert.equal(serialized.includes('$2b$'), false);
  assertNoSecrets(payload);
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

async function registerJobSeeker(label, extras = {}) {
  return registerStudent(label, { currentPosition: 'jobseeker', ...extras });
}

async function createAdmin(label = 'admin') {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage Ten Admin',
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
    ? await registerJobSeeker(label, { fullName: extras.fullName || 'Amina Hassan' })
    : await registerStudent(label, { fullName: extras.fullName || 'José Müller' });
  const session = sessionOf(candidate);
  const created = await postJson(baseUrl, '/api/me/resumes', session, {
    title: extras.title || 'Software internship CV',
    templateKey: extras.templateKey || 'modern',
    summary: 'Candidate for a software internship.',
  });
  assert.equal(created.response.status, 201, created.text);
  const resumeId = created.json.resume.id;
  const saved = await requestJson(baseUrl, `/api/me/resumes/${resumeId}`, {
    method: 'PUT',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body: {
      fullName: extras.fullName || (extras.seeker ? 'Amina Hassan' : 'José Müller'),
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
    },
  });
  assert.equal(saved.response.status, 200, saved.text);
  if (extras.fileBuffer) {
    const form = new FormData();
    form.append('file', new Blob([extras.fileBuffer]), extras.filename || 'Original_CV.pdf');
    const response = await fetch(`${baseUrl}/api/me/resumes/${resumeId}/file`, {
      method: 'POST',
      headers: {
        Cookie: session.cookies,
        'x-csrf-token': session.csrfToken,
      },
      body: form,
    });
    const json = await response.json();
    assert.ok(response.status === 200 || response.status === 201, JSON.stringify(json));
  }
  return { candidate, session, resume: saved.json.resume };
}

function apply(session, jobId, body) {
  return postJson(baseUrl, `/api/jobs/${jobId}/applications`, session, body).then(trackApplication);
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

function employerAction(session, id, action, body = {}) {
  return postJson(baseUrl, `/api/employer/applications/${id}/${action}`, session, body);
}

function employerStats(session) {
  return requestJson(baseUrl, '/api/employer/applications/stats', { cookies: session.cookies });
}

function adminStats(session) {
  return requestJson(baseUrl, '/api/admin/applications/stats', { cookies: session.cookies });
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

function assertEmptyStatusCounts(byStatus) {
  assert.deepEqual(Object.keys(byStatus).sort(), [...APPLICATION_STATUSES].sort());
  for (const status of APPLICATION_STATUSES) {
    assert.equal(Number.isInteger(byStatus[status]), true);
    assert.equal(byStatus[status] >= 0, true);
  }
}

before(async () => {
  resumeTempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-eam-resume-'));
  applicationTempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-eam-storage-'));
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
  await closeSessionStore();
  await fs.rm(resumeTempRoot, { recursive: true, force: true });
  await fs.rm(applicationTempRoot, { recursive: true, force: true });
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
});

test('employer can review, shortlist and reject with atomic history and private notes', async () => {
  const company = await seedPublishedJob('flow', {
    job: { title: 'Platform Engineer' },
  });
  const first = await seedCandidateResume('flow-student', {
    fileBuffer: textPdf('STAGE10_ORIGINAL'),
  });
  await requestJson(baseUrl, '/api/me', {
    method: 'PATCH',
    csrfToken: first.session.csrfToken,
    cookies: first.session.cookies,
    body: {
      phone: '012-888 0001',
      location: 'Ipoh',
      educationLevel: "Bachelor's Degree",
      fieldOfStudy: 'Computer Science',
      institution: 'TAR UMT',
      graduationYear: 2025,
      experienceSummary: 'Internship reporting work.',
    },
  });
  const second = await seedCandidateResume('flow-seeker', { seeker: true, fullName: 'Amina Hassan' });
  const third = await seedCandidateResume('flow-third', { fullName: 'Wei Chen' });

  const submitted = await apply(first.session, company.job.id, { resumeId: first.resume.id });
  const shortlistReady = await apply(second.session, company.job.id, { resumeId: second.resume.id });
  const rejectReady = await apply(third.session, company.job.id, { resumeId: third.resume.id });
  assert.equal(submitted.response.status, 201, submitted.text);
  assert.equal(shortlistReady.response.status, 201, shortlistReady.text);
  assert.equal(rejectReady.response.status, 201, rejectReady.text);

  const reviewed = await employerAction(company.staffSession, submitted.json.application.id, 'review', {
    reviewNote: `  ${SENSITIVE_NOTE}  `,
  });
  assert.equal(reviewed.response.status, 200, reviewed.text);
  assert.equal(reviewed.json.application.status, 'UNDER_REVIEW');
  const reviewEvent = reviewed.json.application.statusEvents.find(
    (event) => event.fromStatus === 'SUBMITTED' && event.toStatus === 'UNDER_REVIEW',
  );
  assert.ok(reviewEvent);
  assert.equal(reviewEvent.reviewNote, SENSITIVE_NOTE);
  assert.equal(reviewEvent.actor.fullName.length > 0, true);
  assert.equal(reviewed.json.application.applicant.fullName, 'José Müller');
  assert.equal(reviewed.json.application.applicant.phone, '012-888 0001');
  assert.equal(reviewed.json.application.applicant.location, 'Ipoh');
  assert.equal(reviewed.json.application.applicant.educationLevel, "Bachelor's Degree");
  assert.equal(reviewed.json.application.applicant.fieldOfStudy, 'Computer Science');
  assert.equal(reviewed.json.application.applicant.institution, 'TAR UMT');
  assert.equal(reviewed.json.application.applicant.graduationYear, 2025);
  assert.equal(reviewed.json.application.applicant.experienceSummary, 'Internship reporting work.');
  assert.equal(reviewed.json.application.applicant.passwordHash, undefined);
  assertEmployerPayloadSafe(reviewed.json);

  const candidateView = await getMine(first.session, submitted.json.application.id);
  assert.equal(candidateView.response.status, 200, candidateView.text);
  assert.equal(candidateView.json.application.status, 'UNDER_REVIEW');
  assert.equal(candidateView.json.application.applicant, undefined);
  const candidateReviewEvent = candidateView.json.application.statusEvents.find(
    (event) => event.toStatus === 'UNDER_REVIEW',
  );
  assert.ok(candidateReviewEvent);
  assert.equal('reviewNote' in candidateReviewEvent, false);
  assert.equal(JSON.stringify(candidateView.json).includes(SENSITIVE_NOTE), false);
  assertEmployerPayloadSafe(candidateView.json);

  const blockedWithdraw = await withdrawMine(first.session, submitted.json.application.id);
  assert.equal(blockedWithdraw.response.status, 409);
  assert.equal(blockedWithdraw.json.error, APPLICATION_CANNOT_BE_WITHDRAWN);

  const shortlistedFromReview = await employerAction(
    company.staffSession,
    submitted.json.application.id,
    'shortlist',
    {},
  );
  assert.equal(shortlistedFromReview.response.status, 200, shortlistedFromReview.text);
  assert.equal(shortlistedFromReview.json.application.status, 'SHORTLISTED');

  const shortlistedDirect = await employerAction(
    company.staffSession,
    shortlistReady.json.application.id,
    'shortlist',
    { reviewNote: '' },
  );
  assert.equal(shortlistedDirect.response.status, 200, shortlistedDirect.text);
  assert.equal(shortlistedDirect.json.application.status, 'SHORTLISTED');
  const directEvent = shortlistedDirect.json.application.statusEvents.find(
    (event) => event.fromStatus === 'SUBMITTED' && event.toStatus === 'SHORTLISTED',
  );
  assert.equal(directEvent.reviewNote, null);

  const rejected = await employerAction(company.staffSession, rejectReady.json.application.id, 'reject', {
    reviewNote: 'Does not meet the required experience.',
  });
  assert.equal(rejected.response.status, 200, rejected.text);
  assert.equal(rejected.json.application.status, 'REJECTED');

  const pdf = await download(
    company.staffSession,
    `/api/employer/applications/${submitted.json.application.id}/resume.pdf`,
  );
  assert.equal(pdf.response.status, 200);
  assert.equal(pdf.buffer.subarray(0, 4).toString('latin1'), '%PDF');
  const original = await download(
    company.staffSession,
    `/api/employer/applications/${submitted.json.application.id}/resume.original`,
  );
  assert.equal(original.response.status, 200);
  assert.equal(original.text.includes('STAGE10_ORIGINAL'), true);
});

test('illegal employer transitions return 409 and interview endpoints stay unavailable', async () => {
  const company = await seedPublishedJob('illegal');
  const candidate = await seedCandidateResume('illegal-student');
  const created = await apply(candidate.session, company.job.id, { resumeId: candidate.resume.id });
  const applicationId = created.json.application.id;

  const withdrawnJob = await seedPublishedJob('illegal-withdraw', {
    company: { companyName: 'Withdraw Co', registrationNumber: '8888888-W', email: 'w@withdraw.example' },
  });
  const withdrawnApply = await apply(candidate.session, withdrawnJob.job.id, { resumeId: candidate.resume.id });
  const withdrawn = await withdrawMine(candidate.session, withdrawnApply.json.application.id);
  assert.equal(withdrawn.response.status, 200, withdrawn.text);
  const rejectWithdrawn = await employerAction(
    withdrawnJob.staffSession,
    withdrawnApply.json.application.id,
    'reject',
    {},
  );
  assert.equal(rejectWithdrawn.response.status, 409);
  assert.equal(rejectWithdrawn.json.error, APPLICATION_CANNOT_BE_UPDATED);

  await employerAction(company.staffSession, applicationId, 'review', {});
  const reviewAgain = await employerAction(company.staffSession, applicationId, 'review', {});
  assert.equal(reviewAgain.response.status, 409);

  await employerAction(company.staffSession, applicationId, 'shortlist', {});
  const shortlistAgain = await employerAction(company.staffSession, applicationId, 'shortlist', {});
  assert.equal(shortlistAgain.response.status, 409);
  const reviewAfterShortlist = await employerAction(company.staffSession, applicationId, 'review', {});
  assert.equal(reviewAfterShortlist.response.status, 409);

  await employerAction(company.staffSession, applicationId, 'reject', {});
  const rejectAgain = await employerAction(company.staffSession, applicationId, 'reject', {});
  assert.equal(rejectAgain.response.status, 409);

  const interviewJob = await seedPublishedJob('illegal-interview', {
    company: { companyName: 'Interview Co', registrationNumber: '7777777-I', email: 'i@interview.example' },
  });
  const interviewApply = await apply(candidate.session, interviewJob.job.id, { resumeId: candidate.resume.id });
  await prisma.application.update({
    where: { id: interviewApply.json.application.id },
    data: { status: 'INTERVIEW' },
  });
  const shortlistInterview = await employerAction(
    interviewJob.staffSession,
    interviewApply.json.application.id,
    'shortlist',
    {},
  );
  assert.equal(shortlistInterview.response.status, 409);

  const offeredJob = await seedPublishedJob('illegal-offer', {
    company: { companyName: 'Offer Co', registrationNumber: '6666666-O', email: 'o@offer.example' },
  });
  const offeredApply = await apply(candidate.session, offeredJob.job.id, { resumeId: candidate.resume.id });
  await prisma.application.update({
    where: { id: offeredApply.json.application.id },
    data: { status: 'OFFERED' },
  });
  const rejectOffered = await employerAction(
    offeredJob.staffSession,
    offeredApply.json.application.id,
    'reject',
    {},
  );
  assert.equal(rejectOffered.response.status, 409);

  const interviewRoute = await employerAction(company.staffSession, applicationId, 'interview', {});
  assert.equal(interviewRoute.response.status, 404);
  const offerRoute = await employerAction(company.staffSession, applicationId, 'offer', {});
  assert.equal(offerRoute.response.status, 404);
});

test('concurrent shortlist requests cannot both succeed', async () => {
  const company = await seedPublishedJob('concurrent');
  const candidate = await seedCandidateResume('concurrent-student');
  const created = await apply(candidate.session, company.job.id, { resumeId: candidate.resume.id });
  const applicationId = created.json.application.id;

  const [first, second] = await Promise.all([
    employerAction(company.staffSession, applicationId, 'shortlist', { reviewNote: 'first' }),
    employerAction(company.staffSession, applicationId, 'shortlist', { reviewNote: 'second' }),
  ]);
  const statuses = [first.response.status, second.response.status].sort();
  assert.deepEqual(statuses, [200, 409]);
  const success = first.response.status === 200 ? first : second;
  assert.equal(success.json.application.status, 'SHORTLISTED');
  const stored = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { statusEvents: true },
  });
  assert.equal(stored.status, 'SHORTLISTED');
  assert.equal(stored.statusEvents.filter((event) => event.toStatus === 'SHORTLISTED').length, 1);
});

test('employer search, stats, company isolation and applicant DTO stay company-scoped', async () => {
  const alpha = await seedPublishedJob('search-a', {
    job: { title: 'Data Analyst' },
    company: { companyName: 'Alpha Search', registrationNumber: '1111111-S', email: 'a@search.example' },
  });
  const beta = await seedPublishedJob('search-b', {
    job: { title: 'Backend Engineer' },
    company: { companyName: 'Beta Search', registrationNumber: '2222222-S', email: 'b@search.example' },
  });
  const named = await seedCandidateResume('search-named', { fullName: 'Siti Nurhaliza' });
  const other = await seedCandidateResume('search-other', { fullName: 'Other Applicant' });
  const alphaApply = await apply(named.session, alpha.job.id, { resumeId: named.resume.id });
  const betaApply = await apply(other.session, beta.job.id, { resumeId: other.resume.id });
  assert.equal(alphaApply.response.status, 201);
  assert.equal(betaApply.response.status, 201);

  const emptyCompany = await registerStaff('search-empty');
  const emptySession = sessionOf(emptyCompany);
  await putCompany(emptySession, {
    companyName: 'Empty Search Co',
    registrationNumber: '3333333-S',
    email: 'empty@search.example',
  });
  const emptyJob = await createJob(emptySession, validJob({ title: 'Unused Vacancy' }));
  assert.equal(emptyJob.response.status, 201, emptyJob.text);
  await submitJob(emptySession, emptyJob.json.job.id);

  const byName = await listEmployer(alpha.staffSession, '?q=Siti');
  assert.equal(byName.response.status, 200, byName.text);
  assert.equal(byName.json.total, 1);
  assert.equal(byName.json.applications[0].applicant.fullName, 'Siti Nurhaliza');
  assert.equal(byName.json.applications[0].applicant.phone, null);
  assert.equal(byName.json.applications[0].applicant.experienceSummary, null);

  const byEmail = await listEmployer(alpha.staffSession, `?q=${encodeURIComponent(named.candidate.email)}`);
  assert.equal(byEmail.json.total, 1);

  const byTitle = await listEmployer(alpha.staffSession, '?q=Analyst');
  assert.equal(byTitle.json.total, 1);

  const crossSearch = await listEmployer(alpha.staffSession, '?q=Backend');
  assert.equal(crossSearch.json.total, 0);

  const filtered = await listEmployer(alpha.staffSession, `?jobId=${alpha.job.id}&status=SUBMITTED`);
  assert.equal(filtered.json.total, 1);

  const crossDetail = await getEmployer(alpha.staffSession, betaApply.json.application.id);
  assert.equal(crossDetail.response.status, 404);
  const crossReview = await employerAction(alpha.staffSession, betaApply.json.application.id, 'review', {});
  assert.equal(crossReview.response.status, 404);
  const unknown = await employerAction(alpha.staffSession, UNKNOWN_ID, 'reject', {});
  assert.equal(unknown.response.status, 404);

  const stats = await employerStats(alpha.staffSession);
  assert.equal(stats.response.status, 200, stats.text);
  assert.equal(stats.json.total, 1);
  assertEmptyStatusCounts(stats.json.byStatus);
  assert.equal(stats.json.byStatus.SUBMITTED, 1);
  assert.equal(stats.json.jobs.length, 1);
  assert.equal(stats.json.jobs[0].id, alpha.job.id);
  assert.equal(stats.json.jobs[0].title, 'Data Analyst');
  assert.equal(stats.json.jobs[0].status, 'PUBLISHED');
  assert.equal(stats.json.jobs[0].applicationCount, 1);
  assert.equal(stats.json.jobs[0].compatibility, undefined);
  assertEmployerPayloadSafe(stats.json);

  const emptyStats = await employerStats(emptySession);
  assert.equal(emptyStats.response.status, 200, emptyStats.text);
  assert.equal(emptyStats.json.total, 0);
  assert.equal(emptyStats.json.byStatus.SUBMITTED, 0);
  assert.equal(emptyStats.json.jobs[0].applicationCount, 0);

  const beforeAdmin = await prisma.application.count();
  const admin = await createAdmin('search-admin');
  const adminBefore = await adminStats(sessionOf(admin));
  assert.equal(adminBefore.response.status, 200, adminBefore.text);
  assert.equal(adminBefore.json.total, beforeAdmin);
  assertEmptyStatusCounts(adminBefore.json.byStatus);
  assert.equal(Number.isInteger(adminBefore.json.companiesWithApplications), true);
  assert.equal(adminBefore.json.applications, undefined);
  assert.equal(adminBefore.json.jobs, undefined);

  await employerAction(alpha.staffSession, alphaApply.json.application.id, 'review', {});
  const adminAfter = await adminStats(sessionOf(admin));
  assert.equal(adminAfter.json.total, beforeAdmin);
  assert.equal(adminAfter.json.byStatus.UNDER_REVIEW, adminBefore.json.byStatus.UNDER_REVIEW + 1);
  assert.equal(adminAfter.json.byStatus.SUBMITTED, adminBefore.json.byStatus.SUBMITTED - 1);
  assert.equal(adminAfter.json.companiesWithApplications >= 2, true);
});

test('employer mutations enforce auth, CSRF, roles, extra fields and PATCH remains unavailable', async () => {
  const company = await seedPublishedJob('sec');
  const student = await seedCandidateResume('sec-student');
  const seeker = await seedCandidateResume('sec-seeker', { seeker: true, fullName: 'Seeker Candidate' });
  const created = await apply(student.session, company.job.id, { resumeId: student.resume.id });
  const applicationId = created.json.application.id;
  const admin = await createAdmin('sec-admin');
  const bareStaff = await registerStaff('sec-bare');

  const anon = await postJson(
    baseUrl,
    `/api/employer/applications/${applicationId}/review`,
    await primeCsrf(baseUrl),
    {},
  );
  assert.equal(anon.response.status, 401);
  const anonStats = await requestJson(baseUrl, '/api/employer/applications/stats');
  assert.equal(anonStats.response.status, 401);
  const anonAdmin = await requestJson(baseUrl, '/api/admin/applications/stats');
  assert.equal(anonAdmin.response.status, 401);

  const noCsrf = await requestJson(baseUrl, `/api/employer/applications/${applicationId}/review`, {
    method: 'POST',
    cookies: company.staffSession.cookies,
    body: {},
  });
  assert.equal(noCsrf.response.status, 403);
  assert.equal(noCsrf.json.error, 'Invalid CSRF token');

  const extra = await employerAction(company.staffSession, applicationId, 'review', {
    status: 'UNDER_REVIEW',
    companyId: company.job.companyId,
    applicantUserId: UNKNOWN_ID,
    actorUserId: company.staff.json.user.id,
    fromStatus: 'SUBMITTED',
  });
  assert.equal(extra.response.status, 400);

  const longNote = await employerAction(company.staffSession, applicationId, 'reject', {
    reviewNote: 'n'.repeat(501),
  });
  assert.equal(longNote.response.status, 400);

  const studentAction = await employerAction(student.session, applicationId, 'review', {});
  assert.equal(studentAction.response.status, 403);
  const seekerAction = await employerAction(seeker.session, applicationId, 'shortlist', {});
  assert.equal(seekerAction.response.status, 403);
  const adminAction = await employerAction(sessionOf(admin), applicationId, 'reject', {});
  assert.equal(adminAction.response.status, 403);
  const adminEmployerStats = await employerStats(sessionOf(admin));
  assert.equal(adminEmployerStats.response.status, 403);
  const studentAdminStats = await adminStats(student.session);
  assert.equal(studentAdminStats.response.status, 403);
  const staffAdminStats = await adminStats(company.staffSession);
  assert.equal(staffAdminStats.response.status, 403);

  const noCompany = await employerAction(sessionOf(bareStaff), applicationId, 'review', {});
  assert.equal(noCompany.response.status, 403);
  const noCompanyStats = await employerStats(sessionOf(bareStaff));
  assert.equal(noCompanyStats.response.status, 403);

  const patched = await requestJson(baseUrl, `/api/employer/applications/${applicationId}`, {
    method: 'PATCH',
    csrfToken: company.staffSession.csrfToken,
    cookies: company.staffSession.cookies,
    body: { status: 'SHORTLISTED', reviewNote: 'Hire' },
  });
  assert.equal(patched.response.status, 404);
  const deleted = await requestJson(baseUrl, `/api/employer/applications/${applicationId}`, {
    method: 'DELETE',
    csrfToken: company.staffSession.csrfToken,
    cookies: company.staffSession.cookies,
  });
  assert.equal(deleted.response.status, 404);

  await prisma.user.update({
    where: { email: company.staff.email },
    data: { accountStatus: 'SUSPENDED' },
  });
  const suspended = await employerAction(company.staffSession, applicationId, 'review', {});
  assert.equal(suspended.response.status, 403);
  await prisma.user.update({
    where: { email: company.staff.email },
    data: { accountStatus: 'ACTIVE' },
  });
});
