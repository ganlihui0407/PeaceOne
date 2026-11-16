import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { parseDatabaseTarget, PRESENTATION_DATABASE_NAME } from '../src/lib/databaseTarget.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(serverRoot, '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

function stamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

if (!process.env.DATABASE_URL) {
  console.error('Refusing backup: DATABASE_URL is not set.');
  process.exit(1);
}

const target = parseDatabaseTarget(process.env.DATABASE_URL);
if (target.databaseName !== PRESENTATION_DATABASE_NAME) {
  console.error(`Refusing backup: DATABASE_URL database is "${target.databaseName}", expected ${PRESENTATION_DATABASE_NAME}.`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const identity = await client.query(
  'SELECT current_database()::text AS name, current_user::text AS db_user, version()::text AS version',
);
await client.end();

const name = identity.rows[0].name;
if (name !== PRESENTATION_DATABASE_NAME) {
  console.error(`Refusing backup: current_database() is "${name}".`);
  process.exit(1);
}

const backupDir = path.join(repoRoot, 'backups');
mkdirSync(backupDir, { recursive: true });
const filename = `peaceone-pre-phase2-${stamp()}.dump`;
const backupPath = path.join(backupDir, filename);
if (existsSync(backupPath)) {
  console.error(`Refusing backup: ${backupPath} already exists.`);
  process.exit(1);
}

function tryLocal(binary, args) {
  try {
    return execFileSync(binary, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

const container = process.env.PEACEONE_POSTGRES_CONTAINER || 'peaceone-postgres';
let dumpVersion = tryLocal('pg_dump', ['--version']);
let restoreBinary = 'pg_restore';
let usedDocker = false;

if (dumpVersion) {
  execFileSync('pg_dump', [
    `--dbname=${process.env.DATABASE_URL}`,
    '--format=custom',
    '--no-owner',
    '--file',
    backupPath,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
} else {
  dumpVersion = execFileSync('docker', ['exec', container, 'pg_dump', '--version'], { encoding: 'utf8' }).trim();
  const remoteFile = `/tmp/${filename}`;
  execFileSync('docker', [
    'exec',
    container,
    'pg_dump',
    '--dbname=peaceone',
    '--username=peaceone',
    '--format=custom',
    '--no-owner',
    '--file',
    remoteFile,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  execFileSync('docker', ['cp', `${container}:${remoteFile}`, backupPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  execFileSync('docker', ['exec', container, 'rm', '-f', remoteFile], { stdio: ['ignore', 'pipe', 'pipe'] });
  usedDocker = true;
  restoreBinary = null;
}

if (typeof dumpVersion === 'string') {
  dumpVersion = dumpVersion.trim();
}

const stats = statSync(backupPath);
const sha256 = createHash('sha256').update(readFileSync(backupPath)).digest('hex');

let listing;
const localRestore = tryLocal('pg_restore', ['--list', backupPath]);
if (localRestore) {
  listing = localRestore;
} else {
  const listRemote = `/tmp/${filename}`;
  execFileSync('docker', ['cp', backupPath, `${container}:${listRemote}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  listing = execFileSync('docker', ['exec', container, 'pg_restore', '--list', listRemote], { encoding: 'utf8' });
  usedDocker = true;
}

const listingPath = `${backupPath}.toc.txt`;
writeFileSync(listingPath, listing, 'utf8');
const tableLines = listing.split('\n').filter((line) => /\bTABLE DATA\b/.test(line));
const tableCount = tableLines.length;

console.log(JSON.stringify({
  database: name,
  host: target.host,
  port: target.port,
  backupPath,
  listingPath,
  bytes: stats.size,
  createdAt: stats.mtime.toISOString(),
  sha256,
  pgDumpVersion: dumpVersion,
  postgresVersion: identity.rows[0].version,
  currentUser: identity.rows[0].db_user,
  tableDataEntries: tableCount,
  usedDockerPgDump: usedDocker,
  status: 'pg_dump completed',
}, null, 2));
