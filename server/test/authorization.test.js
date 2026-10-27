import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore, sessionCookieName } from '../src/lib/session.js';
import { hashPassword } from '../src/lib/password.js';
import { requireAuth, requireRole } from '../src/middleware/requireAuth.js';
import {
  TEST_PASSWORD,
  assertNoSecrets,
  cookieValue,
  postJson,
  primeCsrf,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';

const TEST_EMAIL_PREFIX = 'stage45-authz-';
const createdEmails = [];

let server;
let baseUrl;

function registerTestRoutes(app) {
  app.get('/__test__/protected/student', requireAuth, requireRole('STUDENT'), (req, res) => {
    res.status(200).json({ ok: true, role: req.user.role });
  });
  app.get('/__test__/protected/jobseeker', requireAuth, requireRole('JOB_SEEKER'), (req, res) => {
    res.status(200).json({ ok: true, role: req.user.role });
  });
  app.get(
    '/__test__/protected/staff',
    requireAuth,
    requireRole('COMPANY_STAFF'),
    (req, res) => {
      res.status(200).json({ ok: true, role: req.user.role });
    },
  );
  app.get('/__test__/protected/admin', requireAuth, requireRole('ADMIN'), (req, res) => {
    res.status(200).json({ ok: true, role: req.user.role });
  });
  app.post('/__test__/protected/admin', requireAuth, requireRole('ADMIN'), (req, res) => {
    res.status(200).json({ ok: true, role: req.user.role });
  });
}

async function registerAs(extras) {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, extras.label);
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(
    baseUrl,
    '/api/auth/register',
    primed,
    validRegisterBody(email, extras.body),
  );
  assert.equal(result.response.status, 201, result.text);
  return { email, ...result };
}

async function loginAs(email) {
  const primed = await primeCsrf(baseUrl);
  const result = await postJson(baseUrl, '/api/auth/login', primed, {
    email,
    password: TEST_PASSWORD,
    role: 'ADMIN',
    demoRole: 'ADMIN',
  });
  assert.equal(result.response.status, 200, result.text);
  return result;
}

async function getProtected(path, cookies, extraHeaders = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Cookie: cookies, ...extraHeaders },
  });
  const json = await response.json();
  return { response, json };
}

before(async () => {
  server = createApp({ registerTestRoutes }).listen(0, '127.0.0.1');
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
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('requireAuth rejects unauthenticated requests with 401', async () => {
  const me = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(me.status, 401);
  const meBody = await me.json();
  assert.equal(meBody.error, 'Unauthenticated');
  const student = await fetch(`${baseUrl}/__test__/protected/student`);
  assert.equal(student.status, 401);
});

test('role mismatch 403 does not destroy an active session', async () => {
  const student = await registerAs({ label: 'keep-session', body: { currentPosition: 'student' } });
  const denied = await getProtected('/__test__/protected/admin', student.cookies);
  assert.equal(denied.response.status, 403);
  assert.equal(denied.json.error, 'Forbidden');

  const me = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: student.cookies },
  });
  assert.equal(me.status, 200);
  const meBody = await me.json();
  assert.equal(meBody.user.role, 'STUDENT');

  const stillAllowed = await getProtected('/__test__/protected/student', student.cookies);
  assert.equal(stillAllowed.response.status, 200);
});

test('requireRole allows the matching stored role and rejects others with 403', async () => {
  const student = await registerAs({ label: 'student', body: { currentPosition: 'student' } });
  const job = await registerAs({ label: 'job', body: { currentPosition: 'jobseeker' } });
  const staff = await registerAs({
    label: 'staff',
    body: { role: 'employer', currentPosition: undefined },
  });

  const adminEmail = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'admin');
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: 'Stage 45 Admin',
      role: 'ADMIN',
      termsAcceptedAt: new Date(),
    },
  });
  const admin = await loginAs(adminEmail);

  const cases = [
    { cookies: student.cookies, path: '/__test__/protected/student', allowed: true, role: 'STUDENT' },
    { cookies: student.cookies, path: '/__test__/protected/admin', allowed: false },
    { cookies: job.cookies, path: '/__test__/protected/jobseeker', allowed: true, role: 'JOB_SEEKER' },
    { cookies: job.cookies, path: '/__test__/protected/student', allowed: false },
    { cookies: staff.cookies, path: '/__test__/protected/staff', allowed: true, role: 'COMPANY_STAFF' },
    { cookies: staff.cookies, path: '/__test__/protected/admin', allowed: false },
    { cookies: admin.cookies, path: '/__test__/protected/admin', allowed: true, role: 'ADMIN' },
    { cookies: admin.cookies, path: '/__test__/protected/student', allowed: false },
  ];

  for (const item of cases) {
    const result = await getProtected(item.path, item.cookies, { 'x-user-role': 'ADMIN' });
    assertNoSecrets(result.json);
    if (item.allowed) {
      assert.equal(result.response.status, 200);
      assert.equal(result.json.role, item.role);
    } else {
      assert.equal(result.response.status, 403);
      assert.equal(result.json.error, 'Forbidden');
    }
  }
});

test('client-supplied role values cannot grant permissions', async () => {
  const student = await registerAs({ label: 'client-role', body: { currentPosition: 'student' } });
  const stored = await prisma.user.findUnique({
    where: { email: student.json.user.email },
    select: { id: true, role: true },
  });
  assert.equal(stored.role, 'STUDENT');

  const login = await postJson(baseUrl, '/api/auth/login', await primeCsrf(baseUrl), {
    email: student.json.user.email,
    password: TEST_PASSWORD,
    role: 'ADMIN',
    currentPosition: 'admin',
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.json.user.role, 'STUDENT');

  const elevated = await getProtected('/__test__/protected/admin', login.cookies, {
    'x-user-role': 'ADMIN',
  });
  assert.equal(elevated.response.status, 403);

  const sessions = await prisma.session.findMany();
  const matching = sessions.filter((row) => {
    const sess = typeof row.sess === 'string' ? JSON.parse(row.sess) : row.sess;
    return sess?.userId === stored.id;
  });
  assert.ok(matching.length > 0);
  for (const row of matching) {
    const sess = typeof row.sess === 'string' ? JSON.parse(row.sess) : row.sess;
    assert.equal(sess.role, undefined);
    assert.notEqual(sess.userId, 'ADMIN');
  }
});

test('suspended accounts cannot use an existing session', async () => {
  const registered = await registerAs({ label: 'suspended', body: {} });
  await prisma.user.update({
    where: { email: registered.json.user.email },
    data: { accountStatus: 'SUSPENDED' },
  });

  const me = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: registered.cookies },
  });
  assert.equal(me.status, 403);
  const body = await me.json();
  assert.equal(body.error, 'Account is unavailable');

  const protectedRoute = await getProtected('/__test__/protected/student', registered.cookies);
  assert.equal(protectedRoute.response.status, 403);
});

test('session ID regenerates on register and login and logout clears it', async () => {
  const primed = await primeCsrf(baseUrl);
  const before = cookieValue(primed.cookies, sessionCookieName);
  const registered = await postJson(
    baseUrl,
    '/api/auth/register',
    primed,
    validRegisterBody(uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'regen')),
  );
  assert.equal(registered.response.status, 201);
  const afterRegister = cookieValue(registered.cookies, sessionCookieName);
  assert.ok(afterRegister);
  assert.notEqual(afterRegister, before);
  assert.equal(typeof registered.json.csrfToken, 'string');
  assert.notEqual(registered.json.csrfToken, primed.csrfToken);

  const loginPrime = await primeCsrf(baseUrl);
  const loginBefore = cookieValue(loginPrime.cookies, sessionCookieName);
  const login = await postJson(baseUrl, '/api/auth/login', loginPrime, {
    email: registered.json.user.email,
    password: TEST_PASSWORD,
  });
  assert.equal(login.response.status, 200);
  assert.notEqual(cookieValue(login.cookies, sessionCookieName), loginBefore);
  assert.notEqual(login.json.csrfToken, loginPrime.csrfToken);

  const logout = await postJson(
    baseUrl,
    '/api/auth/logout',
    { csrfToken: login.json.csrfToken, cookies: login.cookies },
    {},
  );
  assert.equal(logout.response.status, 200);
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: login.cookies } });
  assert.equal(me.status, 401);
});
