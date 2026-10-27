import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import { config } from '../src/config.js';
import { createPrismaClient } from '../src/db.js';

const execFileAsync = promisify(execFile);
export const ESCO_TEST_DB_NAME = 'peaceone_esco_import_test';
export const PEACEONE_DB_NAME = 'peaceone';

export function databaseNameFromUrl(connectionString) {
  return decodeURIComponent(new URL(connectionString).pathname.replace(/^\//, ''));
}
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function isolatedEscoDatabaseUrl() {
  const url = new URL(config.databaseUrl);
  url.pathname = `/${ESCO_TEST_DB_NAME}`;
  return url.toString();
}

function redact(value) {
  return String(value ?? '')
    .replaceAll(config.databaseUrl, '[redacted]')
    .replaceAll(isolatedEscoDatabaseUrl(), '[redacted]');
}

export async function ensureIsolatedEscoTestDatabase() {
  const admin = new pg.Client({ connectionString: config.databaseUrl });
  await admin.connect();
  try {
    const found = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [ESCO_TEST_DB_NAME]);
    if (found.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${ESCO_TEST_DB_NAME}`);
    }
  } finally {
    await admin.end();
  }

  const prismaCli = path.join(serverRoot, 'node_modules', 'prisma', 'build', 'index.js');
  try {
    await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      cwd: serverRoot,
      env: { ...process.env, DATABASE_URL: isolatedEscoDatabaseUrl() },
    });
  } catch (error) {
    throw new Error(`Failed to migrate isolated ESCO test database: ${redact(error.stderr || error.message)}`);
  }

  return createPrismaClient(isolatedEscoDatabaseUrl());
}

export async function assertCurrentDatabase(prisma, expectedName) {
  const rows = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const name = rows[0]?.name;
  if (name !== expectedName) {
    throw new Error(`Expected database ${expectedName}, connected to ${name}`);
  }
  return name;
}

export async function resetIsolatedEscoTestData(prisma) {
  await prisma.userSkill.deleteMany();
  await prisma.occupationSkillRelation.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.occupation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}
