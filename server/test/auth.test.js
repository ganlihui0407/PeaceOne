import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore, sessionCookieName } from '../src/lib/session.js';

const TEST_EMAIL_PREFIX = 'stage43-';
const TEST_PASSWORD = 'ValidPass1';

let server;
let baseUrl;
const createdEmails = [];

function cookieHeader(response, previous = '') {
  const jar = new Map();
  for (const part of previous.split(';').map((item) => item.trim()).filter(Boolean)) {
    const name = part.split('=')[0];
    jar.set(name, part);
  }
  for (const setCookie of response.headers.getSetCookie()) {
    const pair = setCookie.split(';')[0];
    jar.set(pair.split('=')[0], pair);
  }
  return [...jar.values()].join('; ');
}

function cookieValue(cookies, name) {
  const match = cookies
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

function uniqueEmail(label) {
  const email = `${TEST_EMAIL_PREFIX}${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@peaceone.test`;
  createdEmails.push(email);
  return email;
}

async function primeCsrf() {
  const response = await fetch(`${baseUrl}/api/csrf-token`);
  const { csrfToken } = await response.json();
  return { csrfToken, cookies: cookieHeader(response) };
}

async function postAuth(path, { csrfToken, cookies }, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Cookie: cookies,
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { response, json, cookies: cookieHeader(response, cookies) };
}

function validRegisterBody(email, extras = {}) {
  return {
    fullName: 'Stage Four Three',
    email,
    password: TEST_PASSWORD,
    confirmPassword: TEST_PASSWORD,
    phone: '012-345 6789',
    role: 'student-jobseeker',
    currentPosition: 'student',
    terms: true,
    ...extras,
  };
}

before(async () => {
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
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('register persists a hashed student and returns a safe profile', async () => {
  const primed = await primeCsrf();
  const email = uniqueEmail('register');
  const sessionBefore = cookieValue(primed.cookies, sessionCookieName);

  const { response, json, cookies } = await postAuth('/api/auth/register', primed, validRegisterBody(email));
  assert.equal(response.status, 201);
  assert.equal(json.user.email, email);
  assert.equal(json.user.fullName, 'Stage Four Three');
  assert.equal(json.user.role, 'STUDENT');
  assert.equal(json.user.accountStatus, 'ACTIVE');
  assert.equal(json.user.passwordHash, undefined);
  assert.ok(!JSON.stringify(json).includes(TEST_PASSWORD));
  assert.ok(!JSON.stringify(json).includes('$2'));
  assert.equal(typeof json.csrfToken, 'string');

  const stored = await prisma.user.findUnique({ where: { email } });
  assert.ok(stored);
  assert.notEqual(stored.passwordHash, TEST_PASSWORD);
  assert.match(stored.passwordHash, /^\$2[aby]?\$/);
  assert.ok(stored.termsAcceptedAt);

  const sessionAfter = cookieValue(cookies, sessionCookieName);
  assert.ok(sessionAfter);
  assert.notEqual(sessionAfter, sessionBefore);

  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookies } });
  assert.equal(me.status, 200);
  const meBody = await me.json();
  assert.equal(meBody.user.id, stored.id);
  assert.equal(meBody.user.passwordHash, undefined);
});

test('register maps job seeker and company staff roles', async () => {
  const jobEmail = uniqueEmail('jobseeker');
  const staffEmail = uniqueEmail('staff');

  const job = await postAuth(
    '/api/auth/register',
    await primeCsrf(),
    validRegisterBody(jobEmail, { currentPosition: 'jobseeker' }),
  );
  assert.equal(job.response.status, 201);
  assert.equal(job.json.user.role, 'JOB_SEEKER');

  const staff = await postAuth(
    '/api/auth/register',
    await primeCsrf(),
    validRegisterBody(staffEmail, { role: 'employer', currentPosition: undefined }),
  );
  assert.equal(staff.response.status, 201);
  assert.equal(staff.json.user.role, 'COMPANY_STAFF');
});

test('register rejects duplicate email, invalid input, missing terms and ADMIN', async () => {
  const email = uniqueEmail('dup');
  const first = await postAuth('/api/auth/register', await primeCsrf(), validRegisterBody(email));
  assert.equal(first.response.status, 201);

  const duplicate = await postAuth('/api/auth/register', await primeCsrf(), validRegisterBody(email));
  assert.equal(duplicate.response.status, 409);

  const mismatch = await postAuth(
    '/api/auth/register',
    await primeCsrf(),
    validRegisterBody(uniqueEmail('mismatch'), { confirmPassword: 'Different1' }),
  );
  assert.equal(mismatch.response.status, 400);

  const shortPassword = await postAuth(
    '/api/auth/register',
    await primeCsrf(),
    validRegisterBody(uniqueEmail('short'), { password: 'short', confirmPassword: 'short' }),
  );
  assert.equal(shortPassword.response.status, 400);

  const badEmail = await postAuth(
    '/api/auth/register',
    await primeCsrf(),
    validRegisterBody('not-an-email', { email: 'not-an-email' }),
  );
  assert.equal(badEmail.response.status, 400);

  const noTerms = await postAuth(
    '/api/auth/register',
    await primeCsrf(),
    validRegisterBody(uniqueEmail('terms'), { terms: false }),
  );
  assert.equal(noTerms.response.status, 400);

  const adminEmail = uniqueEmail('admin');
  const admin = await postAuth(
    '/api/auth/register',
    await primeCsrf(),
    validRegisterBody(adminEmail, { role: 'admin' }),
  );
  assert.equal(admin.response.status, 403);
  assert.equal(await prisma.user.findUnique({ where: { email: adminEmail } }), null);
});

test('login succeeds, ignores client role, and uses generic errors', async () => {
  const email = uniqueEmail('login');
  await postAuth('/api/auth/register', await primeCsrf(), validRegisterBody(email));

  const unknown = await postAuth(
    '/api/auth/login',
    await primeCsrf(),
    { email: uniqueEmail('missing'), password: TEST_PASSWORD },
  );
  const wrong = await postAuth(
    '/api/auth/login',
    await primeCsrf(),
    { email, password: 'WrongPass1' },
  );
  assert.equal(unknown.response.status, 401);
  assert.equal(wrong.response.status, 401);
  assert.equal(unknown.json.error, wrong.json.error);
  assert.equal(unknown.json.error, 'Invalid email or password');

  const primed = await primeCsrf();
  const sessionBefore = cookieValue(primed.cookies, sessionCookieName);
  const success = await postAuth('/api/auth/login', primed, {
    email,
    password: TEST_PASSWORD,
    rememberMe: false,
    role: 'admin',
    demoRole: 'admin',
  });
  assert.equal(success.response.status, 200);
  assert.equal(success.json.user.role, 'STUDENT');
  assert.equal(success.json.user.passwordHash, undefined);
  assert.notEqual(cookieValue(success.cookies, sessionCookieName), sessionBefore);
  const sessionCookies = success.response.headers.getSetCookie().join('; ');
  assert.doesNotMatch(sessionCookies, /Max-Age=/i);

  const remembered = await postAuth(
    '/api/auth/login',
    await primeCsrf(),
    { email, password: TEST_PASSWORD, rememberMe: true },
  );
  assert.equal(remembered.response.status, 200);
  const rememberedCookies = remembered.response.headers.getSetCookie().join('; ');
  assert.match(rememberedCookies, /Max-Age=|Expires=/i);
});

test('me requires a session and logout destroys it', async () => {
  const unauthenticated = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(unauthenticated.status, 401);

  const email = uniqueEmail('logout');
  const registered = await postAuth('/api/auth/register', await primeCsrf(), validRegisterBody(email));
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: registered.cookies } });
  assert.equal(me.status, 200);

  const logoutNoCsrf = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Cookie: registered.cookies,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  assert.equal(logoutNoCsrf.status, 403);

  const logout = await postAuth('/api/auth/logout', {
    csrfToken: registered.json.csrfToken,
    cookies: registered.cookies,
  }, {});
  assert.equal(logout.response.status, 200);

  const afterLogout = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: registered.cookies } });
  assert.equal(afterLogout.status, 401);
});

test('suspended users cannot log in', async () => {
  const email = uniqueEmail('suspended');
  await postAuth('/api/auth/register', await primeCsrf(), validRegisterBody(email));
  await prisma.user.update({
    where: { email },
    data: { accountStatus: 'SUSPENDED' },
  });

  const login = await postAuth(
    '/api/auth/login',
    await primeCsrf(),
    { email, password: TEST_PASSWORD },
  );
  assert.equal(login.response.status, 403);
});

test('register without CSRF is rejected', async () => {
  const primed = await primeCsrf();
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      Cookie: primed.cookies,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(validRegisterBody(uniqueEmail('csrf'))),
  });
  assert.equal(response.status, 403);
});

test('Vite proxy forwards health when the frontend dev server is running', async () => {
  try {
    const response = await fetch('http://127.0.0.1:5173/api/health', { signal: AbortSignal.timeout(1500) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.database, 'ok');
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.code === 'ECONNREFUSED' || err?.cause?.code === 'ECONNREFUSED') {
      return;
    }
    throw err;
  }
});
