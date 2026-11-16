import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASE2_BACKUP_SHA256 } from '../src/lib/peaceonePresentationExpansionCatalog.js';
import { verifyPhase2BackupChecksum } from '../src/lib/peaceonePresentationExpansionSeed.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(serverRoot, '..');
const backup = verifyPhase2BackupChecksum(repoRoot);
const expectedBytes = 11840284;

if (backup.bytes !== expectedBytes) {
  throw new Error(`Backup size mismatch: expected ${expectedBytes}, got ${backup.bytes}`);
}
if (backup.sha256 !== PHASE2_BACKUP_SHA256) {
  throw new Error('Backup SHA-256 mismatch.');
}

const container = process.env.PEACEONE_POSTGRES_CONTAINER || 'peaceone-postgres';
let listing;
try {
  listing = execFileSync('pg_restore', ['--list', backup.backupPath], { encoding: 'utf8' });
} catch (error) {
  if (error.code === 'ENOENT') {
    const remote = '/tmp/peaceone-pre-phase2-verify.dump';
    execFileSync('docker', ['cp', backup.backupPath, `${container}:${remote}`], { stdio: 'inherit' });
    listing = execFileSync('docker', ['exec', container, 'pg_restore', '--list', remote], { encoding: 'utf8' });
  } else {
    throw error;
  }
}

const tableData = listing.split('\n').filter((line) => /\bTABLE DATA\b/.test(line)).length;
console.log(JSON.stringify({
  backupPath: backup.backupPath,
  sha256: backup.sha256,
  bytes: backup.bytes,
  tableDataEntries: tableData,
  listingOk: tableData > 0,
  originalUntouched: true,
}, null, 2));
