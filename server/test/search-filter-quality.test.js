import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';
import { closeSessionStore } from '../src/lib/session.js';
import { assertNoSecrets, postJson, primeCsrf, requestJson, TEST_PASSWORD, uniqueEmail } from './helpers.js';

const createdEmails = [];
let server;
let baseUrl;
let adminCookies;
let python;

async function getJson(path, cookies = '') {
  return requestJson(baseUrl, path, { cookies });
}

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  python = await prisma.skill.findFirst({
    where: { preferredLabel: 'Python (computer programming)', sourceSystem: 'ESCO' },
    select: { id: true, sourceUri: true, preferredLabel: true },
  });
  assert.ok(python);

  const adminEmail = uniqueEmail(createdEmails, 'p12-search-', 'admin');
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Prompt Twelve Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  const studentEmail = uniqueEmail(createdEmails, 'p12-search-', 'aisyah');
  await prisma.user.create({
    data: {
      email: studentEmail,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Aisyah Rahman',
      role: 'STUDENT',
      termsAcceptedAt: new Date(),
    },
  });
  const primed = await primeCsrf(baseUrl);
  const login = await postJson(baseUrl, '/api/auth/login', primed, {
    email: adminEmail,
    password: TEST_PASSWORD,
  });
  assert.equal(login.response.status, 200, login.text);
  adminCookies = login.cookies;
});

after(async () => {
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  }
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('ESCO skill search quality matrix keeps identity and empty states', async () => {
  const cases = [
    ['', 200],
    ['%20%20', 200],
    ['python', 200],
    ['PYTHON', 200],
    ['Pyth', 200],
    ['Python (computer programming)', 200],
    [encodeURIComponent("python'; DROP TABLE skills;--"), 200],
    [encodeURIComponent('% OR 1=1'), 200],
    ['zzzz-no-such-skill-label', 200],
  ];

  for (const [q, status] of cases) {
    const result = await getJson(`/api/skills?q=${q}&limit=20`);
    assert.equal(result.response.status, status, q);
    assert.ok(result.json);
    assert.equal(typeof result.json.total, 'number');
    assert.equal(typeof result.json.page, 'number');
    assert.equal(typeof result.json.totalPages, 'number');
    assert.ok(Array.isArray(result.json.items));
    assertNoSecrets(result.json);
  }

  const empty = await getJson('/api/skills?q=zzzz-no-such-skill-label');
  assert.equal(empty.json.total, 0);
  assert.deepEqual(empty.json.items, []);
  assert.equal(empty.json.totalPages, 0);

  const long = await getJson(`/api/skills?q=${'a'.repeat(501)}`);
  assert.equal(long.response.status, 400);

  const page1 = await getJson(`/api/skills?q=python&page=1&limit=5`);
  const page2 = await getJson(`/api/skills?q=python&page=2&limit=5`);
  assert.equal(page1.json.page, 1);
  assert.equal(page1.json.total, page2.json.total);
  if (page1.json.total > 5) {
    assert.equal(page2.json.page, 2);
    const ids = new Set([...page1.json.items, ...page2.json.items].map((item) => item.id));
    assert.equal(ids.size, page1.json.items.length + page2.json.items.length);
  }

  const byFragment = await getJson(`/api/skills?q=${python.sourceUri.split('/').at(-1).slice(0, 8)}`);
  assert.ok(byFragment.json.items.some((item) => item.id === python.id));
});

test('ESCO occupation search combines keyword and ISCO group without dropping identity', async () => {
  const occupation = await prisma.occupation.findFirst({
    where: { sourceSystem: 'ESCO', preferredLabel: { contains: 'software developer', mode: 'insensitive' } },
    select: { id: true, sourceUri: true, preferredLabel: true, sourceMetadata: true },
  });
  assert.ok(occupation);
  const isco = occupation.sourceMetadata?.iscoGroup;
  const listed = await getJson(`/api/occupations?q=${encodeURIComponent(occupation.preferredLabel)}`);
  assert.equal(listed.response.status, 200);
  assert.ok(listed.json.items.some((item) => item.id === occupation.id));

  if (isco) {
    const filtered = await getJson(
      `/api/occupations?q=${encodeURIComponent(occupation.preferredLabel)}&iscoGroup=${encodeURIComponent(isco)}`,
    );
    assert.equal(filtered.response.status, 200);
    assert.ok(filtered.json.items.every((item) => item.iscoGroup === isco));
    assert.ok(filtered.json.items.some((item) => item.id === occupation.id));
  }

  const byUri = await getJson(`/api/occupations?q=${encodeURIComponent(occupation.sourceUri)}`);
  assert.ok(byUri.json.items.some((item) => item.id === occupation.id));
});

test('admin users search Aisyah with STUDENT role', async () => {
  const combined = await getJson(
    `/api/admin/users?q=${encodeURIComponent('Aisyah')}&role=STUDENT`,
    adminCookies,
  );
  assert.equal(combined.response.status, 200, combined.text);
  assert.ok(combined.json.users.some((item) => item.fullName.includes('Aisyah') && item.role === 'STUDENT'));
  assert.equal(combined.json.users.every((item) => item.role === 'STUDENT'), true);

  const mismatch = await getJson(
    `/api/admin/users?q=${encodeURIComponent('Aisyah')}&role=ADMIN`,
    adminCookies,
  );
  assert.equal(mismatch.response.status, 200);
  assert.equal(mismatch.json.users.some((item) => item.fullName.includes('Aisyah')), false);
});

test('admin companies, MASCO, jobs and learning search+filter stay consistent', async () => {
  const companies = await getJson('/api/admin/companies?q=tech&page=1&limit=20', adminCookies);
  assert.equal(companies.response.status, 200, companies.text);
  assert.ok(Array.isArray(companies.json.companies));
  assert.equal(typeof companies.json.total, 'number');

  const accountant = await prisma.mascoOccupationRecord.findFirst({
    where: { title: { contains: 'Accountant', mode: 'insensitive' }, classification: 'MASCO' },
    include: { unitGroup: { select: { code: true } } },
  });
  assert.ok(accountant);
  const masco = await getJson(
    `/api/masco/occupations?q=${encodeURIComponent('Accountant')}&unitGroup=${accountant.unitGroup.code}`,
  );
  assert.equal(masco.response.status, 200, masco.text);
  assert.ok(masco.json.items.some((item) => item.code === accountant.code));
  assert.equal(masco.json.items.every((item) => item.unitGroup.code === accountant.unitGroup.code), true);

  const jobs = await getJson('/api/jobs?q=Junior&employmentType=FULL_TIME&page=1&limit=20');
  assert.equal(jobs.response.status, 200, jobs.text);
  assert.equal(typeof jobs.json.total, 'number');
  assert.ok(Array.isArray(jobs.json.jobs));
  assert.equal(jobs.json.jobs.every((item) => item.employmentType === 'FULL_TIME'), true);

  const learning = await getJson('/api/learning/courses?q=Python&category=DATA_ANALYTICS&page=1&limit=20');
  assert.equal(learning.response.status, 200, learning.text);
  assert.equal(typeof learning.json.total, 'number');
  assert.ok(Array.isArray(learning.json.courses));
  assert.equal(learning.json.courses.every((item) => item.category === 'DATA_ANALYTICS'), true);

  const adminLearning = await getJson(
    '/api/admin/learning/courses?q=SQL&category=DATA_ANALYTICS&page=1&limit=20',
    adminCookies,
  );
  assert.equal(adminLearning.response.status, 200, adminLearning.text);
});
