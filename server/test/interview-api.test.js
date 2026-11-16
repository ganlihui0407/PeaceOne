import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { APPLICATION_STORAGE_ENV } from '../src/lib/applicationQuery.js';
import {
  INTERVIEW_CANNOT_BE_CREATED,
  INTERVIEW_CANNOT_BE_UPDATED,
  INTERVIEW_STATUSES,
} from '../src/lib/interviewQuery.js';
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

const TEST_EMAIL_PREFIX = 'stage11-int-';
const ICT_SAFETY_URI = 'http://data.europa.eu/esco/skill/426ceaba-6867-481c-bb6b-aee3933da7d2';
const UNKNOWN_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const LEFTOVER_EMAILS = [
  'ganlh-am23@student.tarc.edu.my',
  'stage55.student.20261028@peaceone.test',
  'stage73.editor.1794538758951@peaceone.test',
  'stage73.editor.1794538770393@peaceone.test',
];
const LEFTOVER_RESUME_ID = '5c5fde3f-51f8-4334-a4d5-73de30e45a02';
const PRIVATE_NOTE = 'Internal interviewer note: do not share.';
const MEETING_LINK = 'https://meet.example.com/peaceone-round-1';

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
    jobs,
    applications,
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
    prisma.job.count(),
    prisma.application.count(),
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
    jobs,
    applications,
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
    select: { id: true, title: true, userId: true },
  });
}

function sessionOf(result) {
  return {
    csrfToken: result.json.csrfToken,
    cookies: result.cookies,
  };
}

function futureIso(hours = 48) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
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

function assertPayloadSafe(payload) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
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

async function createAdmin(label = 'admin') {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage Eleven Admin',
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
      companyName: extras.companyName || 'Interview Labs',
      registrationNumber: extras.registrationNumber || '8888888-I',
      industry: 'Technology',
      companySize: '11-50',
      website: 'www.interviewlabs.example',
      email: extras.email || 'hello@interviewlabs.example',
      phone: '03-555 0100',
      location: extras.location || 'Kuala Lumpur',
      address: '1 Jalan Utara',
      description: 'A hiring studio.',
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
    title: 'Backend Engineer',
    description: 'Build APIs used by reporting teams.',
    qualificationRequired: "Bachelor's Degree in Computer Science",
    experienceRequired: '1-2 years',
    employmentType: 'FULL_TIME',
    location: 'Kuala Lumpur',
    salaryMin: 4500,
    salaryMax: 6500,
    closesAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    requiredSkills: [{ skillId: ictSafety.id, requiredLevel: 'Intermediate' }],
    ...overrides,
  };
}

async function seedPublishedJob(label, extras = {}) {
  const staff = await registerStaff(`${label}-staff`);
  const staffSession = sessionOf(staff);
  await putCompany(staffSession, extras.company);
  const created = await requestJson(baseUrl, '/api/me/jobs', {
    method: 'POST',
    csrfToken: staffSession.csrfToken,
    cookies: staffSession.cookies,
    body: validJob(extras.job),
  }).then(trackJob);
  assert.equal(created.response.status, 201, created.text);
  const submitted = await postJson(baseUrl, `/api/me/jobs/${created.json.job.id}/submit`, staffSession, {});
  assert.equal(submitted.response.status, 200, submitted.text);
  return { staff, staffSession, job: submitted.json.job };
}

async function seedCandidateResume(label, extras = {}) {
  const candidate = extras.seeker
    ? await registerStudent(label, { currentPosition: 'jobseeker', fullName: extras.fullName || 'Amina Hassan' })
    : await registerStudent(label, { fullName: extras.fullName || 'José Müller' });
  const session = sessionOf(candidate);
  const created = await postJson(baseUrl, '/api/me/resumes', session, {
    title: extras.title || 'Software CV',
    templateKey: 'modern',
    summary: 'Candidate for a software role.',
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
      experience: [{
        jobTitle: 'Intern',
        organization: 'PeaceOne Labs',
        startDate: '2025-06-01',
        isCurrent: true,
        description: 'Built candidate pages.',
      }],
      skills: [{ label: 'JavaScript', proficiencyLevel: 'Intermediate' }],
      certifications: [{ name: 'AWS Cloud Practitioner', year: 2025 }],
    },
  });
  assert.equal(saved.response.status, 200, saved.text);
  return { candidate, session, resume: saved.json.resume };
}

function apply(session, jobId, body) {
  return postJson(baseUrl, `/api/jobs/${jobId}/applications`, session, body).then(trackApplication);
}

function employerAction(session, id, action, body = {}) {
  return postJson(baseUrl, `/api/employer/applications/${id}/${action}`, session, body);
}

function createInterview(session, body) {
  return postJson(baseUrl, '/api/employer/interviews', session, body);
}

function employerInterview(session, id) {
  return requestJson(baseUrl, `/api/employer/interviews/${id}`, { cookies: session.cookies });
}

function listEmployerInterviews(session, query = '') {
  return requestJson(baseUrl, `/api/employer/interviews${query}`, { cookies: session.cookies });
}

function employerInterviewStats(session) {
  return requestJson(baseUrl, '/api/employer/interviews/stats', { cookies: session.cookies });
}

function employerInterviewAction(session, id, action, body = {}) {
  return postJson(baseUrl, `/api/employer/interviews/${id}/${action}`, session, body);
}

function meInterview(session, id) {
  return requestJson(baseUrl, `/api/me/interviews/${id}`, { cookies: session.cookies });
}

function listMeInterviews(session, query = '') {
  return requestJson(baseUrl, `/api/me/interviews${query}`, { cookies: session.cookies });
}

function meInterviewAction(session, id, action, body = {}) {
  return postJson(baseUrl, `/api/me/interviews/${id}/${action}`, session, body);
}

function adminInterviewStats(session) {
  return requestJson(baseUrl, '/api/admin/interviews/stats', { cookies: session.cookies });
}

function onlineInvite(applicationId, extras = {}) {
  return {
    applicationId,
    interviewType: 'ONLINE',
    scheduledStartAt: extras.scheduledStartAt || futureIso(72),
    durationMinutes: extras.durationMinutes || 45,
    timezone: extras.timezone || 'Asia/Kuala_Lumpur',
    meetingLink: extras.meetingLink || MEETING_LINK,
    instructions: extras.instructions || 'Join five minutes early.',
    employerNotes: extras.employerNotes === undefined ? PRIVATE_NOTE : extras.employerNotes,
    ...extras,
  };
}

async function shortlistedApplication(label, extras = {}) {
  const company = await seedPublishedJob(label, extras);
  const candidate = await seedCandidateResume(`${label}-cand`, extras.candidate);
  const applied = await apply(candidate.session, company.job.id, { resumeId: candidate.resume.id });
  assert.equal(applied.response.status, 201, applied.text);
  const shortlisted = await employerAction(company.staffSession, applied.json.application.id, 'shortlist', {});
  assert.equal(shortlisted.response.status, 200, shortlisted.text);
  assert.equal(shortlisted.json.application.status, 'SHORTLISTED');
  return { company, candidate, application: shortlisted.json.application };
}

before(async () => {
  resumeTempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-int-resume-'));
  applicationTempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-int-storage-'));
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

test('unauthenticated interview routes and CSRF are rejected', async () => {
  const list = await requestJson(baseUrl, '/api/employer/interviews');
  assert.equal(list.response.status, 401);
  const mine = await requestJson(baseUrl, '/api/me/interviews');
  assert.equal(mine.response.status, 401);
  const stats = await requestJson(baseUrl, '/api/admin/interviews/stats');
  assert.equal(stats.response.status, 401);

  const primed = await primeCsrf(baseUrl);
  const noToken = await requestJson(baseUrl, '/api/employer/interviews', {
    method: 'POST',
    cookies: primed.cookies,
    body: onlineInvite(UNKNOWN_ID),
  });
  assert.equal(noToken.response.status, 403);
  assert.equal(noToken.json.error, 'Invalid CSRF token');
});

test('employer can invite a shortlisted candidate without changing application status', async () => {
  const seeded = await shortlistedApplication('invite');
  const created = await createInterview(seeded.company.staffSession, onlineInvite(seeded.application.id));
  assert.equal(created.response.status, 201, created.text);
  assert.equal(created.json.interview.status, 'PROPOSED');
  assert.equal(created.json.interview.roundNumber, 1);
  assert.equal(created.json.interview.employerNotes, PRIVATE_NOTE);
  assert.equal(created.json.interview.meetingLink, MEETING_LINK);
  assert.equal(created.json.interview.application.status, 'SHORTLISTED');
  assert.equal(created.json.interview.events[0].eventType, 'CREATED');
  assertPayloadSafe(created.json);

  const storedApplication = await prisma.application.findUnique({
    where: { id: seeded.application.id },
    select: { status: true },
  });
  assert.equal(storedApplication.status, 'SHORTLISTED');

  const duplicate = await createInterview(seeded.company.staffSession, onlineInvite(seeded.application.id, {
    scheduledStartAt: futureIso(96),
  }));
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.json.error, INTERVIEW_CANNOT_BE_CREATED);

  const submittedOnly = await seedPublishedJob('not-short');
  const waiting = await seedCandidateResume('waiting');
  const applied = await apply(waiting.session, submittedOnly.job.id, { resumeId: waiting.resume.id });
  const tooEarly = await createInterview(submittedOnly.staffSession, onlineInvite(applied.json.application.id));
  assert.equal(tooEarly.response.status, 409);
  assert.equal(tooEarly.json.error, INTERVIEW_CANNOT_BE_CREATED);

  const missingLink = await createInterview(seeded.company.staffSession, {
    applicationId: seeded.application.id,
    interviewType: 'ONLINE',
    scheduledStartAt: futureIso(80),
    durationMinutes: 30,
  });
  assert.equal(missingLink.response.status, 400);

  const scriptLink = await createInterview(seeded.company.staffSession, onlineInvite(seeded.application.id, {
    meetingLink: 'javascript:alert(1)',
  }));
  assert.equal(scriptLink.response.status, 400);
  const httpLink = await createInterview(seeded.company.staffSession, onlineInvite(seeded.application.id, {
    meetingLink: 'http://meet.example.com/insecure',
  }));
  assert.equal(httpLink.response.status, 400);

  const past = await createInterview(seeded.company.staffSession, onlineInvite(seeded.application.id, {
    scheduledStartAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  }));
  assert.equal(past.response.status, 400);
});

test('candidate accept confirms the interview and promotes SHORTLISTED to INTERVIEW once', async () => {
  const seeded = await shortlistedApplication('accept');
  const created = await createInterview(seeded.company.staffSession, onlineInvite(seeded.application.id));
  const interviewId = created.json.interview.id;

  const candidateView = await meInterview(seeded.candidate.session, interviewId);
  assert.equal(candidateView.response.status, 200, candidateView.text);
  assert.equal(candidateView.json.interview.meetingLink, MEETING_LINK);
  assert.equal(candidateView.json.interview.employerNotes, undefined);
  assert.equal(candidateView.json.interview.attendance, undefined);
  assert.equal(candidateView.json.interview.outcome, undefined);
  assert.equal(JSON.stringify(candidateView.json).includes(PRIVATE_NOTE), false);

  const accepted = await meInterviewAction(seeded.candidate.session, interviewId, 'accept', {});
  assert.equal(accepted.response.status, 200, accepted.text);
  assert.equal(accepted.json.interview.status, 'CONFIRMED');
  assert.equal(accepted.json.interview.application.status, 'INTERVIEW');
  assert.equal(accepted.json.interview.events.some((event) => event.eventType === 'ACCEPTED'), true);

  const application = await prisma.application.findUnique({
    where: { id: seeded.application.id },
    include: { statusEvents: { orderBy: { createdAt: 'asc' } } },
  });
  assert.equal(application.status, 'INTERVIEW');
  assert.equal(application.statusEvents.filter((event) => event.toStatus === 'INTERVIEW').length, 1);

  const secondAccept = await meInterviewAction(seeded.candidate.session, interviewId, 'accept', {});
  assert.equal(secondAccept.response.status, 409);
  assert.equal(secondAccept.json.error, INTERVIEW_CANNOT_BE_UPDATED);
});

test('reschedule preserves the original schedule and employer can confirm or propose another time', async () => {
  const seeded = await shortlistedApplication('resched');
  const originalStart = futureIso(50);
  const created = await createInterview(
    seeded.company.staffSession,
    onlineInvite(seeded.application.id, { scheduledStartAt: originalStart, durationMinutes: 30 }),
  );
  const interviewId = created.json.interview.id;
  const requestedStart = futureIso(90);

  const requested = await meInterviewAction(seeded.candidate.session, interviewId, 'reschedule', {
    requestedStartAt: requestedStart,
    requestedDurationMinutes: 60,
    candidateResponseNote: 'I have a class clash.',
  });
  assert.equal(requested.response.status, 200, requested.text);
  assert.equal(requested.json.interview.status, 'RESCHEDULE_REQUESTED');
  assert.equal(requested.json.interview.scheduledStartAt, originalStart);
  assert.equal(requested.json.interview.requestedStartAt, requestedStart);
  const requestEvent = requested.json.interview.events.find((event) => event.eventType === 'RESCHEDULE_REQUESTED');
  assert.equal(requestEvent.eventDetails.scheduledStartAt, originalStart);

  const confirmed = await employerInterviewAction(seeded.company.staffSession, interviewId, 'confirm-reschedule', {});
  assert.equal(confirmed.response.status, 200, confirmed.text);
  assert.equal(confirmed.json.interview.status, 'CONFIRMED');
  assert.equal(confirmed.json.interview.scheduledStartAt, requestedStart);
  assert.equal(confirmed.json.interview.durationMinutes, 60);
  assert.equal(confirmed.json.interview.requestedStartAt, null);
  assert.equal(confirmed.json.interview.application.status, 'INTERVIEW');

  const other = await shortlistedApplication('propose');
  const second = await createInterview(other.company.staffSession, onlineInvite(other.application.id));
  const secondId = second.json.interview.id;
  const asked = await meInterviewAction(other.candidate.session, secondId, 'reschedule', {
    requestedStartAt: futureIso(100),
  });
  assert.equal(asked.response.status, 200, asked.text);
  const newStart = futureIso(120);
  const proposed = await employerInterviewAction(other.company.staffSession, secondId, 'update-schedule', {
    scheduledStartAt: newStart,
    durationMinutes: 45,
    meetingLink: 'https://meet.example.com/revised',
  });
  assert.equal(proposed.response.status, 200, proposed.text);
  assert.equal(proposed.json.interview.status, 'PROPOSED');
  assert.equal(proposed.json.interview.scheduledStartAt, newStart);
  assert.equal(proposed.json.interview.requestedStartAt, null);
});

test('decline, cancel, complete and illegal transitions follow the matrix', async () => {
  const declinedSeed = await shortlistedApplication('decline');
  const declinedInvite = await createInterview(
    declinedSeed.company.staffSession,
    onlineInvite(declinedSeed.application.id),
  );
  const declinedId = declinedInvite.json.interview.id;
  const declined = await meInterviewAction(declinedSeed.candidate.session, declinedId, 'decline', {
    candidateResponseNote: 'Unable to attend.',
  });
  assert.equal(declined.response.status, 200, declined.text);
  assert.equal(declined.json.interview.status, 'DECLINED');
  assert.equal(declined.json.interview.meetingLink, null);
  const rescheduleDeclined = await meInterviewAction(declinedSeed.candidate.session, declinedId, 'reschedule', {
    requestedStartAt: futureIso(80),
  });
  assert.equal(rescheduleDeclined.response.status, 409);
  const acceptDeclined = await meInterviewAction(declinedSeed.candidate.session, declinedId, 'accept', {});
  assert.equal(acceptDeclined.response.status, 409);

  const nextRound = await createInterview(
    declinedSeed.company.staffSession,
    onlineInvite(declinedSeed.application.id, { scheduledStartAt: futureIso(110) }),
  );
  assert.equal(nextRound.response.status, 201, nextRound.text);
  assert.equal(nextRound.json.interview.roundNumber, 2);

  const cancelSeed = await shortlistedApplication('cancel');
  const cancelInvite = await createInterview(cancelSeed.company.staffSession, onlineInvite(cancelSeed.application.id));
  const accepted = await meInterviewAction(cancelSeed.candidate.session, cancelInvite.json.interview.id, 'accept', {});
  assert.equal(accepted.json.interview.application.status, 'INTERVIEW');
  const cancelled = await employerInterviewAction(
    cancelSeed.company.staffSession,
    cancelInvite.json.interview.id,
    'cancel',
    {},
  );
  assert.equal(cancelled.response.status, 200, cancelled.text);
  assert.equal(cancelled.json.interview.status, 'CANCELLED');
  const stillInterview = await prisma.application.findUnique({
    where: { id: cancelSeed.application.id },
    select: { status: true },
  });
  assert.equal(stillInterview.status, 'INTERVIEW');
  const acceptCancelled = await meInterviewAction(
    cancelSeed.candidate.session,
    cancelInvite.json.interview.id,
    'accept',
    {},
  );
  assert.equal(acceptCancelled.response.status, 409);

  const completeSeed = await shortlistedApplication('complete');
  const completeInvite = await createInterview(
    completeSeed.company.staffSession,
    onlineInvite(completeSeed.application.id),
  );
  const tooSoon = await employerInterviewAction(
    completeSeed.company.staffSession,
    completeInvite.json.interview.id,
    'complete',
    { attendance: 'ATTENDED' },
  );
  assert.equal(tooSoon.response.status, 409);
  await meInterviewAction(completeSeed.candidate.session, completeInvite.json.interview.id, 'accept', {});
  const completed = await employerInterviewAction(
    completeSeed.company.staffSession,
    completeInvite.json.interview.id,
    'complete',
    { attendance: 'ATTENDED', outcome: 'POSITIVE', employerNotes: 'Strong SQL examples.' },
  );
  assert.equal(completed.response.status, 200, completed.text);
  assert.equal(completed.json.interview.status, 'COMPLETED');
  assert.equal(completed.json.interview.attendance, 'ATTENDED');
  assert.equal(completed.json.interview.outcome, 'POSITIVE');
  const mutateCompleted = await employerInterviewAction(
    completeSeed.company.staffSession,
    completeInvite.json.interview.id,
    'cancel',
    {},
  );
  assert.equal(mutateCompleted.response.status, 409);

  const candidateCompleted = await meInterview(completeSeed.candidate.session, completeInvite.json.interview.id);
  assert.equal(candidateCompleted.json.interview.outcome, undefined);
  assert.equal(candidateCompleted.json.interview.attendance, undefined);
  assert.equal(JSON.stringify(candidateCompleted.json).includes('Strong SQL examples.'), false);

  const secondRound = await createInterview(
    completeSeed.company.staffSession,
    onlineInvite(completeSeed.application.id, { scheduledStartAt: futureIso(130) }),
  );
  assert.equal(secondRound.response.status, 201, secondRound.text);
  const secondAccept = await meInterviewAction(
    completeSeed.candidate.session,
    secondRound.json.interview.id,
    'accept',
    {},
  );
  assert.equal(secondAccept.response.status, 200, secondAccept.text);
  const events = await prisma.applicationStatusEvent.findMany({
    where: { applicationId: completeSeed.application.id, toStatus: 'INTERVIEW' },
  });
  assert.equal(events.length, 1);
});

test('concurrent accept allows only one confirmation', async () => {
  const seeded = await shortlistedApplication('race');
  const created = await createInterview(seeded.company.staffSession, onlineInvite(seeded.application.id));
  const [first, second] = await Promise.all([
    meInterviewAction(seeded.candidate.session, created.json.interview.id, 'accept', {}),
    meInterviewAction(seeded.candidate.session, created.json.interview.id, 'accept', {}),
  ]);
  const statuses = [first.response.status, second.response.status].sort();
  assert.deepEqual(statuses, [200, 409]);
  const stored = await prisma.interview.findUnique({
    where: { id: created.json.interview.id },
    select: { status: true },
  });
  assert.equal(stored.status, 'CONFIRMED');
});

test('role isolation, company ownership and admin stats hide private fields', async () => {
  const seeded = await shortlistedApplication('iso-a', { company: { companyName: 'Alpha Hire', registrationNumber: '1111111-A', email: 'a@alpha.example' } });
  const other = await shortlistedApplication('iso-b', { company: { companyName: 'Beta Hire', registrationNumber: '2222222-B', email: 'b@beta.example' } });
  const created = await createInterview(seeded.company.staffSession, onlineInvite(seeded.application.id));
  const interviewId = created.json.interview.id;
  const otherInvite = await createInterview(other.company.staffSession, onlineInvite(other.application.id));

  const foreignEmployer = await employerInterview(other.company.staffSession, interviewId);
  assert.equal(foreignEmployer.response.status, 404);
  const foreignCandidate = await meInterview(other.candidate.session, interviewId);
  assert.equal(foreignCandidate.response.status, 404);
  const foreignAccept = await meInterviewAction(other.candidate.session, interviewId, 'accept', {});
  assert.equal(foreignAccept.response.status, 404);

  const studentListEmployer = await listEmployerInterviews(seeded.candidate.session);
  assert.equal(studentListEmployer.response.status, 403);
  const staffMine = await listMeInterviews(seeded.company.staffSession);
  assert.equal(staffMine.response.status, 403);

  const admin = await createAdmin('iso-admin');
  const adminSession = sessionOf(admin);
  const adminCreate = await createInterview(adminSession, onlineInvite(seeded.application.id));
  assert.equal(adminCreate.response.status, 403);
  const adminDetail = await employerInterview(adminSession, interviewId);
  assert.equal(adminDetail.response.status, 403);
  const stats = await adminInterviewStats(adminSession);
  assert.equal(stats.response.status, 200, stats.text);
  assert.equal(Number.isInteger(stats.json.total), true);
  assert.deepEqual(Object.keys(stats.json.byStatus).sort(), [...INTERVIEW_STATUSES].sort());
  assert.equal(Number.isInteger(stats.json.companiesWithInterviews), true);
  const statsText = JSON.stringify(stats.json);
  assert.equal(statsText.includes(PRIVATE_NOTE), false);
  assert.equal(statsText.includes(MEETING_LINK), false);
  assert.equal(statsText.includes(seeded.candidate.email), false);

  const companyStats = await employerInterviewStats(seeded.company.staffSession);
  assert.equal(companyStats.response.status, 200, companyStats.text);
  assert.equal(companyStats.json.total >= 1, true);
  assert.equal(companyStats.json.byStatus.PROPOSED >= 1, true);

  const listed = await listEmployerInterviews(seeded.company.staffSession, `?applicationId=${seeded.application.id}`);
  assert.equal(listed.response.status, 200, listed.text);
  assert.equal(listed.json.interviews.length, 1);
  assert.equal(listed.json.interviews[0].id, interviewId);

  const applicationInterview = await employerAction(
    seeded.company.staffSession,
    seeded.application.id,
    'interview',
    {},
  );
  assert.equal(applicationInterview.response.status, 404);

  const bareStaff = await registerStaff('bare');
  const noCompany = await createInterview(sessionOf(bareStaff), onlineInvite(seeded.application.id));
  assert.equal(noCompany.response.status, 403);

  await prisma.user.update({
    where: { email: seeded.company.staff.email },
    data: { accountStatus: 'SUSPENDED' },
  });
  const suspended = await employerInterview(seeded.company.staffSession, interviewId);
  assert.equal(suspended.response.status, 403);
  assert.equal(suspended.json.error, 'Account is unavailable');

  assert.ok(otherInvite.json.interview.id);
});
