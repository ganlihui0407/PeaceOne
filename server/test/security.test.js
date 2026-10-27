import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import {
  assertNoSecrets,
  postJson,
  primeCsrf,
  uniqueEmail,
  validRegisterBody,
} from './helpers.js';

const TEST_EMAIL_PREFIX = 'stage45-sec-';
const createdEmails = [];
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESTART_PORT = 3027;

let server;
let baseUrl;

function waitForListening(child, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('API process did not start')), timeoutMs);
    const onData = (chunk) => {
      if (String(chunk).includes('listening')) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve();
      }
    };
    child.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.stdout.on('data', onData);
  });
}

function startApiProcess(port) {
  return spawn(process.execPath, ['src/index.js'], {
    cwd: serverRoot,
    env: {
      ...process.env,
      PORT: String(port),
      PEACEONE_DISABLE_AUTH_RATE_LIMIT: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function stopApiProcess(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }
  child.kill();
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
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

test('production app does not expose authorization test routes', async () => {
  const response = await fetch(`${baseUrl}/__test__/protected/admin`);
  assert.equal(response.status, 404);
});

test('malformed and oversized bodies are rejected without leaking details', async () => {
  const primed = await primeCsrf(baseUrl);

  const malformed = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      Cookie: primed.cookies,
      'Content-Type': 'application/json',
      'x-csrf-token': primed.csrfToken,
    },
    body: '{not-json',
  });
  assert.equal(malformed.status, 400);
  const malformedBody = await malformed.json();
  assert.equal(malformedBody.error, 'Invalid request');
  assertNoSecrets(malformedBody);

  const oversized = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      Cookie: primed.cookies,
      'Content-Type': 'application/json',
      'x-csrf-token': primed.csrfToken,
    },
    body: JSON.stringify({
      email: 'oversized@peaceone.test',
      password: 'x'.repeat(40_000),
    }),
  });
  assert.equal(oversized.status, 413);
  const oversizedBody = await oversized.json();
  assert.equal(oversizedBody.error, 'Request too large');
  assert.equal(JSON.stringify(oversizedBody).includes('x'.repeat(50)), false);

  const tooLongName = await postJson(
    baseUrl,
    '/api/auth/register',
    await primeCsrf(baseUrl),
    validRegisterBody(uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'long'), {
      fullName: 'A'.repeat(101),
    }),
  );
  assert.equal(tooLongName.response.status, 400);
  assert.equal(tooLongName.json.error, 'Invalid request');

  const backendRole = await postJson(
    baseUrl,
    '/api/auth/register',
    await primeCsrf(baseUrl),
    validRegisterBody(uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'enum'), {
      role: 'STUDENT',
    }),
  );
  assert.equal(backendRole.response.status, 400);

  const objectRole = await postJson(
    baseUrl,
    '/api/auth/register',
    await primeCsrf(baseUrl),
    validRegisterBody(uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'objrole'), {
      role: { name: 'ADMIN' },
    }),
  );
  assert.equal(objectRole.response.status, 400);
});

test('auth responses omit hashes, session identifiers and credential names', async () => {
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'safe');
  const registered = await postJson(
    baseUrl,
    '/api/auth/register',
    await primeCsrf(baseUrl),
    validRegisterBody(email),
  );
  assert.equal(registered.response.status, 201);
  assertNoSecrets(registered.json);
  assert.equal(registered.json.user.passwordHash, undefined);
  assert.equal(registered.json.sessionID, undefined);
  assert.equal(registered.json.sid, undefined);

  const me = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: registered.cookies },
  });
  const meBody = await me.json();
  assertNoSecrets(meBody);
  assert.equal(meBody.user.passwordHash, undefined);
});

test('PostgreSQL sessions survive an API process restart', { timeout: 20000 }, async () => {
  let child = startApiProcess(RESTART_PORT);
  const restartUrl = `http://127.0.0.1:${RESTART_PORT}`;
  const email = uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, 'persist');

  try {
    await waitForListening(child);
    const primed = await primeCsrf(restartUrl);
    const registered = await postJson(
      restartUrl,
      '/api/auth/register',
      primed,
      validRegisterBody(email),
    );
    assert.equal(registered.response.status, 201, registered.text);
    const meBefore = await fetch(`${restartUrl}/api/auth/me`, {
      headers: { Cookie: registered.cookies },
    });
    assert.equal(meBefore.status, 200);

    await stopApiProcess(child);
    child = startApiProcess(RESTART_PORT);
    await waitForListening(child);

    const meAfter = await fetch(`${restartUrl}/api/auth/me`, {
      headers: { Cookie: registered.cookies },
    });
    assert.equal(meAfter.status, 200);
    const meBody = await meAfter.json();
    assert.equal(meBody.user.email, email);
    assert.equal(meBody.user.role, 'STUDENT');
    assertNoSecrets(meBody);
  } finally {
    await stopApiProcess(child);
  }
});
