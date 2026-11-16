import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { APPLICATION_STORAGE_ENV } from '../src/lib/applicationQuery.js';
import {
  notifyApplicationEvent,
  writeNotifications,
} from '../src/lib/notificationQuery.js';
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

const TEST_EMAIL_PREFIX = 'stage12-ntf-';
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
const REVIEW_NOTE = 'Private reviewer note: keep internal.';
const MEETING_LINK = 'https://meet.example.com/peaceone-stage12';

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
  assert.equal(serialized.includes(PRIVATE_NOTE), false);
  assert.equal(serialized.includes(REVIEW_NOTE), false);
  assert.equal(serialized.includes(MEETING_LINK), false);
  assert.equal(serialized.includes('employerNotes'), false);
  assert.equal(serialized.includes('reviewNote'), false);
  assert.equal(serialized.includes('deduplicationKey'), false);
  assertNoSecrets(payload);
}

async function registerStaff(label) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(
    baseUrl,
    '/api/auth/register',
    primed,
    validRegisterBody(email, { role: 'employer', currentPosition: undefined, fullName: `Staff ${label}` }),
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
      fullName: 'Stage Twelve Admin',
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
      companyName: extras.companyName || 'Notify Labs',
      registrationNumber: extras.registrationNumber || '1212121-N',
      industry: 'Technology',
      companySize: '11-50',
      website: 'www.notifylabs.example',
      email: extras.email || 'hello@notifylabs.example',
      phone: '03-555 0120',
      location: extras.location || 'Kuala Lumpur',
      address: '12 Jalan Utara',
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
    title: 'Notification Engineer',
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
  const company = await putCompany(staffSession, extras.company);
  const created = await requestJson(baseUrl, '/api/me/jobs', {
    method: 'POST',
    csrfToken: staffSession.csrfToken,
    cookies: staffSession.cookies,
    body: validJob(extras.job),
  }).then(trackJob);
  assert.equal(created.response.status, 201, created.text);
  const submitted = await postJson(baseUrl, `/api/me/jobs/${created.json.job.id}/submit`, staffSession, {});
  assert.equal(submitted.response.status, 200, submitted.text);
  return {
    staff,
    staffSession,
    job: submitted.json.job,
    companyId: company.json.company.id,
  };
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

function employerInterviewAction(session, id, action, body = {}) {
  return postJson(baseUrl, `/api/employer/interviews/${id}/${action}`, session, body);
}

function meInterviewAction(session, id, action, body = {}) {
  return postJson(baseUrl, `/api/me/interviews/${id}/${action}`, session, body);
}

function listNotifications(session, query = '') {
  return requestJson(baseUrl, `/api/me/notifications${query}`, { cookies: session.cookies });
}

function listRelatedNotifications(session, applicationId, query = '') {
  const params = new URLSearchParams({ applicationId, page: '1', limit: '20' });
  if (query) {
    const extra = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    for (const [key, value] of extra.entries()) {
      params.set(key, value);
    }
  }
  return requestJson(baseUrl, `/api/me/notifications/related?${params.toString()}`, {
    cookies: session.cookies,
  });
}

function unreadCount(session) {
  return requestJson(baseUrl, '/api/me/notifications/unread-count', { cookies: session.cookies });
}

function markRead(session, id, body = {}) {
  return requestJson(baseUrl, `/api/me/notifications/${id}/read`, {
    method: 'PATCH',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body,
  });
}

function markAllRead(session, body = {}) {
  return requestJson(baseUrl, '/api/me/notifications/read-all', {
    method: 'POST',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body,
  });
}

function typesOf(payload) {
  const notifications = payload?.json?.notifications || payload?.notifications || [];
  return notifications.map((item) => item.type);
}

before(async () => {
  resumeTempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-ntf-resume-'));
  applicationTempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-ntf-storage-'));
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

test('unauthenticated notification routes and CSRF are rejected', async () => {
  const list = await requestJson(baseUrl, '/api/me/notifications');
  assert.equal(list.response.status, 401);
  const count = await requestJson(baseUrl, '/api/me/notifications/unread-count');
  assert.equal(count.response.status, 401);
  const primed = await primeCsrf(baseUrl);
  const mark = await requestJson(baseUrl, `/api/me/notifications/${UNKNOWN_ID}/read`, {
    method: 'PATCH',
    csrfToken: primed.csrfToken,
    cookies: primed.cookies,
    body: {},
  });
  assert.equal(mark.response.status, 401);
  const student = await registerStudent('csrf');
  const session = sessionOf(student);
  const noCsrf = await requestJson(baseUrl, '/api/me/notifications/read-all', {
    method: 'POST',
    cookies: session.cookies,
    body: {},
  });
  assert.equal(noCsrf.response.status, 403);
  assert.equal(noCsrf.json.error, 'Invalid CSRF token');
  const extra = await markAllRead(session, { recipientUserId: student.json.user.id });
  assert.equal(extra.response.status, 400);
});

test('application submission notifies the candidate and every eligible company staff member', async () => {
  const company = await seedPublishedJob('submit');
  const staffB = await registerStaff('submit-b');
  await prisma.user.update({
    where: { id: staffB.json.user.id },
    data: { companyId: company.companyId },
  });
  const staffBSession = sessionOf(staffB);
  const suspended = await registerStaff('submit-sus');
  await prisma.user.update({
    where: { id: suspended.json.user.id },
    data: { companyId: company.companyId, accountStatus: 'SUSPENDED' },
  });
  const outsider = await seedPublishedJob('submit-out', {
    company: { companyName: 'Other Co', registrationNumber: '9999999-O', email: 'other@example.com' },
  });
  const candidate = await seedCandidateResume('submit-cand');
  const seeker = await seedCandidateResume('submit-seek', { seeker: true, fullName: 'Amina Hassan' });
  const admin = await createAdmin('submit-admin');

  const applied = await apply(candidate.session, company.job.id, { resumeId: candidate.resume.id });
  assert.equal(applied.response.status, 201, applied.text);
  assert.equal(applied.json.application.status, 'SUBMITTED');

  const candidateNotes = await listNotifications(candidate.session);
  assert.equal(candidateNotes.response.status, 200, candidateNotes.text);
  assertPayloadSafe(candidateNotes.json);
  assert.deepEqual(typesOf(candidateNotes.json), ['APPLICATION_SUBMITTED']);
  assert.equal(candidateNotes.json.notifications[0].relatedEntityType, 'APPLICATION');
  assert.equal(candidateNotes.json.notifications[0].relatedEntityId, applied.json.application.id);
  assert.match(candidateNotes.json.notifications[0].message, /Notification Engineer/);
  assert.equal(candidateNotes.json.notifications[0].readAt, null);

  const staffANotes = await listNotifications(company.staffSession);
  const staffBNotes = await listNotifications(staffBSession);
  assert.deepEqual(typesOf(staffANotes.json), ['APPLICATION_SUBMITTED']);
  assert.deepEqual(typesOf(staffBNotes.json), ['APPLICATION_SUBMITTED']);
  assert.match(staffANotes.json.notifications[0].message, /new application was received/);
  assert.equal(staffANotes.json.notifications[0].message.includes(candidate.candidate.json.user.email), false);

  const outsiderNotes = await listNotifications(outsider.staffSession);
  assert.deepEqual(typesOf(outsiderNotes.json), []);
  const seekerNotes = await listNotifications(seeker.session);
  assert.deepEqual(typesOf(seekerNotes.json), []);
  const adminNotes = await listNotifications(sessionOf(admin));
  assert.equal(adminNotes.response.status, 200);
  assert.deepEqual(typesOf(adminNotes.json), []);
  const suspendedNotes = await prisma.notification.count({
    where: { recipientUserId: suspended.json.user.id },
  });
  assert.equal(suspendedNotes, 0);

  const duplicate = await apply(candidate.session, company.job.id, { resumeId: candidate.resume.id });
  assert.equal(duplicate.response.status, 409);
  const afterDuplicate = await unreadCount(candidate.session);
  assert.equal(afterDuplicate.json.unreadCount, 1);
});

test('application status notifications reach the candidate only and keep employer notes private', async () => {
  const company = await seedPublishedJob('status');
  const candidate = await seedCandidateResume('status-cand');
  const applied = await apply(candidate.session, company.job.id, { resumeId: candidate.resume.id });
  const reviewed = await employerAction(company.staffSession, applied.json.application.id, 'review', {
    reviewNote: REVIEW_NOTE,
  });
  assert.equal(reviewed.response.status, 200, reviewed.text);
  let notes = await listNotifications(candidate.session);
  assert.deepEqual(typesOf(notes.json), ['APPLICATION_SUBMITTED']);
  let staffNotes = await listNotifications(company.staffSession);
  assert.deepEqual(typesOf(staffNotes.json), ['APPLICATION_SUBMITTED']);

  const shortlisted = await employerAction(company.staffSession, applied.json.application.id, 'shortlist', {
    reviewNote: REVIEW_NOTE,
  });
  assert.equal(shortlisted.response.status, 200, shortlisted.text);
  notes = await listNotifications(candidate.session);
  assert.deepEqual(typesOf(notes.json), ['APPLICATION_SHORTLISTED', 'APPLICATION_SUBMITTED']);
  assertPayloadSafe(notes.json);
  staffNotes = await listNotifications(company.staffSession);
  assert.deepEqual(typesOf(staffNotes.json), ['APPLICATION_SUBMITTED']);

  const again = await employerAction(company.staffSession, applied.json.application.id, 'shortlist', {});
  assert.equal(again.response.status, 409);
  notes = await listNotifications(candidate.session);
  assert.equal(notes.json.notifications.filter((item) => item.type === 'APPLICATION_SHORTLISTED').length, 1);

  const other = await seedPublishedJob('reject');
  const otherCandidate = await seedCandidateResume('reject-cand');
  const otherApplied = await apply(otherCandidate.session, other.job.id, { resumeId: otherCandidate.resume.id });
  const rejected = await employerAction(other.staffSession, otherApplied.json.application.id, 'reject', {
    reviewNote: REVIEW_NOTE,
  });
  assert.equal(rejected.response.status, 200, rejected.text);
  const rejectedNotes = await listNotifications(otherCandidate.session);
  assert.deepEqual(typesOf(rejectedNotes.json), ['APPLICATION_REJECTED', 'APPLICATION_SUBMITTED']);
  assertPayloadSafe(rejectedNotes.json);
});

test('interview invitation, accept, reschedule, cancel and complete notify the right participants', async () => {
  const company = await seedPublishedJob('int');
  const staffB = await registerStaff('int-b');
  await prisma.user.update({
    where: { id: staffB.json.user.id },
    data: { companyId: company.companyId },
  });
  const staffBSession = sessionOf(staffB);
  const candidate = await seedCandidateResume('int-cand');
  const applied = await apply(candidate.session, company.job.id, { resumeId: candidate.resume.id });
  const shortlisted = await employerAction(company.staffSession, applied.json.application.id, 'shortlist', {});
  assert.equal(shortlisted.response.status, 200, shortlisted.text);

  const invited = await createInterview(company.staffSession, {
    applicationId: applied.json.application.id,
    interviewType: 'ONLINE',
    scheduledStartAt: futureIso(72),
    durationMinutes: 45,
    timezone: 'Asia/Kuala_Lumpur',
    meetingLink: MEETING_LINK,
    instructions: 'Join five minutes early.',
    employerNotes: PRIVATE_NOTE,
  });
  assert.equal(invited.response.status, 201, invited.text);
  const interviewId = invited.json.interview.id;
  let candidateNotes = await listNotifications(candidate.session);
  assert.equal(typesOf(candidateNotes.json).includes('INTERVIEW_INVITED'), true);
  assertPayloadSafe(candidateNotes.json);
  let staffNotes = await listNotifications(company.staffSession);
  assert.equal(typesOf(staffNotes.json).includes('INTERVIEW_INVITED'), false);

  const accepted = await meInterviewAction(candidate.session, interviewId, 'accept', {});
  assert.equal(accepted.response.status, 200, accepted.text);
  assert.equal(accepted.json.interview.status, 'CONFIRMED');
  staffNotes = await listNotifications(company.staffSession);
  const staffBNotes = await listNotifications(staffBSession);
  assert.equal(typesOf(staffNotes.json).includes('INTERVIEW_ACCEPTED'), true);
  assert.equal(typesOf(staffBNotes.json).includes('INTERVIEW_ACCEPTED'), true);
  candidateNotes = await listNotifications(candidate.session);
  assert.equal(typesOf(candidateNotes.json).includes('INTERVIEW_ACCEPTED'), false);

  const rescheduled = await meInterviewAction(candidate.session, interviewId, 'reschedule', {
    requestedStartAt: futureIso(96),
    requestedDurationMinutes: 30,
  });
  assert.equal(rescheduled.response.status, 200, rescheduled.text);
  staffNotes = await listNotifications(company.staffSession);
  assert.equal(typesOf(staffNotes.json).includes('INTERVIEW_RESCHEDULE_REQUESTED'), true);

  const confirmed = await employerInterviewAction(company.staffSession, interviewId, 'confirm-reschedule', {});
  assert.equal(confirmed.response.status, 200, confirmed.text);
  candidateNotes = await listNotifications(candidate.session);
  assert.equal(typesOf(candidateNotes.json).includes('INTERVIEW_RESCHEDULE_CONFIRMED'), true);

  const completed = await employerInterviewAction(company.staffSession, interviewId, 'complete', {
    attendance: 'ATTENDED',
    outcome: 'POSITIVE',
    employerNotes: PRIVATE_NOTE,
  });
  assert.equal(completed.response.status, 200, completed.text);
  candidateNotes = await listNotifications(candidate.session);
  staffNotes = await listNotifications(company.staffSession);
  assert.equal(typesOf(candidateNotes.json).includes('INTERVIEW_COMPLETED'), true);
  assert.equal(typesOf(staffNotes.json).includes('INTERVIEW_COMPLETED'), true);
  assertPayloadSafe(candidateNotes.json);
  assertPayloadSafe(staffNotes.json);

  const roundTwo = await seedPublishedJob('cancel');
  const roundCandidate = await seedCandidateResume('cancel-cand');
  const roundApplied = await apply(roundCandidate.session, roundTwo.job.id, { resumeId: roundCandidate.resume.id });
  await employerAction(roundTwo.staffSession, roundApplied.json.application.id, 'shortlist', {});
  const secondInvite = await createInterview(roundTwo.staffSession, {
    applicationId: roundApplied.json.application.id,
    interviewType: 'ONLINE',
    scheduledStartAt: futureIso(80),
    durationMinutes: 30,
    meetingLink: MEETING_LINK,
    employerNotes: PRIVATE_NOTE,
  });
  const cancelled = await employerInterviewAction(
    roundTwo.staffSession,
    secondInvite.json.interview.id,
    'cancel',
    {},
  );
  assert.equal(cancelled.response.status, 200, cancelled.text);
  const cancelCandidateNotes = await listNotifications(roundCandidate.session);
  const cancelStaffNotes = await listNotifications(roundTwo.staffSession);
  assert.equal(typesOf(cancelCandidateNotes.json).includes('INTERVIEW_CANCELLED'), true);
  assert.equal(typesOf(cancelStaffNotes.json).includes('INTERVIEW_CANCELLED'), true);

  const declinedFlow = await seedPublishedJob('decline');
  const declinedCandidate = await seedCandidateResume('decline-cand');
  const declinedApplied = await apply(
    declinedCandidate.session,
    declinedFlow.job.id,
    { resumeId: declinedCandidate.resume.id },
  );
  await employerAction(declinedFlow.staffSession, declinedApplied.json.application.id, 'shortlist', {});
  const declinedInvite = await createInterview(declinedFlow.staffSession, {
    applicationId: declinedApplied.json.application.id,
    interviewType: 'ONLINE',
    scheduledStartAt: futureIso(88),
    durationMinutes: 30,
    meetingLink: MEETING_LINK,
  });
  const declined = await meInterviewAction(
    declinedCandidate.session,
    declinedInvite.json.interview.id,
    'decline',
    {},
  );
  assert.equal(declined.response.status, 200, declined.text);
  const afterDecline = await listNotifications(declinedFlow.staffSession);
  assert.equal(typesOf(afterDecline.json).includes('INTERVIEW_ACCEPTED'), false);
  assert.equal(
    afterDecline.json.notifications.some((item) => item.type.startsWith('INTERVIEW_') && item.type !== 'INTERVIEW_INVITED' && item.relatedEntityId === declinedInvite.json.interview.id),
    false,
  );
});

test('owned notification list, unread count, mark one and mark all stay recipient-scoped', async () => {
  const company = await seedPublishedJob('inbox');
  const candidate = await seedCandidateResume('inbox-cand');
  const other = await seedCandidateResume('inbox-other');
  const applied = await apply(candidate.session, company.job.id, { resumeId: candidate.resume.id });
  await employerAction(company.staffSession, applied.json.application.id, 'shortlist', {});

  const listed = await listNotifications(candidate.session);
  assert.equal(listed.json.notifications.length, 2);
  assert.equal(listed.json.total, 2);
  const newest = listed.json.notifications[0];
  const older = listed.json.notifications[1];
  assert.equal(newest.type, 'APPLICATION_SHORTLISTED');
  assert.equal(older.type, 'APPLICATION_SUBMITTED');
  assert.ok(newest.createdAt >= older.createdAt);

  const unreadOnly = await listNotifications(candidate.session, '?unread=true');
  assert.equal(unreadOnly.json.total, 2);
  const page = await listNotifications(candidate.session, '?page=1&limit=1');
  assert.equal(page.json.notifications.length, 1);
  assert.equal(page.json.page, 1);
  assert.equal(page.json.limit, 1);
  assert.equal(page.json.total, 2);
  assert.equal(page.json.totalPages, 2);
  assert.equal(page.json.notifications[0].id, newest.id);

  const count = await unreadCount(candidate.session);
  assert.equal(count.json.unreadCount, 2);

  const otherMark = await markRead(other.session, newest.id, {});
  assert.equal(otherMark.response.status, 404);
  const stillUnread = await unreadCount(candidate.session);
  assert.equal(stillUnread.json.unreadCount, 2);

  const marked = await markRead(candidate.session, newest.id, {});
  assert.equal(marked.response.status, 200, marked.text);
  assert.ok(marked.json.notification.readAt);
  const afterOne = await unreadCount(candidate.session);
  assert.equal(afterOne.json.unreadCount, 1);
  const again = await markRead(candidate.session, newest.id, {});
  assert.equal(again.response.status, 200);

  const otherAll = await markAllRead(other.session, {});
  assert.equal(otherAll.response.status, 200);
  assert.equal(otherAll.json.updatedCount, 0);
  const candidateStill = await unreadCount(candidate.session);
  assert.equal(candidateStill.json.unreadCount, 1);

  const all = await markAllRead(candidate.session, {});
  assert.equal(all.response.status, 200);
  assert.equal(all.json.updatedCount, 1);
  const empty = await unreadCount(candidate.session);
  assert.equal(empty.json.unreadCount, 0);
  const unreadFilter = await listNotifications(candidate.session, '?unread=true');
  assert.equal(unreadFilter.json.total, 0);

  const invalidId = await markRead(candidate.session, UNKNOWN_ID, {});
  assert.equal(invalidId.response.status, 404);
  const extraField = await markRead(candidate.session, older.id, { actorUserId: company.staff.json.user.id });
  assert.equal(extraField.response.status, 400);

  const staffCount = await unreadCount(company.staffSession);
  assert.ok(staffCount.json.unreadCount >= 1);
});

test('duplicate prevention and transaction failure do not create false notifications', async () => {
  const company = await seedPublishedJob('tx');
  const candidate = await seedCandidateResume('tx-cand');
  const applied = await apply(candidate.session, company.job.id, { resumeId: candidate.resume.id });
  const before = await prisma.notification.count({
    where: { relatedEntityId: applied.json.application.id },
  });
  assert.ok(before >= 2);

  const event = await prisma.applicationStatusEvent.findFirst({
    where: { applicationId: applied.json.application.id, toStatus: 'SUBMITTED' },
  });
  assert.ok(event);
  const candidateUserId = candidate.candidate.json.user.id;
  const retried = await prisma.$transaction(async (tx) => notifyApplicationEvent(tx, {
    event,
    application: {
      id: applied.json.application.id,
      jobId: company.job.id,
      applicantUserId: candidateUserId,
    },
    actorUserId: candidateUserId,
  }));
  assert.equal(retried, 0);
  const afterRetry = await prisma.notification.count({
    where: { relatedEntityId: applied.json.application.id },
  });
  assert.equal(afterRetry, before);

  const rollbackKey = `APPLICATION_SUBMITTED:rollback-${Date.now()}:${candidateUserId}`;
  await assert.rejects(
    () => prisma.$transaction(async (tx) => {
      await writeNotifications(tx, [{
        recipientUserId: candidateUserId,
        actorUserId: company.staff.json.user.id,
        type: 'APPLICATION_SUBMITTED',
        title: 'Forced rollback',
        message: 'This row must not persist.',
        relatedEntityType: 'APPLICATION',
        relatedEntityId: applied.json.application.id,
        deduplicationKey: rollbackKey,
      }]);
      throw new Error('forced-rollback');
    }),
    /forced-rollback/,
  );
  assert.equal(await prisma.notification.count({ where: { deduplicationKey: rollbackKey } }), 0);
  assert.equal(
    await prisma.notification.count({ where: { relatedEntityId: applied.json.application.id } }),
    before,
  );

  const duplicateKey = `APPLICATION_SUBMITTED:dup-${Date.now()}:${candidateUserId}`;
  const row = {
    recipientUserId: candidateUserId,
    actorUserId: company.staff.json.user.id,
    type: 'APPLICATION_SUBMITTED',
    title: 'Dedup',
    message: 'Only one row.',
    relatedEntityType: 'APPLICATION',
    relatedEntityId: applied.json.application.id,
    deduplicationKey: duplicateKey,
  };
  const first = await writeNotifications(prisma, [row]);
  const second = await writeNotifications(prisma, [row]);
  assert.equal(first, 1);
  assert.equal(second, 0);
  assert.equal(await prisma.notification.count({ where: { deduplicationKey: duplicateKey } }), 1);
});

test('four-role delivery persists after login and isolates candidates, companies and admin', async () => {
  const company = await seedPublishedJob('c12');
  const staffB = await registerStaff('c12-b');
  await prisma.user.update({
    where: { id: staffB.json.user.id },
    data: { companyId: company.companyId },
  });
  const outsider = await seedPublishedJob('c12-out', {
    company: { companyName: 'Other Firm', registrationNumber: '8888888-X', email: 'otherfirm@example.com' },
  });
  const student = await seedCandidateResume('c12-stu', { fullName: 'Stage Twelve Student' });
  const seeker = await seedCandidateResume('c12-seek', { seeker: true, fullName: 'Stage Twelve Seeker' });
  const admin = await createAdmin('c12-admin');

  const applied = await apply(student.session, company.job.id, { resumeId: student.resume.id });
  assert.equal(applied.response.status, 201, applied.text);
  await employerAction(company.staffSession, applied.json.application.id, 'shortlist', {});
  const invited = await createInterview(company.staffSession, {
    applicationId: applied.json.application.id,
    interviewType: 'ONLINE',
    scheduledStartAt: futureIso(50),
    durationMinutes: 40,
    timezone: 'Asia/Kuala_Lumpur',
    meetingLink: MEETING_LINK,
    employerNotes: PRIVATE_NOTE,
  });
  assert.equal(invited.response.status, 201, invited.text);
  const accepted = await meInterviewAction(student.session, invited.json.interview.id, 'accept', {});
  assert.equal(accepted.response.status, 200, accepted.text);
  const rescheduled = await meInterviewAction(student.session, invited.json.interview.id, 'reschedule', {
    requestedStartAt: futureIso(70),
    requestedDurationMinutes: 30,
  });
  assert.equal(rescheduled.response.status, 200, rescheduled.text);
  const confirmed = await employerInterviewAction(
    company.staffSession,
    invited.json.interview.id,
    'confirm-reschedule',
    {},
  );
  assert.equal(confirmed.response.status, 200, confirmed.text);

  let studentNotes = await listNotifications(student.session);
  assertPayloadSafe(studentNotes.json);
  const studentTypes = typesOf(studentNotes.json);
  assert.equal(studentTypes.includes('APPLICATION_SUBMITTED'), true);
  assert.equal(studentTypes.includes('APPLICATION_SHORTLISTED'), true);
  assert.equal(studentTypes.includes('INTERVIEW_INVITED'), true);
  assert.equal(studentTypes.includes('INTERVIEW_RESCHEDULE_CONFIRMED'), true);
  assert.equal(studentTypes.includes('INTERVIEW_ACCEPTED'), false);
  const beforeRead = await unreadCount(student.session);
  const newest = studentNotes.json.notifications[0];
  const marked = await markRead(student.session, newest.id, {});
  assert.equal(marked.response.status, 200, marked.text);
  assert.ok(marked.json.notification.readAt);

  const loggedOut = await postJson(baseUrl, '/api/auth/logout', student.session, {});
  assert.equal(loggedOut.response.status, 200);
  const primed = await primeCsrf(baseUrl);
  const loggedIn = await postJson(baseUrl, '/api/auth/login', primed, {
    email: student.candidate.email,
    password: TEST_PASSWORD,
  });
  assert.equal(loggedIn.response.status, 200, loggedIn.text);
  const persistedSession = sessionOf(loggedIn);
  const persistedCount = await unreadCount(persistedSession);
  assert.equal(persistedCount.json.unreadCount, beforeRead.json.unreadCount - 1);
  const persistedList = await listNotifications(persistedSession);
  assert.ok(persistedList.json.notifications.find((item) => item.id === newest.id)?.readAt);
  assertPayloadSafe(persistedList.json);

  const seekerApplied = await apply(seeker.session, company.job.id, { resumeId: seeker.resume.id });
  assert.equal(seekerApplied.response.status, 201, seekerApplied.text);
  await employerAction(company.staffSession, seekerApplied.json.application.id, 'shortlist', {});
  const seekerInvite = await createInterview(company.staffSession, {
    applicationId: seekerApplied.json.application.id,
    interviewType: 'ONLINE',
    scheduledStartAt: futureIso(54),
    durationMinutes: 30,
    meetingLink: MEETING_LINK,
    employerNotes: PRIVATE_NOTE,
  });
  assert.equal(seekerInvite.response.status, 201, seekerInvite.text);

  const seekerNotes = await listNotifications(seeker.session);
  assertPayloadSafe(seekerNotes.json);
  const seekerTypes = typesOf(seekerNotes.json);
  assert.equal(seekerTypes.includes('APPLICATION_SUBMITTED'), true);
  assert.equal(seekerTypes.includes('APPLICATION_SHORTLISTED'), true);
  assert.equal(seekerTypes.includes('INTERVIEW_INVITED'), true);
  assert.equal(seekerNotes.json.notifications.some((item) => item.relatedEntityId === applied.json.application.id), false);
  assert.equal(seekerNotes.json.notifications.some((item) => item.relatedEntityId === invited.json.interview.id), false);

  const studentAfterSeeker = await listNotifications(persistedSession);
  assert.equal(studentAfterSeeker.json.notifications.some((item) => item.relatedEntityId === seekerApplied.json.application.id), false);
  assert.equal(studentAfterSeeker.json.notifications.some((item) => item.relatedEntityId === seekerInvite.json.interview.id), false);

  const steal = await markRead(seeker.session, newest.id, {});
  assert.equal(steal.response.status, 404);
  const foreignApplication = await requestJson(
    baseUrl,
    `/api/me/applications/${applied.json.application.id}`,
    { cookies: seeker.session.cookies },
  );
  assert.equal(foreignApplication.response.status, 404);
  const ownApplication = await requestJson(
    baseUrl,
    `/api/me/applications/${seekerApplied.json.application.id}`,
    { cookies: seeker.session.cookies },
  );
  assert.equal(ownApplication.response.status, 200);
  const ownInterview = await requestJson(
    baseUrl,
    `/api/me/interviews/${seekerInvite.json.interview.id}`,
    { cookies: seeker.session.cookies },
  );
  assert.equal(ownInterview.response.status, 200);
  const studentInterview = await requestJson(
    baseUrl,
    `/api/me/interviews/${invited.json.interview.id}`,
    { cookies: seeker.session.cookies },
  );
  assert.equal(studentInterview.response.status, 404);

  const staffANotes = await listNotifications(company.staffSession);
  const staffBNotes = await listNotifications(sessionOf(staffB));
  assert.equal(staffANotes.json.notifications.filter((item) => item.type === 'APPLICATION_SUBMITTED').length, 2);
  assert.equal(staffBNotes.json.notifications.filter((item) => item.type === 'APPLICATION_SUBMITTED').length, 2);
  assert.equal(staffANotes.json.notifications.some((item) => item.type === 'INTERVIEW_ACCEPTED'), true);
  assert.equal(staffBNotes.json.notifications.some((item) => item.type === 'INTERVIEW_ACCEPTED'), true);
  assert.equal(staffANotes.json.notifications.some((item) => item.type === 'INTERVIEW_RESCHEDULE_REQUESTED'), true);
  assertPayloadSafe(staffANotes.json);
  assertPayloadSafe(staffBNotes.json);

  const outsiderNotes = await listNotifications(outsider.staffSession);
  assert.equal(outsiderNotes.json.notifications.some((item) => (
    item.relatedEntityId === applied.json.application.id
    || item.relatedEntityId === seekerApplied.json.application.id
    || item.relatedEntityId === invited.json.interview.id
  )), false);
  const outsiderApplication = await requestJson(
    baseUrl,
    `/api/employer/applications/${applied.json.application.id}`,
    { cookies: outsider.staffSession.cookies },
  );
  assert.equal(outsiderApplication.response.status === 403 || outsiderApplication.response.status === 404, true);

  const adminSession = sessionOf(admin);
  const adminNotes = await listNotifications(adminSession);
  assert.equal(adminNotes.response.status, 200);
  assert.deepEqual(typesOf(adminNotes.json), []);
  assertPayloadSafe(adminNotes.json);
  const adminApplication = await requestJson(
    baseUrl,
    `/api/employer/applications/${applied.json.application.id}`,
    { cookies: adminSession.cookies },
  );
  assert.equal(adminApplication.response.status === 403 || adminApplication.response.status === 404, true);
  const adminCandidateApplication = await requestJson(
    baseUrl,
    `/api/me/applications/${applied.json.application.id}`,
    { cookies: adminSession.cookies },
  );
  assert.equal(adminCandidateApplication.response.status === 403 || adminCandidateApplication.response.status === 404, true);
});

test('related notifications query the recipient inbox by application without first-page truncation', async () => {
  const company = await seedPublishedJob('related');
  const candidate = await seedCandidateResume('related-cand');
  const other = await seedCandidateResume('related-other');
  const applied = await apply(candidate.session, company.job.id, { resumeId: candidate.resume.id });
  assert.equal(applied.response.status, 201, applied.text);
  const applicationId = applied.json.application.id;
  const fillerIds = [];
  for (let index = 0; index < 25; index += 1) {
    fillerIds.push(randomUUID());
  }
  await writeNotifications(
    prisma,
    fillerIds.map((id, index) => ({
      recipientUserId: candidate.candidate.json.user.id,
      actorUserId: candidate.candidate.json.user.id,
      type: 'APPLICATION_SUBMITTED',
      title: `Filler ${index}`,
      message: 'Unrelated stored notification used to fill earlier pages.',
      relatedEntityType: 'APPLICATION',
      relatedEntityId: id,
      deduplicationKey: `APPLICATION_SUBMITTED:${id}:${candidate.candidate.json.user.id}`,
    })),
  );

  const firstPage = await listNotifications(candidate.session, '?page=1&limit=20');
  assert.equal(firstPage.response.status, 200, firstPage.text);
  assert.equal(
    firstPage.json.notifications.some((item) => item.relatedEntityId === applicationId),
    false,
  );

  const related = await listRelatedNotifications(candidate.session, applicationId);
  assert.equal(related.response.status, 200, related.text);
  assert.equal(related.json.notifications.length, 1);
  assert.equal(related.json.notifications[0].relatedEntityId, applicationId);
  assert.equal(related.json.notifications[0].type, 'APPLICATION_SUBMITTED');
  assertPayloadSafe(related.json);

  const stranger = await listRelatedNotifications(other.session, applicationId);
  assert.equal(stranger.response.status, 200, stranger.text);
  assert.equal(stranger.json.notifications.length, 0);

  const staffRelated = await listRelatedNotifications(company.staffSession, applicationId);
  assert.equal(staffRelated.response.status, 200, staffRelated.text);
  assert.equal(staffRelated.json.notifications.length, 1);
  assert.equal(staffRelated.json.notifications[0].relatedEntityType, 'APPLICATION');
  assert.equal(JSON.stringify(staffRelated.json).includes(REVIEW_NOTE), false);

  const missing = await listRelatedNotifications(candidate.session, 'not-a-uuid');
  assert.equal(missing.response.status, 400);
});

test('suspended accounts cannot read notifications and extra identity fields are ignored', async () => {
  const student = await registerStudent('sus-read', { fullName: 'Suspended Reader' });
  const session = sessionOf(student);
  const listed = await listNotifications(session);
  assert.equal(listed.response.status, 200);
  await prisma.user.update({
    where: { id: student.json.user.id },
    data: { accountStatus: 'SUSPENDED' },
  });
  const blocked = await listNotifications(session);
  assert.equal(blocked.response.status, 403);
  assert.equal(blocked.json.error, 'Account is unavailable');
});
