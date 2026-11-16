import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import dotenv from 'dotenv';
import pg from 'pg';
import {
  DEDICATED_TEST_DATABASE_NAME,
  describeDatabaseTarget,
  isDedicatedTestDatabaseName,
  parseDatabaseTarget,
} from '../src/lib/databaseTarget.js';
import { assertDedicatedTestDatabaseUrl } from '../src/lib/testDatabaseGuard.js';

const execFileAsync = promisify(execFile);
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

const CATALOGUE_TABLES = [
  'occupations',
  'skills',
  'occupation_skill_relations',
  'masco_unit_groups',
  'masco_occupation_records',
  'masco_historical_crosswalks',
];

function quoteIdent(name) {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing unsafe SQL identifier: ${name}`);
  }
  return `"${name}"`;
}

function cloneUrlWithDatabase(connectionString, databaseName) {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function copyTable(source, dest, table) {
  const existing = await dest.query(`SELECT COUNT(*)::int AS n FROM ${quoteIdent(table)}`);
  if (existing.rows[0].n > 0) {
    return { table, copied: 0, skipped: existing.rows[0].n };
  }

  const result = await source.query(`SELECT * FROM ${quoteIdent(table)}`);
  if (result.rows.length === 0) {
    return { table, copied: 0, skipped: 0 };
  }

  const columns = result.fields.map((field) => field.name);
  const columnSql = columns.map(quoteIdent).join(', ');
  const batchSize = 200;

  for (let index = 0; index < result.rows.length; index += batchSize) {
    const chunk = result.rows.slice(index, index + batchSize);
    const params = [];
    const values = chunk.map((row) => {
      const placeholders = columns.map((column) => {
        params.push(row[column]);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await dest.query(
      `INSERT INTO ${quoteIdent(table)} (${columnSql}) VALUES ${values.join(', ')}`,
      params,
    );
  }

  return { table, copied: result.rows.length, skipped: 0 };
}

if (!process.env.DATABASE_URL) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'Missing required environment variable: TEST_DATABASE_URL. Create peaceone_test and set TEST_DATABASE_URL before running backend tests.',
  );
}

const isolation = assertDedicatedTestDatabaseUrl({
  testDatabaseUrl: process.env.TEST_DATABASE_URL,
  presentationDatabaseUrl: process.env.DATABASE_URL,
  testProcessEnabled: true,
});

if (isolation.test.databaseName !== DEDICATED_TEST_DATABASE_NAME && isolation.test.databaseName !== 'peaceone_esco_import_test') {
  if (!isDedicatedTestDatabaseName(isolation.test.databaseName)) {
    throw new Error('TEST_DATABASE_URL is not a dedicated test database.');
  }
}

console.log(`Presentation target: ${describeDatabaseTarget(process.env.DATABASE_URL)}`);
console.log(`Test target: ${describeDatabaseTarget(process.env.TEST_DATABASE_URL)}`);

const maintenance = new pg.Client({
  connectionString: cloneUrlWithDatabase(process.env.DATABASE_URL, isolation.presentation.databaseName),
});
await maintenance.connect();
try {
  const current = await maintenance.query('SELECT current_database() AS name');
  if (current.rows[0].name !== isolation.presentation.databaseName) {
    throw new Error('Refusing to continue: maintenance connection is not the presentation database.');
  }

  const found = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    isolation.test.databaseName,
  ]);
  if (found.rowCount === 0) {
    await maintenance.query(`CREATE DATABASE ${quoteIdent(isolation.test.databaseName)}`);
    console.log(`Created database ${isolation.test.databaseName}`);
  } else {
    console.log(`Database ${isolation.test.databaseName} already exists`);
  }
} finally {
  await maintenance.end();
}

const prismaCli = path.join(serverRoot, 'node_modules', 'prisma', 'build', 'index.js');
try {
  const migrated = await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: serverRoot,
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
    },
  });
  if (migrated.stdout) {
    process.stdout.write(migrated.stdout);
  }
} catch (error) {
  const detail = String(error.stderr || error.message || error);
  throw new Error(`Failed to apply Prisma migrations to the test database: ${detail.slice(0, 500)}`);
}

const source = new pg.Client({ connectionString: process.env.DATABASE_URL });
const dest = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
await source.connect();
await dest.connect();
try {
  const sourceName = await source.query('SELECT current_database() AS name');
  const destName = await dest.query('SELECT current_database() AS name');
  if (sourceName.rows[0].name !== isolation.presentation.databaseName) {
    throw new Error('Refusing catalogue copy: source is not the presentation database.');
  }
  if (destName.rows[0].name !== isolation.test.databaseName) {
    throw new Error('Refusing catalogue copy: destination is not the dedicated test database.');
  }

  for (const table of CATALOGUE_TABLES) {
    const result = await copyTable(source, dest, table);
    console.log(
      result.copied > 0
        ? `Copied ${result.copied} rows into ${result.table}`
        : `Skipped ${result.table} (${result.skipped} existing rows)`,
    );
  }
} finally {
  await Promise.all([source.end(), dest.end()]);
}

console.log('Test database is ready. Backend tests must use TEST_DATABASE_URL only.');
