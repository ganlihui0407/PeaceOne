import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { IMPORT_LOCK_KEY } from '../src/lib/esco/constants.js';
import { EscoImportError } from '../src/lib/esco/errors.js';
import { importEsco } from '../src/lib/esco/importEsco.js';
import {
  ESCO_TEST_DB_NAME,
  PEACEONE_DB_NAME,
  assertCurrentDatabase,
  databaseNameFromUrl,
  ensureIsolatedEscoTestDatabase,
  isolatedEscoDatabaseUrl,
  resetIsolatedEscoTestData,
} from './escoTestDb.js';
import {
  occupationFields,
  relationFields,
  skillFields,
  writeFixtureDataset,
} from './escoFixtures.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(serverRoot, 'scripts', 'import-esco.js');

let prisma;
let fixtureRoot;

function tmpRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeDefaultFixture(overrides = {}) {
  if (fixtureRoot) {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
  fixtureRoot = tmpRoot('peaceone-esco-fixture-');
  return writeFixtureDataset(fixtureRoot, {
    occupations: [
      occupationFields(),
      occupationFields({
        preferredLabel: 'test occupation',
        modifiedDate: '2025-11-26T10:02:16.164Z',
      }),
    ],
    skills: [
      skillFields({ skillType: '' }),
      skillFields({
        conceptUri: 'http://data.europa.eu/esco/skill/test-b',
        preferredLabel: 'optional skill',
        skillType: 'knowledge',
      }),
    ],
    relations: [
      relationFields({ skillType: '' }),
      relationFields({
        skillUri: 'http://data.europa.eu/esco/skill/test-b',
        skillLabel: 'optional skill',
        relationType: 'optional',
        skillType: 'knowledge',
      }),
    ],
    ...overrides,
  });
}

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: serverRoot,
      env: process.env,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

before(async () => {
  prisma = await ensureIsolatedEscoTestDatabase();
  const connected = await assertCurrentDatabase(prisma, ESCO_TEST_DB_NAME);
  assert.equal(databaseNameFromUrl(isolatedEscoDatabaseUrl()), ESCO_TEST_DB_NAME);
  assert.notEqual(connected, PEACEONE_DB_NAME);
});

beforeEach(async () => {
  await resetIsolatedEscoTestData(prisma);
});

after(async () => {
  if (fixtureRoot) {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
  if (prisma) {
    await prisma.$disconnect();
  }
});

test('dry-run validates fixtures and writes no database rows', async () => {
  const paths = writeDefaultFixture();
  const beforeCounts = {
    occupations: await prisma.occupation.count(),
    skills: await prisma.skill.count(),
    relations: await prisma.occupationSkillRelation.count(),
    users: await prisma.user.count(),
  };
  const report = await importEsco({
    mode: 'dry-run',
    ...paths,
    writeReport: true,
  });
  assert.equal(report.operation, 'dry-run');
  assert.equal(report.occupations.inputRows, 2);
  assert.equal(report.occupations.acceptedUnique, 1);
  assert.equal(report.occupations.duplicatesCollapsed, 1);
  assert.equal(report.skills.acceptedUnique, 2);
  assert.equal(report.relations.acceptedUnique, 2);
  assert.equal(report.database.occupationsCreated, 0);
  assert.equal(await prisma.occupation.count(), beforeCounts.occupations);
  assert.equal(await prisma.skill.count(), beforeCounts.skills);
  assert.equal(await prisma.occupationSkillRelation.count(), beforeCounts.relations);
  assert.equal(await prisma.user.count(), beforeCounts.users);
  assert.equal(fs.existsSync(report.reportPath), true);
  const written = JSON.parse(fs.readFileSync(report.reportPath, 'utf8'));
  assert.doesNotMatch(JSON.stringify(written), /DATABASE_URL|SESSION_SECRET|CSRF_SECRET/i);
});

test('apply is idempotent and stores empty skillType as null', async () => {
  const paths = writeDefaultFixture();
  const options = {
    mode: 'apply',
    prisma,
    connectionString: isolatedEscoDatabaseUrl(),
    ...paths,
    writeReport: false,
  };
  const first = await importEsco(options);
  assert.equal(first.database.occupationsCreated, 1);
  assert.equal(first.database.skillsCreated, 2);
  assert.equal(first.database.relationsCreated, 2);

  const skill = await prisma.skill.findUnique({
    where: { sourceUri: 'http://data.europa.eu/esco/skill/test-a' },
  });
  assert.equal(skill.skillType, null);
  assert.equal(skill.sourceSystem, 'ESCO');

  const second = await importEsco(options);
  assert.equal(second.database.occupationsCreated, 0);
  assert.equal(second.database.occupationsUnchanged, 1);
  assert.equal(second.database.skillsUnchanged, 2);
  assert.equal(second.database.relationsUnchanged, 2);
  assert.equal(await prisma.occupation.count(), 1);
  assert.equal(await prisma.skill.count(), 2);
  assert.equal(await prisma.occupationSkillRelation.count(), 2);

  const brokenFks = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM occupation_skill_relations AS relation
    LEFT JOIN occupations AS occupation ON occupation.id = relation.occupation_id
    LEFT JOIN skills AS skill ON skill.id = relation.skill_id
    WHERE occupation.id IS NULL OR skill.id IS NULL
  `;
  assert.equal(Number(brokenFks[0].count), 0);
  const uniqueTriples = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT occupation_id, skill_id, relation_type
      FROM occupation_skill_relations
      GROUP BY occupation_id, skill_id, relation_type
    ) AS triples
  `;
  assert.equal(Number(uniqueTriples[0].count), 2);
});

test('partial failure commits finished batches and retry completes the import', async () => {
  const paths = writeDefaultFixture();
  const options = {
    mode: 'apply',
    connectionString: isolatedEscoDatabaseUrl(),
    writeReport: false,
    ...paths,
  };
  await assert.rejects(
    () => importEsco({ ...options, failAfter: 'occupations' }),
    (error) => error instanceof EscoImportError && error.code === 'TEST_INTERRUPT',
  );
  assert.equal(await prisma.occupation.count(), 1);
  assert.equal(await prisma.skill.count(), 0);
  assert.equal(await prisma.occupationSkillRelation.count(), 0);

  await assert.rejects(
    () => importEsco({ ...options, failAfter: 'skills' }),
    (error) => error instanceof EscoImportError && error.code === 'TEST_INTERRUPT',
  );
  assert.equal(await prisma.occupation.count(), 1);
  assert.equal(await prisma.skill.count(), 2);
  assert.equal(await prisma.occupationSkillRelation.count(), 0);

  const retry = await importEsco(options);
  assert.equal(retry.database.occupationsUnchanged, 1);
  assert.equal(retry.database.skillsUnchanged, 2);
  assert.equal(retry.database.relationsCreated, 2);
  assert.equal(await prisma.occupationSkillRelation.count(), 2);
});

test('apply does not touch users, sessions or user_skills', async () => {
  const paths = writeDefaultFixture();
  const user = await prisma.user.create({
    data: {
      email: 'esco-guard@peaceone.test',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvabcdefghijklmnop',
      fullName: 'Guard User',
      role: 'STUDENT',
      accountStatus: 'ACTIVE',
    },
  });
  await prisma.session.create({
    data: {
      sid: 'esco-guard-session',
      sess: { purpose: 'guard' },
      expire: new Date('2026-12-01T00:00:00.000Z'),
    },
  });

  await importEsco({
    mode: 'apply',
    prisma,
    connectionString: isolatedEscoDatabaseUrl(),
    writeReport: false,
    ...paths,
  });

  const skill = await prisma.skill.findUnique({
    where: { sourceUri: 'http://data.europa.eu/esco/skill/test-a' },
  });
  await prisma.userSkill.create({
    data: {
      userId: user.id,
      skillId: skill.id,
      proficiencyLevel: 'intermediate',
    },
  });

  await importEsco({
    mode: 'apply',
    prisma,
    connectionString: isolatedEscoDatabaseUrl(),
    writeReport: false,
    ...paths,
  });

  const sameUser = await prisma.user.findUnique({ where: { id: user.id } });
  const sameSession = await prisma.session.findUnique({ where: { sid: 'esco-guard-session' } });
  const sameUserSkill = await prisma.userSkill.findUnique({
    where: { userId_skillId: { userId: user.id, skillId: skill.id } },
  });
  assert.equal(sameUser.email, 'esco-guard@peaceone.test');
  assert.equal(sameUser.passwordHash, '$2b$10$abcdefghijklmnopqrstuvabcdefghijklmnop');
  assert.equal(sameUser.fullName, 'Guard User');
  assert.deepEqual(sameSession.sess, { purpose: 'guard' });
  assert.equal(sameUserSkill.proficiencyLevel, 'intermediate');
});

test('does not overwrite non-ESCO rows and rejects duplicate relation triples in source', async () => {
  const paths = writeFixtureDataset(tmpRoot('peaceone-esco-masco-'), {
    occupations: [occupationFields({ preferredLabel: 'from esco' })],
    skills: [skillFields()],
    relations: [
      relationFields(),
      relationFields({ occupationLabel: 'different label' }),
    ],
  });
  await prisma.occupation.create({
    data: {
      sourceSystem: 'MASCO',
      sourceUri: 'http://data.europa.eu/esco/occupation/test-a',
      preferredLabel: 'from masco',
    },
  });
  const report = await importEsco({
    mode: 'apply',
    prisma,
    connectionString: isolatedEscoDatabaseUrl(),
    writeReport: false,
    ...paths,
  });
  const occupation = await prisma.occupation.findUnique({
    where: { sourceUri: 'http://data.europa.eu/esco/occupation/test-a' },
  });
  assert.equal(occupation.sourceSystem, 'MASCO');
  assert.equal(occupation.preferredLabel, 'from masco');
  assert.ok(report.rejects.some((item) => item.reason === 'source_system_not_esco'));
  assert.ok(report.rejects.some((item) => item.reason === 'conflicting_duplicate_relation'));
  assert.equal(await prisma.occupationSkillRelation.count(), 0);
  fs.rmSync(paths.rootDir, { recursive: true, force: true });
});

test('aborts CLI on version or hash mismatch', async () => {
  const versionPaths = writeFixtureDataset(tmpRoot('peaceone-esco-version-'), { version: 'v0.0.0' });
  const versionResult = await runCli([
    '--dry-run',
    '--extracted',
    versionPaths.extractedDir,
    '--archive',
    versionPaths.archivePath,
    '--manifest',
    versionPaths.manifestPath,
    '--reports-dir',
    versionPaths.reportsDir,
    '--expected-version',
    'v1.2.1',
  ]);
  assert.equal(versionResult.code, 1);
  assert.match(versionResult.stderr, /version mismatch/i);
  assert.doesNotMatch(versionResult.stdout + versionResult.stderr, /DATABASE_URL|SESSION_SECRET|CSRF_SECRET/i);
  fs.rmSync(versionPaths.rootDir, { recursive: true, force: true });

  const hashPaths = writeFixtureDataset(tmpRoot('peaceone-esco-hash-'), { corruptSkillHash: true });
  const hashResult = await runCli([
    '--dry-run',
    '--extracted',
    hashPaths.extractedDir,
    '--archive',
    hashPaths.archivePath,
    '--manifest',
    hashPaths.manifestPath,
    '--reports-dir',
    hashPaths.reportsDir,
  ]);
  assert.equal(hashResult.code, 1);
  assert.match(hashResult.stderr, /hash mismatch/i);
  fs.rmSync(hashPaths.rootDir, { recursive: true, force: true });
});

test('prevents concurrent apply with an advisory lock', async () => {
  const paths = writeDefaultFixture();
  const locker = new pg.Client({ connectionString: isolatedEscoDatabaseUrl() });
  await locker.connect();
  try {
    const locked = await locker.query('SELECT pg_try_advisory_lock($1) AS locked', [IMPORT_LOCK_KEY]);
    assert.equal(locked.rows[0].locked, true);
    await assert.rejects(
      () =>
        importEsco({
          mode: 'apply',
          prisma,
          connectionString: isolatedEscoDatabaseUrl(),
          writeReport: false,
          ...paths,
        }),
      (error) => error instanceof EscoImportError && error.code === 'IMPORT_IN_PROGRESS',
    );
  } finally {
    await locker.query('SELECT pg_advisory_unlock($1)', [IMPORT_LOCK_KEY]);
    await locker.end();
  }
});
