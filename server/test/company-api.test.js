import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { hashPassword } from '../src/lib/password.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  postJson,
  primeCsrf,
  requestJson,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';

const TEST_EMAIL_PREFIX = 'stage67-co-';
const createdEmails = [];
const createdCompanyIds = [];

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
    companies,
  ] = await Promise.all([
    prisma.occupation.count(),
    prisma.skill.count(),
    prisma.occupationSkillRelation.count(),
    prisma.mascoUnitGroup.count(),
    prisma.mascoOccupationRecord.count(),
    prisma.mascoHistoricalCrosswalk.count(),
    prisma.positionChangeRequest.count(),
    prisma.company.count(),
  ]);
  return {
    occupations,
    skills,
    relations,
    mascoUnitGroups,
    mascoOccupations,
    mascoCrosswalks,
    requests,
    companies,
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
      fullName: 'Stage Six Seven Admin',
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

function getCompany(session) {
  return requestJson(baseUrl, '/api/me/company', { cookies: session.cookies });
}

function putCompany(session, body) {
  return requestJson(baseUrl, '/api/me/company', {
    method: 'PUT',
    csrfToken: session.csrfToken,
    cookies: session.cookies,
    body,
  });
}

function adminGetCompany(session, id) {
  return requestJson(baseUrl, `/api/admin/companies/${id}`, { cookies: session.cookies });
}

const validCompany = {
  companyName: 'Northwind Analytics',
  registrationNumber: '1234567-A',
  industry: 'Technology',
  companySize: '11-50',
  website: 'www.northwind.example',
  email: 'hello@northwind.example',
  phone: '03-555 0100',
  location: 'Petaling Jaya',
  address: '1 Jalan Utara',
  description: 'A reporting studio for Malaysian teams.',
};

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
  if (createdCompanyIds.length > 0) {
    await prisma.company.deleteMany({
      where: { id: { in: createdCompanyIds } },
    });
  }

  const finalSnapshot = await snapshot();
  assert.deepEqual(finalSnapshot, baseline);

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('unauthenticated company requests are rejected', async () => {
  const listed = await requestJson(baseUrl, '/api/me/company');
  assert.equal(listed.response.status, 401);
  assert.equal(listed.json.error, 'Unauthenticated');
  assertNoSecrets(listed.json);

  const primed = await primeCsrf(baseUrl);
  const created = await requestJson(baseUrl, '/api/me/company', {
    method: 'PUT',
    csrfToken: primed.csrfToken,
    cookies: primed.cookies,
    body: validCompany,
  });
  assert.equal(created.response.status, 401);

  const adminDenied = await requestJson(
    baseUrl,
    '/api/admin/companies/aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  );
  assert.equal(adminDenied.response.status, 401);
});

test('students, job seekers and admins cannot manage a staff company profile', async () => {
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
  const admin = await createAdmin('role-admin');

  for (const session of [sessionOf(student), sessionOf(jobSeeker), sessionOf(admin)]) {
    const get = await getCompany(session);
    assert.equal(get.response.status, 403);
    const put = await putCompany(session, validCompany);
    assert.equal(put.response.status, 403);
  }
});

test('company staff can create, read and update only their associated company', async () => {
  const staff = await registerStaff('owner');
  const empty = await getCompany(sessionOf(staff));
  assert.equal(empty.response.status, 200, empty.text);
  assert.equal(empty.json.company, null);

  const created = await putCompany(sessionOf(staff), {
    ...validCompany,
    companyId: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
    id: 'cccccccc-3333-4333-8333-cccccccccccc',
  });
  assert.equal(created.response.status, 400, created.text);

  const saved = await putCompany(sessionOf(staff), validCompany);
  assert.equal(saved.response.status, 201, saved.text);
  assert.equal(saved.json.company.companyName, 'Northwind Analytics');
  assert.equal(saved.json.company.location, 'Petaling Jaya');
  assert.equal(saved.json.company.passwordHash, undefined);
  createdCompanyIds.push(saved.json.company.id);
  assertNoSecrets(saved.json);

  const associated = await prisma.user.findUnique({
    where: { id: staff.json.user.id },
    select: { companyId: true },
  });
  assert.equal(associated.companyId, saved.json.company.id);

  const reloaded = await getCompany(sessionOf(staff));
  assert.equal(reloaded.response.status, 200);
  assert.equal(reloaded.json.company.id, saved.json.company.id);
  assert.equal(reloaded.json.company.website, 'www.northwind.example');

  const updated = await putCompany(sessionOf(staff), {
    ...validCompany,
    companyName: 'Northwind Analytics Sdn Bhd',
    industry: 'Professional services',
  });
  assert.equal(updated.response.status, 200, updated.text);
  assert.equal(updated.json.company.id, saved.json.company.id);
  assert.equal(updated.json.company.companyName, 'Northwind Analytics Sdn Bhd');
  assert.equal(updated.json.company.industry, 'Professional services');

  const persisted = await getCompany(sessionOf(staff));
  assert.equal(persisted.json.company.companyName, 'Northwind Analytics Sdn Bhd');
});

test('staff cannot read or update another company', async () => {
  const first = await registerStaff('iso-a');
  const second = await registerStaff('iso-b');
  const firstSaved = await putCompany(sessionOf(first), {
    ...validCompany,
    companyName: 'Alpha Logistics',
    email: 'alpha@peaceone.test',
  });
  assert.equal(firstSaved.response.status, 201, firstSaved.text);
  createdCompanyIds.push(firstSaved.json.company.id);
  const secondSaved = await putCompany(sessionOf(second), {
    ...validCompany,
    companyName: 'Beta Retail',
    email: 'beta@peaceone.test',
  });
  assert.equal(secondSaved.response.status, 201, secondSaved.text);
  createdCompanyIds.push(secondSaved.json.company.id);

  const firstRead = await getCompany(sessionOf(first));
  assert.equal(firstRead.json.company.companyName, 'Alpha Logistics');
  assert.notEqual(firstRead.json.company.id, secondSaved.json.company.id);

  const secondRead = await getCompany(sessionOf(second));
  assert.equal(secondRead.json.company.companyName, 'Beta Retail');
  assert.notEqual(secondRead.json.company.id, firstSaved.json.company.id);

  const hijack = await putCompany(sessionOf(second), {
    ...validCompany,
    companyName: 'Hijacked Alpha',
    companyId: firstSaved.json.company.id,
  });
  assert.equal(hijack.response.status, 400);

  const firstStill = await getCompany(sessionOf(first));
  assert.equal(firstStill.json.company.companyName, 'Alpha Logistics');
  const secondStill = await getCompany(sessionOf(second));
  assert.equal(secondStill.json.company.companyName, 'Beta Retail');
});

test('admin can read a company and cannot edit through staff endpoints', async () => {
  const staff = await registerStaff('admin-read');
  const saved = await putCompany(sessionOf(staff), {
    ...validCompany,
    companyName: 'Gamma Health',
  });
  assert.equal(saved.response.status, 201, saved.text);
  createdCompanyIds.push(saved.json.company.id);
  const admin = await createAdmin('company-admin');

  const read = await adminGetCompany(sessionOf(admin), saved.json.company.id);
  assert.equal(read.response.status, 200, read.text);
  assert.equal(read.json.company.companyName, 'Gamma Health');
  assertNoSecrets(read.json);

  const missing = await adminGetCompany(sessionOf(admin), 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
  assert.equal(missing.response.status, 404);

  const staffAdmin = await adminGetCompany(sessionOf(staff), saved.json.company.id);
  assert.equal(staffAdmin.response.status, 403);

  const adminPut = await putCompany(sessionOf(admin), validCompany);
  assert.equal(adminPut.response.status, 403);
});

test('invalid payloads and CSRF failures do not write', async () => {
  const staff = await registerStaff('invalid');
  const emptyName = await putCompany(sessionOf(staff), {
    ...validCompany,
    companyName: '',
  });
  assert.equal(emptyName.response.status, 400);

  const badEmail = await putCompany(sessionOf(staff), {
    ...validCompany,
    email: 'not-an-email',
  });
  assert.equal(badEmail.response.status, 400);

  const noCsrf = await requestJson(baseUrl, '/api/me/company', {
    method: 'PUT',
    cookies: staff.cookies,
    body: validCompany,
  });
  assert.equal(noCsrf.response.status, 403);
  assert.equal(noCsrf.json.error, 'Invalid CSRF token');

  const empty = await getCompany(sessionOf(staff));
  assert.equal(empty.json.company, null);
  assert.equal(
    (await prisma.user.findUnique({
      where: { id: staff.json.user.id },
      select: { companyId: true },
    })).companyId,
    null,
  );
});

test('position-change requests still work for staff with a company profile', async () => {
  const staff = await registerStaff('compat');
  await prisma.user.update({
    where: { id: staff.json.user.id },
    data: { jobTitle: 'Coordinator' },
  });
  const saved = await putCompany(sessionOf(staff), {
    ...validCompany,
    companyName: 'Compat Labs',
  });
  assert.equal(saved.response.status, 201, saved.text);
  createdCompanyIds.push(saved.json.company.id);
  const admin = await createAdmin('compat-admin');

  const created = await postJson(baseUrl, '/api/me/position-change-requests', sessionOf(staff), {
    requestedPosition: 'Manager',
    reason: 'Company profile must not block reviews.',
  });
  assert.equal(created.response.status, 201, created.text);
  const approved = await postJson(
    baseUrl,
    `/api/admin/position-change-requests/${created.json.request.id}/approve`,
    sessionOf(admin),
    { reviewNote: 'Still works.' },
  );
  assert.equal(approved.response.status, 200, approved.text);
  assert.equal(
    (await prisma.user.findUnique({
      where: { id: staff.json.user.id },
      select: { jobTitle: true, companyId: true },
    })).jobTitle,
    'Manager',
  );
  const company = await getCompany(sessionOf(staff));
  assert.equal(company.json.company.companyName, 'Compat Labs');
});
