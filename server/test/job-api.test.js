import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { hashPassword } from '../src/lib/password.js';
import {
  COMPANY_PROFILE_REQUIRED,
  JOB_CANNOT_BE_CLOSED,
  JOB_CANNOT_BE_DELETED,
  JOB_CANNOT_BE_PUBLISHED,
  JOB_CANNOT_BE_SUSPENDED,
} from '../src/lib/jobQuery.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';

const TEST_EMAIL_PREFIX = 'stage81-job-';
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

let server;
let baseUrl;
let baseline;
let leftoverUsers;
let leftoverResume;
let ictSafety;
let otherSkill;

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

async function registerStudent(label) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/register', primed, validRegisterBody(email));
  assert.equal(result.response.status, 201, result.text);
  return { email, ...result };
}

async function registerJobSeeker(label) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(
    baseUrl,
    '/api/auth/register',
    primed,
    validRegisterBody(email, { currentPosition: 'jobseeker' }),
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
      fullName: 'Stage Eight One Admin',
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
      registrationNumber: '1234567-A',
      industry: extras.industry || 'Technology',
      companySize: '11-50',
      website: 'www.northwind.example',
      email: 'hello@northwind.example',
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

function listMeJobs(session, query = '') {
  return requestJson(baseUrl, `/api/me/jobs${query}`, { cookies: session.cookies });
}

function getMeJob(session, id) {
  return requestJson(baseUrl, `/api/me/jobs/${id}`, { cookies: session.cookies });
}

function patchJob(session, id, body) {
  return requestJson(baseUrl, `/api/me/jobs/${id}`, {
    method: 'PATCH',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body,
  });
}

function submitJob(session, id, body = {}) {
  return postJson(baseUrl, `/api/me/jobs/${id}/submit`, session, body);
}

function closeMeJob(session, id, body = {}) {
  return postJson(baseUrl, `/api/me/jobs/${id}/close`, session, body);
}

function deleteJob(session, id) {
  return requestJson(baseUrl, `/api/me/jobs/${id}`, {
    method: 'DELETE',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
  });
}

function listCandidateJobs(session, query = '') {
  return requestJson(baseUrl, `/api/jobs${query}`, { cookies: session.cookies });
}

function getCandidateJob(session, id) {
  return requestJson(baseUrl, `/api/jobs/${id}`, { cookies: session.cookies });
}

function listAdminJobs(session, query = '') {
  return requestJson(baseUrl, `/api/admin/jobs${query}`, { cookies: session.cookies });
}

function getAdminJob(session, id) {
  return requestJson(baseUrl, `/api/admin/jobs/${id}`, { cookies: session.cookies });
}

function suspendJob(session, id, body) {
  return postJson(baseUrl, `/api/admin/jobs/${id}/suspend`, session, body);
}

function closeAdminJob(session, id, body = {}) {
  return postJson(baseUrl, `/api/admin/jobs/${id}/close`, session, body);
}

function assertCandidateSafe(payload) {
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('registrationNumber'), false);
  assert.equal(serialized.includes('hello@northwind.example'), false);
  assert.equal(serialized.includes('03-555 0100'), false);
  assert.equal(serialized.includes('1 Jalan Utara'), false);
  assert.equal(serialized.includes('createdByUserId'), false);
  assert.equal(serialized.includes('passwordHash'), false);
  assert.equal(serialized.includes('matchPercent'), false);
  assert.equal(/compatibility/i.test(serialized), false);
  assertNoSecrets(payload);
}

before(async () => {
  baseline = await snapshot();
  leftoverUsers = await loadLeftoverUsers();
  leftoverResume = await loadLeftoverResume();
  ictSafety = await prisma.skill.findFirst({
    where: { sourceUri: ICT_SAFETY_URI, sourceSystem: 'ESCO' },
    select: { id: true, sourceUri: true, preferredLabel: true, skillType: true, sourceSystem: true },
  });
  otherSkill = await prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO', NOT: { sourceUri: ICT_SAFETY_URI } },
    orderBy: { preferredLabel: 'asc' },
    select: { id: true, sourceUri: true, preferredLabel: true, skillType: true, sourceSystem: true },
  });
  assert.ok(ictSafety, 'expected imported ICT safety skill');
  assert.ok(otherSkill, 'expected a second imported ESCO skill');

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
});

test('job foreign keys reject missing company, user and ESCO skill ids', async () => {
  await assert.rejects(
    () => prisma.job.create({
      data: {
        companyId: UNKNOWN_ID,
        createdByUserId: UNKNOWN_ID,
        title: 'Broken',
        description: 'Broken',
        qualificationRequired: 'None',
        experienceRequired: 'None',
        employmentType: 'FULL_TIME',
        location: 'Kuala Lumpur',
      },
    }),
    (error) => error?.code === 'P2003' || error?.name === 'PrismaClientKnownRequestError',
  );

  const staff = await registerStaff('fk-staff');
  await putCompany(sessionOf(staff));
  const user = await prisma.user.findUnique({
    where: { email: staff.email },
    select: { id: true, companyId: true },
  });

  const job = await prisma.job.create({
    data: {
      companyId: user.companyId,
      createdByUserId: user.id,
      title: 'FK Job',
      description: 'Valid company and user',
      qualificationRequired: 'Degree',
      experienceRequired: '1 year',
      employmentType: 'FULL_TIME',
      location: 'Kuala Lumpur',
    },
  });
  createdJobIds.push(job.id);

  await assert.rejects(
    () => prisma.jobSkill.create({
      data: { jobId: job.id, skillId: UNKNOWN_ID, requiredLevel: 'Beginner' },
    }),
    (error) => error?.code === 'P2003' || error?.name === 'PrismaClientKnownRequestError',
  );
});

test('staff without a company cannot create or list jobs', async () => {
  const staff = await registerStaff('no-company');
  const session = sessionOf(staff);
  const created = await createJob(session, validJob());
  assert.equal(created.response.status, 403);
  assert.equal(created.json.error, COMPANY_PROFILE_REQUIRED);

  const listed = await listMeJobs(session);
  assert.equal(listed.response.status, 403);
  assert.equal(listed.json.error, COMPANY_PROFILE_REQUIRED);
});

test('staff can create a draft job with JobSkill and DRAFT status event', async () => {
  const staff = await registerStaff('create');
  const session = sessionOf(staff);
  await putCompany(session);

  const created = await createJob(session, validJob({
    requiredSkills: [
      { skillId: ictSafety.id, requiredLevel: 'Advanced' },
      { skillId: otherSkill.id, requiredLevel: 'Beginner' },
    ],
  }));
  assert.equal(created.response.status, 201, created.text);
  assert.equal(created.json.job.status, 'DRAFT');
  assert.equal(created.json.job.publishedAt, null);
  assert.equal(created.json.job.requiredSkills.length, 2);
  assert.equal(created.json.job.company.companyName, 'Northwind Analytics');
  assert.equal(created.json.job.statusEvents.length, 1);
  assert.equal(created.json.job.statusEvents[0].fromStatus, null);
  assert.equal(created.json.job.statusEvents[0].toStatus, 'DRAFT');
  assertNoSecrets(created.json);

  const storedSkills = await prisma.jobSkill.findMany({ where: { jobId: created.json.job.id } });
  assert.equal(storedSkills.length, 2);
  const events = await prisma.jobStatusEvent.findMany({ where: { jobId: created.json.job.id } });
  assert.equal(events.length, 1);
});

test('duplicate job skills are rejected and unique constraint is enforced', async () => {
  const staff = await registerStaff('dup-skill');
  const session = sessionOf(staff);
  await putCompany(session);

  const duplicated = await createJob(session, validJob({
    requiredSkills: [
      { skillId: ictSafety.id, requiredLevel: 'Beginner' },
      { skillId: ictSafety.id, requiredLevel: 'Advanced' },
    ],
  }));
  assert.equal(duplicated.response.status, 400);
  assert.equal(duplicated.json.error, 'Invalid request');

  const created = await createJob(session, validJob());
  assert.equal(created.response.status, 201, created.text);
  await assert.rejects(
    () => prisma.jobSkill.create({
      data: {
        jobId: created.json.job.id,
        skillId: ictSafety.id,
        requiredLevel: 'Beginner',
      },
    }),
    (error) => error?.code === 'P2002',
  );
});

test('invalid ESCO skill ids and extra fields are rejected', async () => {
  const staff = await registerStaff('invalid-skill');
  const session = sessionOf(staff);
  await putCompany(session);

  const unknownSkill = await createJob(session, validJob({
    requiredSkills: [{ skillId: UNKNOWN_ID, requiredLevel: 'Beginner' }],
  }));
  assert.equal(unknownSkill.response.status, 400);

  const extra = await createJob(session, { ...validJob(), companyId: UNKNOWN_ID });
  assert.equal(extra.response.status, 400);
  const statusSpoof = await createJob(session, { ...validJob(), status: 'PUBLISHED' });
  assert.equal(statusSpoof.response.status, 400);
  const createdBySpoof = await createJob(session, { ...validJob(), createdByUserId: UNKNOWN_ID });
  assert.equal(createdBySpoof.response.status, 400);
  const applicants = await createJob(session, { ...validJob(), applicants: 18 });
  assert.equal(applicants.response.status, 400);
});

test('salary validation rejects inverted and non-integer values', async () => {
  const staff = await registerStaff('salary');
  const session = sessionOf(staff);
  await putCompany(session);

  const inverted = await createJob(session, validJob({ salaryMin: 8000, salaryMax: 4000 }));
  assert.equal(inverted.response.status, 400);
  const negative = await createJob(session, validJob({ salaryMin: -1, salaryMax: 1000 }));
  assert.equal(negative.response.status, 400);
  const fractional = await createJob(session, validJob({ salaryMin: 100.5, salaryMax: 200 }));
  assert.equal(fractional.response.status, 400);
});

test('staff can only manage jobs belonging to their company', async () => {
  const alpha = await registerStaff('alpha');
  const beta = await registerStaff('beta');
  await putCompany(sessionOf(alpha), { companyName: 'Alpha Labs' });
  await putCompany(sessionOf(beta), { companyName: 'Beta Studio' });

  const alphaJob = await createJob(sessionOf(alpha), validJob({ title: 'Alpha Role' }));
  assert.equal(alphaJob.response.status, 201, alphaJob.text);
  const betaListed = await listMeJobs(sessionOf(beta));
  assert.equal(betaListed.response.status, 200);
  assert.equal(betaListed.json.jobs.some((job) => job.id === alphaJob.json.job.id), false);

  const crossGet = await getMeJob(sessionOf(beta), alphaJob.json.job.id);
  assert.equal(crossGet.response.status, 404);
  const crossPatch = await patchJob(sessionOf(beta), alphaJob.json.job.id, { title: 'Hijacked' });
  assert.equal(crossPatch.response.status, 404);
  const crossSubmit = await submitJob(sessionOf(beta), alphaJob.json.job.id);
  assert.equal(crossSubmit.response.status, 404);
  const crossDelete = await deleteJob(sessionOf(beta), alphaJob.json.job.id);
  assert.equal(crossDelete.response.status, 404);
});

test('staff can edit a draft, publish it, and failed publication remains DRAFT', async () => {
  const staff = await registerStaff('publish');
  const session = sessionOf(staff);
  await putCompany(session);

  const incomplete = await createJob(session, validJob({ requiredSkills: [] }));
  assert.equal(incomplete.response.status, 201, incomplete.text);
  const failed = await submitJob(session, incomplete.json.job.id);
  assert.equal(failed.response.status, 400);
  assert.equal(failed.json.error, JOB_CANNOT_BE_PUBLISHED);
  const stillDraft = await prisma.job.findUnique({ where: { id: incomplete.json.job.id } });
  assert.equal(stillDraft.status, 'DRAFT');
  assert.equal(stillDraft.publishedAt, null);

  const created = await createJob(session, validJob());
  const patched = await patchJob(session, created.json.job.id, {
    title: 'Published Analyst',
    requiredSkills: [
      { skillId: ictSafety.id, requiredLevel: 'Advanced' },
      { skillId: otherSkill.id, requiredLevel: 'Intermediate' },
    ],
  });
  assert.equal(patched.response.status, 200, patched.text);
  assert.equal(patched.json.job.title, 'Published Analyst');

  const published = await submitJob(session, created.json.job.id);
  assert.equal(published.response.status, 200, published.text);
  assert.equal(published.json.job.status, 'PUBLISHED');
  assert.ok(published.json.job.publishedAt);
  assert.equal(published.json.job.statusEvents.map((event) => event.toStatus).join(','), 'DRAFT,PUBLISHED');

  const again = await submitJob(session, created.json.job.id);
  assert.equal(again.response.status, 409);
  assert.equal(again.json.error, JOB_CANNOT_BE_PUBLISHED);
});

test('deleting a draft cascades JobSkill rows and preserves published history', async () => {
  const staff = await registerStaff('delete');
  const session = sessionOf(staff);
  await putCompany(session);

  const draft = await createJob(session, validJob());
  const skillCountBefore = await prisma.jobSkill.count({ where: { jobId: draft.json.job.id } });
  assert.equal(skillCountBefore, 1);
  const removed = await deleteJob(session, draft.json.job.id);
  assert.equal(removed.response.status, 200);
  assert.deepEqual(removed.json, { ok: true });
  assert.equal(await prisma.job.count({ where: { id: draft.json.job.id } }), 0);
  assert.equal(await prisma.jobSkill.count({ where: { jobId: draft.json.job.id } }), 0);
  assert.equal(await prisma.jobStatusEvent.count({ where: { jobId: draft.json.job.id } }), 0);

  const live = await createJob(session, validJob({ title: 'Keep History' }));
  const published = await submitJob(session, live.json.job.id);
  assert.equal(published.response.status, 200, published.text);
  const denied = await deleteJob(session, live.json.job.id);
  assert.equal(denied.response.status, 409);
  assert.equal(denied.json.error, JOB_CANNOT_BE_DELETED);
  assert.equal(await prisma.jobStatusEvent.count({ where: { jobId: live.json.job.id } }), 2);
});

test('staff can close a published job and cannot close a draft', async () => {
  const staff = await registerStaff('close');
  const session = sessionOf(staff);
  await putCompany(session);
  const draft = await createJob(session, validJob({ title: 'Draft Close' }));
  const draftClose = await closeMeJob(session, draft.json.job.id);
  assert.equal(draftClose.response.status, 409);
  assert.equal(draftClose.json.error, JOB_CANNOT_BE_CLOSED);

  const created = await createJob(session, validJob({ title: 'Closeable' }));
  const published = await submitJob(session, created.json.job.id);
  assert.equal(published.response.status, 200, published.text);
  const closed = await closeMeJob(session, created.json.job.id);
  assert.equal(closed.response.status, 200, closed.text);
  assert.equal(closed.json.job.status, 'CLOSED');
  const again = await closeMeJob(session, created.json.job.id);
  assert.equal(again.response.status, 409);
});

test('missing CSRF is rejected and identity comes from the session', async () => {
  const staff = await registerStaff('csrf');
  const session = sessionOf(staff);
  await putCompany(session);
  const created = await requestJson(baseUrl, '/api/me/jobs', {
    method: 'POST',
    cookies: session.cookies,
    body: validJob(),
  });
  assert.equal(created.response.status, 403);
  assert.equal(created.json.error, 'Invalid CSRF token');
});

test('students and job seekers cannot create jobs', async () => {
  const student = await registerStudent('student-create');
  const seeker = await registerJobSeeker('seeker-create');
  const studentCreate = await createJob(sessionOf(student), validJob());
  assert.equal(studentCreate.response.status, 403);
  const seekerCreate = await createJob(sessionOf(seeker), validJob());
  assert.equal(seekerCreate.response.status, 403);
});

test('unauthenticated job access returns 401', async () => {
  const listed = await requestJson(baseUrl, '/api/jobs');
  assert.equal(listed.response.status, 401);
  const meListed = await requestJson(baseUrl, '/api/me/jobs');
  assert.equal(meListed.response.status, 401);
  const adminListed = await requestJson(baseUrl, '/api/admin/jobs');
  assert.equal(adminListed.response.status, 401);
  const primed = await primeCsrf(baseUrl);
  const created = await postJson(baseUrl, '/api/me/jobs', primed, validJob());
  assert.equal(created.response.status, 401);
});

test('admin can list jobs, inspect history, suspend and close', async () => {
  const staff = await registerStaff('admin-flow');
  const student = await registerStudent('admin-student');
  const admin = await createAdmin('moderator');
  await putCompany(sessionOf(staff), { companyName: 'Harbor Analytics', industry: 'Data & Analytics' });
  const created = await createJob(sessionOf(staff), validJob({ title: 'Data Analyst', location: 'Shah Alam' }));
  const published = await submitJob(sessionOf(staff), created.json.job.id);
  assert.equal(published.response.status, 200, published.text);

  const forbidden = await listAdminJobs(sessionOf(staff));
  assert.equal(forbidden.response.status, 403);
  const studentAdmin = await listAdminJobs(sessionOf(student));
  assert.equal(studentAdmin.response.status, 403);

  const listed = await listAdminJobs(sessionOf(admin), `?q=${encodeURIComponent('Data Analyst')}&status=PUBLISHED`);
  assert.equal(listed.response.status, 200, listed.text);
  assert.equal(listed.json.jobs.some((job) => job.id === created.json.job.id), true);

  const detail = await getAdminJob(sessionOf(admin), created.json.job.id);
  assert.equal(detail.response.status, 200);
  assert.ok(Array.isArray(detail.json.job.statusEvents));
  assert.equal(detail.json.job.statusEvents.length, 2);

  const missingReason = await suspendJob(sessionOf(admin), created.json.job.id, {});
  assert.equal(missingReason.response.status, 400);
  const suspended = await suspendJob(sessionOf(admin), created.json.job.id, {
    reason: 'Salary wording is misleading.',
  });
  assert.equal(suspended.response.status, 200, suspended.text);
  assert.equal(suspended.json.job.status, 'SUSPENDED');
  const lastEvent = suspended.json.job.statusEvents.at(-1);
  assert.equal(lastEvent.toStatus, 'SUSPENDED');
  assert.equal(lastEvent.note, 'Salary wording is misleading.');

  const studentList = await listCandidateJobs(sessionOf(student));
  assert.equal(studentList.json.jobs.some((job) => job.id === created.json.job.id), false);
  const studentDetail = await getCandidateJob(sessionOf(student), created.json.job.id);
  assert.equal(studentDetail.response.status, 404);

  const closed = await closeAdminJob(sessionOf(admin), created.json.job.id, {
    reason: 'Role filled.',
  });
  assert.equal(closed.response.status, 200, closed.text);
  assert.equal(closed.json.job.status, 'CLOSED');
  assert.equal(closed.json.job.statusEvents.at(-1).fromStatus, 'SUSPENDED');
});

test('candidates see published jobs only and never private company fields', async () => {
  const staff = await registerStaff('candidate-flow');
  const student = await registerStudent('viewer-student');
  const seeker = await registerJobSeeker('viewer-seeker');
  await putCompany(sessionOf(staff), { companyName: 'Nexa Digital', industry: 'Technology' });

  const draft = await createJob(sessionOf(staff), validJob({ title: 'Hidden Draft' }));
  const published = await createJob(sessionOf(staff), validJob({
    title: 'Visible Engineer',
    location: 'Penang',
    employmentType: 'INTERNSHIP',
  }));
  const publishedResult = await submitJob(sessionOf(staff), published.json.job.id);
  assert.equal(publishedResult.response.status, 200, publishedResult.text);

  const closed = await createJob(sessionOf(staff), validJob({ title: 'Closed Role' }));
  await submitJob(sessionOf(staff), closed.json.job.id);
  await closeMeJob(sessionOf(staff), closed.json.job.id);

  const expired = await createJob(sessionOf(staff), validJob({ title: 'Expired Role' }));
  await submitJob(sessionOf(staff), expired.json.job.id);
  await prisma.job.update({
    where: { id: expired.json.job.id },
    data: { closesAt: new Date(Date.now() - 60_000) },
  });

  for (const viewer of [student, seeker]) {
    const listed = await listCandidateJobs(sessionOf(viewer), '?q=Visible&location=Penang&employmentType=INTERNSHIP&industry=Technology');
    assert.equal(listed.response.status, 200, listed.text);
    const ids = listed.json.jobs.map((job) => job.id);
    assert.equal(ids.includes(published.json.job.id), true);
    assert.equal(ids.includes(draft.json.job.id), false);
    assert.equal(ids.includes(closed.json.job.id), false);
    assert.equal(ids.includes(expired.json.job.id), false);
    assertCandidateSafe(listed.json);

    const visible = await getCandidateJob(sessionOf(viewer), published.json.job.id);
    assert.equal(visible.response.status, 200, visible.text);
    assert.equal(visible.json.job.status, 'PUBLISHED');
    assert.equal(visible.json.job.company.companyName, 'Nexa Digital');
    assert.equal(visible.json.job.company.website, 'www.northwind.example');
    assert.equal(visible.json.job.createdByUserId, undefined);
    assertCandidateSafe(visible.json);

    assert.equal((await getCandidateJob(sessionOf(viewer), draft.json.job.id)).response.status, 404);
    assert.equal((await getCandidateJob(sessionOf(viewer), closed.json.job.id)).response.status, 404);
    assert.equal((await getCandidateJob(sessionOf(viewer), expired.json.job.id)).response.status, 404);
  }

  const staffAsCandidate = await listCandidateJobs(sessionOf(staff));
  assert.equal(staffAsCandidate.response.status, 403);
});

test('concurrent publication allows a single PUBLISHED transition', async () => {
  const staff = await registerStaff('race');
  const session = sessionOf(staff);
  await putCompany(session);
  const created = await createJob(session, validJob({ title: 'Race Job' }));
  const [first, second] = await Promise.all([
    submitJob(session, created.json.job.id),
    submitJob(session, created.json.job.id),
  ]);
  const statuses = [first.response.status, second.response.status].sort();
  assert.deepEqual(statuses, [200, 409]);
  const stored = await prisma.job.findUnique({ where: { id: created.json.job.id } });
  assert.equal(stored.status, 'PUBLISHED');
  const events = await prisma.jobStatusEvent.findMany({
    where: { jobId: created.json.job.id, toStatus: 'PUBLISHED' },
  });
  assert.equal(events.length, 1);
});

test('published jobs cannot be republished after close or suspend', async () => {
  const staff = await registerStaff('illegal');
  const admin = await createAdmin('illegal-admin');
  const session = sessionOf(staff);
  await putCompany(session);
  const created = await createJob(session, validJob({ title: 'No Reopen' }));
  await submitJob(session, created.json.job.id);
  await suspendJob(sessionOf(admin), created.json.job.id, { reason: 'Policy breach.' });
  const republish = await submitJob(session, created.json.job.id);
  assert.equal(republish.response.status, 409);
});
