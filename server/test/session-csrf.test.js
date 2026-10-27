import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore, sessionCookieName } from '../src/lib/session.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';

let server;
let baseUrl;

function cookieHeader(response) {
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
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
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([prisma.$disconnect(), closeSessionStore()]);
});

test('bcryptjs hashes and verifies on this platform', async () => {
  const hashed = await hashPassword('stage-4-2-check');
  assert.notEqual(hashed, 'stage-4-2-check');
  assert.equal(await verifyPassword('stage-4-2-check', hashed), true);
  assert.equal(await verifyPassword('wrong', hashed), false);
});

test('GET /api/csrf-token issues a token, session cookie, and persists the session', async () => {
  const response = await fetch(`${baseUrl}/api/csrf-token`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(typeof body.csrfToken, 'string');
  assert.ok(body.csrfToken.length > 10);

  const cookies = cookieHeader(response);
  assert.match(cookies, new RegExp(`${sessionCookieName}=`));
  assert.match(cookies, /peaceone\.csrf=/);
  assert.doesNotMatch(cookies, /Secure/i);

  const sessionCount = await prisma.session.count();
  assert.ok(sessionCount >= 1);
});

test('mutating requests without a CSRF token are rejected', async () => {
  const primed = await fetch(`${baseUrl}/api/csrf-token`);
  const cookies = cookieHeader(primed);

  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: {
      Cookie: cookies,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, 'Invalid CSRF token');
});

test('mutating requests with a valid CSRF token pass CSRF checks', async () => {
  const primed = await fetch(`${baseUrl}/api/csrf-token`);
  const { csrfToken } = await primed.json();
  const cookies = cookieHeader(primed);

  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: {
      Cookie: cookies,
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: '{}',
  });

  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.error, 'Not found');
});
