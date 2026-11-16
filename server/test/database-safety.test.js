import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import {
  DEDICATED_TEST_DATABASE_NAME,
  PRESENTATION_DATABASE_NAME,
  parseDatabaseTarget,
} from '../src/lib/databaseTarget.js';
import {
  PRESENTATION_URL_ENV,
  TEST_PROCESS_FLAG,
  applyTestDatabaseIsolationFromEnv,
  assertDedicatedTestDatabaseUrl,
  assertSafeDestructiveTestOperation,
  resolvePrismaConnectionString,
} from '../src/lib/testDatabaseGuard.js';

const execFileAsync = promisify(execFile);
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE_USER = 'peaceone';
const SAMPLE_HOST = '127.0.0.1:5432';

function sampleUrl(databaseName) {
  return `postgresql://${SAMPLE_USER}@${SAMPLE_HOST}/${databaseName}`;
}

test('test database safety guard accepts the dedicated test database', () => {
  const isolation = assertDedicatedTestDatabaseUrl({
    testDatabaseUrl: sampleUrl(DEDICATED_TEST_DATABASE_NAME),
    presentationDatabaseUrl: sampleUrl(PRESENTATION_DATABASE_NAME),
    testProcessEnabled: true,
  });
  assert.equal(isolation.test.databaseName, DEDICATED_TEST_DATABASE_NAME);
  assert.equal(isolation.presentation.databaseName, PRESENTATION_DATABASE_NAME);
});

test('test database safety guard rejects the presentation database', () => {
  assert.throws(
    () => assertDedicatedTestDatabaseUrl({
      testDatabaseUrl: sampleUrl(PRESENTATION_DATABASE_NAME),
      presentationDatabaseUrl: sampleUrl(PRESENTATION_DATABASE_NAME),
      testProcessEnabled: true,
    }),
    /must not equal the presentation DATABASE_URL/,
  );
  assert.throws(
    () => assertDedicatedTestDatabaseUrl({
      testDatabaseUrl: `postgresql://other@${SAMPLE_HOST}/${PRESENTATION_DATABASE_NAME}`,
      presentationDatabaseUrl: sampleUrl(PRESENTATION_DATABASE_NAME),
      testProcessEnabled: true,
    }),
    /presentation database/,
  );
});

test('test database safety guard rejects missing TEST_DATABASE_URL', () => {
  assert.throws(
    () => assertDedicatedTestDatabaseUrl({
      testDatabaseUrl: undefined,
      presentationDatabaseUrl: sampleUrl(PRESENTATION_DATABASE_NAME),
      testProcessEnabled: true,
    }),
    /TEST_DATABASE_URL/,
  );
});

test('test database safety guard rejects an invalid database name', () => {
  assert.throws(
    () => assertDedicatedTestDatabaseUrl({
      testDatabaseUrl: sampleUrl('peaceone_prod'),
      presentationDatabaseUrl: sampleUrl(PRESENTATION_DATABASE_NAME),
      testProcessEnabled: true,
    }),
    /dedicated \*_test database/,
  );
  assert.throws(
    () => assertDedicatedTestDatabaseUrl({
      testDatabaseUrl: sampleUrl('postgres'),
      presentationDatabaseUrl: sampleUrl(PRESENTATION_DATABASE_NAME),
      testProcessEnabled: true,
    }),
    /dedicated \*_test database/,
  );
});

test('destructive cleanup functions cannot execute against the presentation database', async () => {
  const presentationPrisma = {
    $queryRaw: async () => [{ name: PRESENTATION_DATABASE_NAME }],
  };

  await assert.rejects(
    () => assertSafeDestructiveTestOperation(presentationPrisma, {
      TEST_DATABASE_URL: sampleUrl(DEDICATED_TEST_DATABASE_NAME),
      DATABASE_URL: sampleUrl(DEDICATED_TEST_DATABASE_NAME),
      [PRESENTATION_URL_ENV]: sampleUrl(PRESENTATION_DATABASE_NAME),
      [TEST_PROCESS_FLAG]: '1',
    }),
    /presentation database/,
  );

  await assert.rejects(
    () => assertSafeDestructiveTestOperation(presentationPrisma, {
      TEST_DATABASE_URL: sampleUrl(DEDICATED_TEST_DATABASE_NAME),
      DATABASE_URL: sampleUrl(PRESENTATION_DATABASE_NAME),
      [PRESENTATION_URL_ENV]: sampleUrl(PRESENTATION_DATABASE_NAME),
      [TEST_PROCESS_FLAG]: '1',
    }),
    /DATABASE_URL is not TEST_DATABASE_URL/,
  );
});

test('normal application startup still uses DATABASE_URL', async () => {
  const presentationUrl = process.env[PRESENTATION_URL_ENV];
  assert.ok(presentationUrl, 'expected setup.js to preserve the presentation DATABASE_URL');
  assert.equal(parseDatabaseTarget(presentationUrl).databaseName, PRESENTATION_DATABASE_NAME);
  assert.equal(parseDatabaseTarget(process.env.TEST_DATABASE_URL).databaseName, DEDICATED_TEST_DATABASE_NAME);
  assert.notEqual(process.env.DATABASE_URL, presentationUrl);

  const childEnv = { ...process.env };
  delete childEnv[TEST_PROCESS_FLAG];
  delete childEnv[PRESENTATION_URL_ENV];
  childEnv.DATABASE_URL = presentationUrl;
  childEnv.NODE_ENV = 'development';

  const script = [
    'import { config } from "./src/config.js";',
    'const parsed = new URL(config.databaseUrl);',
    'const name = decodeURIComponent(parsed.pathname.replace(/^\\//, ""));',
    'process.stdout.write(JSON.stringify({ databaseName: name, nodeEnv: config.nodeEnv }));',
  ].join('');

  const { stdout } = await execFileAsync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: serverRoot,
    env: childEnv,
  });
  const result = JSON.parse(stdout);
  assert.equal(result.databaseName, PRESENTATION_DATABASE_NAME);
  assert.notEqual(result.nodeEnv, 'test');
});

test('applyTestDatabaseIsolationFromEnv never falls back to the presentation database', () => {
  const env = {
    DATABASE_URL: sampleUrl(PRESENTATION_DATABASE_NAME),
    TEST_DATABASE_URL: sampleUrl(DEDICATED_TEST_DATABASE_NAME),
  };
  const isolation = applyTestDatabaseIsolationFromEnv(env);
  assert.equal(isolation.test.databaseName, DEDICATED_TEST_DATABASE_NAME);
  assert.equal(env.DATABASE_URL, sampleUrl(DEDICATED_TEST_DATABASE_NAME));
  assert.equal(env[PRESENTATION_URL_ENV], sampleUrl(PRESENTATION_DATABASE_NAME));
  assert.equal(env[TEST_PROCESS_FLAG], '1');

  assert.throws(
    () => applyTestDatabaseIsolationFromEnv({ DATABASE_URL: sampleUrl(PRESENTATION_DATABASE_NAME) }),
    /TEST_DATABASE_URL/,
  );

  assert.equal(
    resolvePrismaConnectionString(undefined, {
      [TEST_PROCESS_FLAG]: '1',
      TEST_DATABASE_URL: sampleUrl(DEDICATED_TEST_DATABASE_NAME),
      [PRESENTATION_URL_ENV]: sampleUrl(PRESENTATION_DATABASE_NAME),
    }),
    sampleUrl(DEDICATED_TEST_DATABASE_NAME),
  );

  assert.throws(
    () => resolvePrismaConnectionString(sampleUrl(PRESENTATION_DATABASE_NAME), {
      [TEST_PROCESS_FLAG]: '1',
      TEST_DATABASE_URL: sampleUrl(DEDICATED_TEST_DATABASE_NAME),
      [PRESENTATION_URL_ENV]: sampleUrl(PRESENTATION_DATABASE_NAME),
    }),
    /presentation database/,
  );
});
