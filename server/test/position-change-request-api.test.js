import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { hashPassword } from '../src/lib/password.js';
import {
  ALREADY_REVIEWED,
  PENDING_EXISTS,
  approvePositionChangeRequest,
} from '../src/lib/positionChangeRequestQuery.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';

const TEST_EMAIL_PREFIX = 'stage66-pcr-';
const createdEmails = [];

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
    requests,
  ] = await Promise.all([
    prisma.occupation.count(),
    prisma.skill.count(),
    prisma.occupationSkillRelation.count(),
    prisma.mascoUnitGroup.count(),
    prisma.mascoOccupationRecord.count(),
    prisma.mascoHistoricalCrosswalk.count(),
    prisma.positionChangeRequest.count(),
  ]);
  return {
    occupations,
    skills,
    relations,
    mascoUnitGroups,
    mascoOccupations,
    mascoCrosswalks,
    requests,
  };
}

async function registerStaff(label, extras = {}) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(
    baseUrl,
    '/api/auth/register',
    primed,
    validRegisterBody(email, { role: 'employer', currentPosition: undefined, ...extras }),
  );
  assert.equal(result.response.status, 201, result.text);
  return { email, ...result };
}

async function registerStudent(label) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/register', primed, validRegisterBody(email));
  assert.equal(result.response.status, 201, result.text);
  return { email, ...result };
}

async function createAdmin(label = 'admin') {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage Six Six Admin',
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

function sessionOf(result) {
  return {
    csrfToken: result.json.csrfToken,
    cookies: result.cookies,
  };
}

function staffList(session) {
  return requestJson(baseUrl, '/api/me/position-change-requests', {
    cookies: session.cookies,
  });
}

function staffGet(session, id) {
  return requestJson(baseUrl, `/api/me/position-change-requests/${id}`, {
    cookies: session.cookies,
  });
}

function staffCreate(session, body) {
  return postJson(baseUrl, '/api/me/position-change-requests', session, body);
}

function adminList(session, search = '') {
  return requestJson(baseUrl, `/api/admin/position-change-requests${search}`, {
    cookies: session.cookies,
  });
}

function adminGet(session, id) {
  return requestJson(baseUrl, `/api/admin/position-change-requests/${id}`, {
    cookies: session.cookies,
  });
}

function adminApprove(session, id, body = {}) {
  return postJson(baseUrl, `/api/admin/position-change-requests/${id}/approve`, session, body);
}

function adminReject(session, id, body = {}) {
  return postJson(baseUrl, `/api/admin/position-change-requests/${id}/reject`, session, body);
}

before(async () => {
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
});

test('unauthenticated position-change requests are rejected', async () => {
  const list = await requestJson(baseUrl, '/api/me/position-change-requests');
  assert.equal(list.response.status, 401);
  assert.equal(list.json.error, 'Unauthenticated');
  assertNoSecrets(list.json);

  const primed = await primeCsrf(baseUrl);
  const created = await postJson(baseUrl, '/api/me/position-change-requests', primed, {
    requestedPosition: 'Hiring Manager',
    reason: 'Promotion',
  });
  assert.equal(created.response.status, 401);

  const adminListDenied = await requestJson(baseUrl, '/api/admin/position-change-requests');
  assert.equal(adminListDenied.response.status, 401);
});

test('students, job seekers and staff cannot use the other role endpoints', async () => {
  const student = await registerStudent('student');
  const jobSeekerEmail = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'jobseeker');
  const primedSeeker = await primeCsrf(baseUrl);
  const jobSeeker = await postJson(
    baseUrl,
    '/api/auth/register',
    primedSeeker,
    validRegisterBody(jobSeekerEmail, { currentPosition: 'jobseeker' }),
  );
  assert.equal(jobSeeker.response.status, 201, jobSeeker.text);
  const staff = await registerStaff('role-staff');
  const admin = await createAdmin('role-admin');

  const studentList = await staffList(sessionOf(student));
  assert.equal(studentList.response.status, 403);
  assert.equal(studentList.json.error, 'Forbidden');

  const studentAdmin = await adminList(sessionOf(student));
  assert.equal(studentAdmin.response.status, 403);

  const seekerList = await staffList(sessionOf(jobSeeker));
  assert.equal(seekerList.response.status, 403);

  const seekerAdmin = await adminList(sessionOf(jobSeeker));
  assert.equal(seekerAdmin.response.status, 403);

  const staffAdmin = await adminList(sessionOf(staff));
  assert.equal(staffAdmin.response.status, 403);

  const adminStaff = await staffList(sessionOf(admin));
  assert.equal(adminStaff.response.status, 403);
});

test('company staff can create and list only their own requests', async () => {
  const staff = await registerStaff('owner');
  await prisma.user.update({
    where: { id: staff.json.user.id },
    data: { jobTitle: 'Talent Partner' },
  });
  const other = await registerStaff('other');
  await prisma.user.update({
    where: { id: other.json.user.id },
    data: { jobTitle: 'Recruiter' },
  });

  const created = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Hiring Manager',
    reason: 'Expanded hiring scope.',
    userId: other.json.user.id,
    status: 'APPROVED',
    reviewedBy: other.json.user.id,
  });
  assert.equal(created.response.status, 400, created.text);

  const valid = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Hiring Manager',
    reason: 'Expanded hiring scope.',
  });
  assert.equal(valid.response.status, 201, valid.text);
  assert.equal(valid.json.request.requestedPosition, 'Hiring Manager');
  assert.equal(valid.json.request.currentPosition, 'Talent Partner');
  assert.equal(valid.json.request.status, 'PENDING');
  assert.equal(valid.json.request.user.id, staff.json.user.id);
  assert.equal(valid.json.request.reviewer, null);
  assert.equal(valid.json.request.passwordHash, undefined);
  assertNoSecrets(valid.json);

  const otherCreate = await staffCreate(sessionOf(other), {
    requestedPosition: 'People Lead',
    reason: 'Team growth.',
  });
  assert.equal(otherCreate.response.status, 201, otherCreate.text);

  const ownList = await staffList(sessionOf(staff));
  assert.equal(ownList.response.status, 200);
  assert.equal(ownList.json.items.length, 1);
  assert.equal(ownList.json.items[0].id, valid.json.request.id);
  assert.equal(
    ownList.json.items.some((item) => item.id === otherCreate.json.request.id),
    false,
  );

  const otherOwned = await staffGet(sessionOf(staff), otherCreate.json.request.id);
  assert.equal(otherOwned.response.status, 404);
  assert.equal(otherOwned.json.error, 'Not found');

  const ownGet = await staffGet(sessionOf(staff), valid.json.request.id);
  assert.equal(ownGet.response.status, 200);
  assert.equal(ownGet.json.request.id, valid.json.request.id);
});

test('duplicate pending requests are rejected and later requests are allowed after review', async () => {
  const staff = await registerStaff('dup');
  await prisma.user.update({
    where: { id: staff.json.user.id },
    data: { jobTitle: 'Analyst' },
  });
  const admin = await createAdmin('dup-admin');

  const first = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Senior Analyst',
    reason: 'First request.',
  });
  assert.equal(first.response.status, 201, first.text);

  const duplicate = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Lead Analyst',
    reason: 'Second pending request.',
  });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.json.error, PENDING_EXISTS);

  const rejected = await adminReject(sessionOf(admin), first.json.request.id, {
    reviewNote: 'Need more detail.',
  });
  assert.equal(rejected.response.status, 200, rejected.text);
  assert.equal(rejected.json.request.status, 'REJECTED');

  const storedJob = await prisma.user.findUnique({
    where: { id: staff.json.user.id },
    select: { jobTitle: true },
  });
  assert.equal(storedJob.jobTitle, 'Analyst');

  const second = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Lead Analyst',
    reason: 'Follow-up request.',
  });
  assert.equal(second.response.status, 201, second.text);
  assert.equal(second.json.request.status, 'PENDING');
});

test('admin can list, search, approve and reject requests', async () => {
  const staff = await registerStaff('review');
  await prisma.user.update({
    where: { id: staff.json.user.id },
    data: { jobTitle: 'Coordinator', fullName: 'Stage Six Six Review Staff' },
  });
  const other = await registerStaff('review-other');
  const admin = await createAdmin('review-admin');

  const pending = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Operations Lead',
    reason: 'Ready for a lead role.',
  });
  assert.equal(pending.response.status, 201, pending.text);
  const otherPending = await staffCreate(sessionOf(other), {
    requestedPosition: 'Recruiter II',
    reason: 'Title correction.',
  });
  assert.equal(otherPending.response.status, 201, otherPending.text);

  const listed = await adminList(sessionOf(admin), '?status=PENDING&limit=20&page=1');
  assert.equal(listed.response.status, 200, listed.text);
  assert.equal(listed.json.items.some((item) => item.id === pending.json.request.id), true);
  assert.equal(typeof listed.json.total, 'number');
  assert.equal(listed.json.page, 1);

  const searched = await adminList(
    sessionOf(admin),
    `?q=${encodeURIComponent('Six Six Review Staff')}`,
  );
  assert.equal(searched.response.status, 200, searched.text);
  assert.equal(searched.json.items.length >= 1, true);
  assert.equal(
    searched.json.items.every((item) => item.user.fullName.includes('Review Staff')),
    true,
  );

  const details = await adminGet(sessionOf(admin), pending.json.request.id);
  assert.equal(details.response.status, 200);
  assert.equal(details.json.request.reason, 'Ready for a lead role.');
  assertNoSecrets(details.json);

  const approved = await adminApprove(sessionOf(admin), pending.json.request.id, {
    reviewNote: 'Approved after discussion.',
  });
  assert.equal(approved.response.status, 200, approved.text);
  assert.equal(approved.json.request.status, 'APPROVED');
  assert.equal(approved.json.request.reviewNote, 'Approved after discussion.');
  assert.equal(approved.json.request.reviewer.id, admin.json.user.id);
  assert.equal(typeof approved.json.request.reviewedAt, 'string');

  const afterApprove = await prisma.user.findUnique({
    where: { id: staff.json.user.id },
    select: { jobTitle: true },
  });
  assert.equal(afterApprove.jobTitle, 'Operations Lead');

  const staffHistory = await staffList(sessionOf(staff));
  assert.equal(staffHistory.json.items[0].status, 'APPROVED');
  assert.equal(staffHistory.json.items[0].reviewNote, 'Approved after discussion.');

  const rejected = await adminReject(sessionOf(admin), otherPending.json.request.id, {});
  assert.equal(rejected.response.status, 200, rejected.text);
  assert.equal(rejected.json.request.status, 'REJECTED');
  const otherJob = await prisma.user.findUnique({
    where: { id: other.json.user.id },
    select: { jobTitle: true },
  });
  assert.equal(otherJob.jobTitle, null);
});

test('PATCH /api/me cannot change jobTitle; only admin approval updates it', async () => {
  const staff = await registerStaff('patch-title');
  await prisma.user.update({
    where: { id: staff.json.user.id },
    data: { jobTitle: 'Coordinator' },
  });
  const admin = await createAdmin('patch-title-admin');

  const denied = await requestJson(baseUrl, '/api/me', {
    method: 'PATCH',
    csrfToken: sessionOf(staff).csrfToken,
    cookies: sessionOf(staff).cookies,
    body: { jobTitle: 'Director' },
  });
  assert.equal(denied.response.status, 400);
  assert.equal(denied.json.error, 'Invalid request');
  assert.equal(
    (await prisma.user.findUnique({
      where: { id: staff.json.user.id },
      select: { jobTitle: true },
    })).jobTitle,
    'Coordinator',
  );

  const created = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Director',
    reason: 'Promotion via review only.',
  });
  assert.equal(created.response.status, 201, created.text);

  const approved = await adminApprove(sessionOf(admin), created.json.request.id, {
    reviewNote: 'Approved.',
  });
  assert.equal(approved.response.status, 200, approved.text);
  assert.equal(approved.json.request.status, 'APPROVED');
  assert.equal(
    (await prisma.user.findUnique({
      where: { id: staff.json.user.id },
      select: { jobTitle: true },
    })).jobTitle,
    'Director',
  );
});

test('already reviewed requests cannot be reviewed again', async () => {
  const staff = await registerStaff('repeat');
  const admin = await createAdmin('repeat-admin');
  const created = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Team Lead',
    reason: 'One-time review.',
  });
  assert.equal(created.response.status, 201, created.text);

  const first = await adminApprove(sessionOf(admin), created.json.request.id, {
    reviewNote: 'First approval.',
  });
  assert.equal(first.response.status, 200, first.text);

  const second = await adminReject(sessionOf(admin), created.json.request.id, {
    reviewNote: 'Should not apply.',
  });
  assert.equal(second.response.status, 409);
  assert.equal(second.json.error, ALREADY_REVIEWED);

  const stored = await prisma.positionChangeRequest.findUnique({
    where: { id: created.json.request.id },
  });
  assert.equal(stored.status, 'APPROVED');
  assert.equal(stored.reviewNote, 'First approval.');
});

test('concurrent reviews keep a single winner and leave history intact', async () => {
  const staff = await registerStaff('race');
  await prisma.user.update({
    where: { id: staff.json.user.id },
    data: { jobTitle: 'Associate' },
  });
  const admin = await createAdmin('race-admin');
  const created = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Manager',
    reason: 'Concurrent review.',
  });
  assert.equal(created.response.status, 201, created.text);

  const [first, second] = await Promise.all([
    adminApprove(sessionOf(admin), created.json.request.id, { reviewNote: 'A' }),
    adminReject(sessionOf(admin), created.json.request.id, { reviewNote: 'B' }),
  ]);
  const statuses = [first.response.status, second.response.status].sort();
  assert.deepEqual(statuses, [200, 409]);

  const stored = await prisma.positionChangeRequest.findUnique({
    where: { id: created.json.request.id },
  });
  assert.equal(['APPROVED', 'REJECTED'].includes(stored.status), true);
  const user = await prisma.user.findUnique({
    where: { id: staff.json.user.id },
    select: { jobTitle: true },
  });
  if (stored.status === 'APPROVED') {
    assert.equal(user.jobTitle, 'Manager');
  } else {
    assert.equal(user.jobTitle, 'Associate');
  }

  const history = await staffList(sessionOf(staff));
  assert.equal(history.json.items.length, 1);
  assert.equal(history.json.items[0].id, created.json.request.id);
});

test('approval rolls back when the job title update fails', async () => {
  const staff = await registerStaff('rollback');
  await prisma.user.update({
    where: { id: staff.json.user.id },
    data: { jobTitle: 'Specialist' },
  });
  const admin = await createAdmin('rollback-admin');
  const created = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Principal Specialist',
    reason: 'Rollback case.',
  });
  assert.equal(created.response.status, 201, created.text);

  const failingPrisma = prisma.$extends({
    query: {
      user: {
        async update() {
          throw new Error('forced-approval-failure');
        },
      },
    },
  });

  await assert.rejects(
    () => approvePositionChangeRequest(failingPrisma, {
      requestId: created.json.request.id,
      reviewerId: admin.json.user.id,
      reviewNote: 'Should roll back.',
    }),
    (error) => error instanceof Error && error.message === 'forced-approval-failure',
  );

  const stored = await prisma.positionChangeRequest.findUnique({
    where: { id: created.json.request.id },
  });
  assert.equal(stored.status, 'PENDING');
  assert.equal(stored.reviewedById, null);
  assert.equal(stored.reviewNote, null);
  const user = await prisma.user.findUnique({
    where: { id: staff.json.user.id },
    select: { jobTitle: true },
  });
  assert.equal(user.jobTitle, 'Specialist');
});

test('mutations without a valid CSRF token are rejected', async () => {
  const staff = await registerStaff('csrf');
  const created = await requestJson(baseUrl, '/api/me/position-change-requests', {
    method: 'POST',
    cookies: staff.cookies,
    body: {
      requestedPosition: 'Director',
      reason: 'Missing CSRF.',
    },
  });
  assert.equal(created.response.status, 403);
  assert.equal(created.json.error, 'Invalid CSRF token');

  const admin = await createAdmin('csrf-admin');
  const valid = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Director',
    reason: 'Needs CSRF on review.',
  });
  assert.equal(valid.response.status, 201, valid.text);

  const approve = await requestJson(
    baseUrl,
    `/api/admin/position-change-requests/${valid.json.request.id}/approve`,
    {
      method: 'POST',
      cookies: admin.cookies,
      body: { reviewNote: 'No CSRF' },
    },
  );
  assert.equal(approve.response.status, 403);
  assert.equal(approve.json.error, 'Invalid CSRF token');
});

test('invalid payloads and ids are rejected and do not write', async () => {
  const staff = await registerStaff('invalid');
  await prisma.user.update({
    where: { id: staff.json.user.id },
    data: { jobTitle: 'Executive' },
  });
  const admin = await createAdmin('invalid-admin');

  const empty = await staffCreate(sessionOf(staff), {
    requestedPosition: '',
    reason: '',
  });
  assert.equal(empty.response.status, 400);

  const same = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Executive',
    reason: 'Same as current.',
  });
  assert.equal(same.response.status, 400);

  const extra = await staffCreate(sessionOf(staff), {
    requestedPosition: 'Director',
    reason: 'Extra field.',
    currentPosition: 'Invented',
  });
  assert.equal(extra.response.status, 400);

  const before = await prisma.positionChangeRequest.count({
    where: { userId: staff.json.user.id },
  });
  assert.equal(before, 0);

  const unknown = await adminApprove(sessionOf(admin), 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', {});
  assert.equal(unknown.response.status, 404);

  const badId = await adminList(sessionOf(admin), '?status=NOPE');
  assert.equal(badId.response.status, 400);
});
