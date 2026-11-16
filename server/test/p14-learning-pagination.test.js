import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { hashPassword } from '../src/lib/password.js';
import { assertSafeDestructiveTestOperation } from '../src/lib/testDatabaseGuard.js';
import { postJson, primeCsrf, requestJson, TEST_PASSWORD, uniqueEmail } from './helpers.js';

const PREFIX = 'p14-synth-';
const createdEmails = [];
const createdIds = [];
const stamp = Date.now();

let server;
let baseUrl;
let adminCookies;

before(async () => {
  const connected = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  assert.equal(connected[0].name, 'peaceone_test');
  await assertSafeDestructiveTestOperation(prisma);

  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  const email = uniqueEmail(createdEmails, 'p14-page-', 'admin');
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Prompt 14 Pagination Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  const primed = await primeCsrf(baseUrl);
  const login = await postJson(baseUrl, '/api/auth/login', primed, {
    email,
    password: TEST_PASSWORD,
  });
  assert.equal(login.response.status, 200, login.text);
  adminCookies = login.cookies;

  for (let i = 1; i <= 25; i += 1) {
    const padded = String(i).padStart(2, '0');
    const row = await prisma.learningContent.create({
      data: {
        slug: `${PREFIX}${stamp}-${padded}`,
        title: `P14 Synthetic Course ${padded}`,
        description: 'Temporary pagination fixture. Isolated to peaceone_test.',
        objectives: ['Pagination stress'],
        category: i % 2 === 0 ? 'DATA_ANALYTICS' : 'SOFTWARE_DEVELOPMENT',
        difficulty: 'BEGINNER',
        estimatedMinutes: 30,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    createdIds.push(row.id);
  }
});

after(async () => {
  await assertSafeDestructiveTestOperation(prisma);
  if (createdIds.length > 0) {
    await prisma.learningContent.deleteMany({ where: { id: { in: createdIds } } });
  }
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  }
  const leftover = await prisma.learningContent.count({
    where: { slug: { startsWith: PREFIX } },
  });
  assert.equal(leftover, 0, 'synthetic pagination fixtures must be removed');
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

async function list(query) {
  const qs = new URLSearchParams(query).toString();
  return requestJson(baseUrl, `/api/admin/learning/courses?${qs}`, { cookies: adminCookies });
}

test('admin learning pagination exceeds page size on peaceone_test only', async () => {
  const page1 = await list({ page: '1', limit: '20', q: `P14 Synthetic Course` });
  assert.equal(page1.response.status, 200, page1.text);
  assert.equal(page1.json.page, 1);
  assert.equal(page1.json.limit, 20);
  assert.ok(page1.json.total >= 25);
  assert.equal(page1.json.courses.length, 20);

  const page2 = await list({ page: '2', limit: '20', q: `P14 Synthetic Course` });
  assert.equal(page2.response.status, 200, page2.text);
  assert.equal(page2.json.page, 2);
  assert.ok(page2.json.courses.length >= 5);

  const ids1 = page1.json.courses.map((item) => item.id);
  const ids2 = page2.json.courses.map((item) => item.id);
  const overlap = ids1.filter((id) => ids2.includes(id));
  assert.equal(overlap.length, 0, 'page 1 and page 2 must not share course ids');

  const lastPage = Math.ceil(page1.json.total / 20);
  const last = await list({ page: String(lastPage), limit: '20', q: `P14 Synthetic Course` });
  assert.equal(last.response.status, 200, last.text);
  assert.equal(last.json.page, lastPage);

  const previous = await list({ page: String(lastPage - 1), limit: '20', q: `P14 Synthetic Course` });
  assert.equal(previous.json.page, lastPage - 1);

  const searchFromPage2 = await list({ page: '2', limit: '20', q: 'P14 Synthetic Course 01' });
  assert.equal(searchFromPage2.response.status, 200, searchFromPage2.text);
  assert.ok(searchFromPage2.json.total >= 1);
  const searchRows = searchFromPage2.json.courses;
  if (searchFromPage2.json.total <= 20) {
    assert.equal(searchFromPage2.json.page, 2);
    assert.ok(
      searchRows.length === 0 || searchRows.every((item) => item.title.includes('01')),
      'narrow search on page 2 may be empty when all matches live on page 1',
    );
  }

  const filtered = await list({
    page: '1',
    limit: '20',
    q: 'P14 Synthetic Course',
    category: 'DATA_ANALYTICS',
  });
  assert.equal(filtered.response.status, 200, filtered.text);
  assert.ok(filtered.json.courses.every((item) => item.category === 'DATA_ANALYTICS'));
  assert.ok(filtered.json.total >= 12);
  assert.ok(filtered.json.total <= 13);

  const empty = await list({ page: '1', limit: '20', q: 'zzzz-p14-no-such-course' });
  assert.equal(empty.json.total, 0);
  assert.deepEqual(empty.json.courses, []);

  const reset = await list({ page: '1', limit: '20', q: 'P14 Synthetic Course' });
  assert.equal(reset.json.page, 1);
  assert.equal(reset.json.courses.length, 20);
});
