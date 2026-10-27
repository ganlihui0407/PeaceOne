import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeSessionStore } from '../src/lib/session.js';
import { postJson, primeCsrf, uniqueEmail, validRegisterBody } from './helpers.js';

const TEST_EMAIL_PREFIX = 'stage45-rl-';
const createdEmails = [];

let server;
let baseUrl;
let previousRateLimitFlag;

before(async () => {
  previousRateLimitFlag = process.env.PEACEONE_DISABLE_AUTH_RATE_LIMIT;
  process.env.PEACEONE_DISABLE_AUTH_RATE_LIMIT = 'false';
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  process.env.PEACEONE_DISABLE_AUTH_RATE_LIMIT = previousRateLimitFlag;
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

test('auth mutation rate limits do not apply to GET /api/auth/me', async () => {
  const primed = await primeCsrf(baseUrl);
  let limited = 0;
  let lastStatus = 0;

  for (let index = 0; index < 21; index += 1) {
    const result = await postJson(
      baseUrl,
      '/api/auth/register',
      primed,
      validRegisterBody(uniqueEmail(createdEmails, TEST_EMAIL_PREFIX, `burst-${index}`), {
        fullName: '',
      }),
    );
    lastStatus = result.response.status;
    if (result.response.status === 429) {
      limited += 1;
    }
  }

  assert.ok(limited >= 1, `expected a 429 after the mutation burst, last status ${lastStatus}`);
  assert.equal(lastStatus, 429);

  for (let index = 0; index < 10; index += 1) {
    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: primed.cookies },
    });
    assert.notEqual(me.status, 429);
    assert.equal(me.status, 401);
  }
});
