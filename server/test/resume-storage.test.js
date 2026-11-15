import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  RESUME_STORAGE_ENV,
  defaultResumeStorageRoot,
  ensureResumeDir,
  generateStoredFilename,
  isPathInsideRoot,
  publicResumeFileMetadata,
  requireStoredFilename,
  resolveResumeStorageRoot,
  resumeDir,
  resumeFilePath,
  resumeUserDir,
  sanitizeOriginalFilename,
} from '../src/lib/resumeStorage.js';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const RESUME_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FILE_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let tempRoot;

before(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'peaceone-resume-storage-'));
});

after(async () => {
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

function envWithRoot(root = tempRoot) {
  return { [RESUME_STORAGE_ENV]: root };
}

test('storage root uses PEACEONE_RESUME_STORAGE when set and otherwise a private OS directory', () => {
  const configured = resolveResumeStorageRoot(envWithRoot(path.join(tempRoot, 'custom-root')));
  assert.equal(configured, path.resolve(tempRoot, 'custom-root'));

  const fallback = defaultResumeStorageRoot();
  assert.equal(path.isAbsolute(fallback), true);
  assert.match(fallback, /PeaceOne|peaceone/);
  const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
  assert.equal(isPathInsideRoot(repoRoot, fallback), false);
});

test('user and resume directories stay under resumes/{userId}/{resumeId}', () => {
  const env = envWithRoot();
  const userDir = resumeUserDir(USER_A, env);
  const directory = resumeDir(USER_A, RESUME_A, env);
  assert.equal(userDir, path.resolve(tempRoot, 'resumes', USER_A));
  assert.equal(directory, path.resolve(tempRoot, 'resumes', USER_A, RESUME_A));
  assert.equal(isPathInsideRoot(tempRoot, userDir), true);
  assert.equal(isPathInsideRoot(tempRoot, directory), true);
  assert.equal(isPathInsideRoot(resumeUserDir(USER_B, env), directory), false);
});

test('generated filenames are UUID plus pdf or docx and never the original name', () => {
  assert.equal(generateStoredFilename(FILE_A, 'pdf'), `${FILE_A}.pdf`);
  assert.equal(generateStoredFilename(FILE_A, '.DOCX'), `${FILE_A}.docx`);
  assert.equal(requireStoredFilename(`${FILE_A}.PDF`), `${FILE_A}.pdf`);
  assert.throws(() => generateStoredFilename(FILE_A, 'exe'));
  assert.throws(() => generateStoredFilename(FILE_A, '../pdf'));
  assert.throws(() => requireStoredFilename('secret.pdf'));
  assert.throws(() => requireStoredFilename(`${FILE_A}/../${FILE_A}.pdf`));
  const stored = generateStoredFilename(FILE_A, 'pdf');
  assert.equal(stored.includes('CV'), false);
  assert.equal(stored.includes('..'), false);
});

test('path traversal and original filenames cannot escape the storage root', () => {
  const env = envWithRoot();
  assert.throws(() => resumeUserDir('../etc', env));
  assert.throws(() => resumeDir(USER_A, '..\\windows', env));
  assert.throws(() => resumeFilePath(USER_A, RESUME_A, `..${path.sep}${FILE_A}.pdf`, env));
  assert.throws(() => resumeFilePath(USER_A, RESUME_A, `/tmp/${FILE_A}.pdf`, env));
  assert.throws(() => resumeFilePath(USER_A, RESUME_A, sanitizeOriginalFilename('C:\\\\Users\\\\x\\\\CV.pdf'), env));
  const resolved = resumeFilePath(USER_A, RESUME_A, `${FILE_A}.pdf`, env);
  assert.equal(isPathInsideRoot(tempRoot, resolved), true);
  assert.equal(resolved, path.resolve(tempRoot, 'resumes', USER_A, RESUME_A, `${FILE_A}.pdf`));
});

test('different users receive different storage directories', () => {
  const env = envWithRoot();
  const left = resumeDir(USER_A, RESUME_A, env);
  const right = resumeDir(USER_B, RESUME_A, env);
  assert.notEqual(left, right);
  assert.equal(path.basename(path.dirname(left)), USER_A);
  assert.equal(path.basename(path.dirname(right)), USER_B);
});

test('ensureResumeDir prepares only the owned resume folder', async () => {
  const env = envWithRoot();
  const directory = await ensureResumeDir(USER_A, RESUME_A, env);
  const stat = await fs.stat(directory);
  assert.equal(stat.isDirectory(), true);
  assert.equal(directory, resumeDir(USER_A, RESUME_A, env));
});

test('public metadata omits storage paths and stored filenames', () => {
  const env = envWithRoot();
  const absolute = resumeFilePath(USER_A, RESUME_A, `${FILE_A}.pdf`, env);
  const payload = publicResumeFileMetadata({
    id: FILE_A,
    originalFilename: 'Software_CV.pdf',
    storedFilename: `${FILE_A}.pdf`,
    contentType: 'application/pdf',
    byteSize: 2048,
    sha256: 'a'.repeat(64),
    createdAt: '2026-11-13T03:00:00.000Z',
    updatedAt: '2026-11-13T03:00:00.000Z',
    path: absolute,
  });
  const serialized = JSON.stringify(payload);
  assert.equal(payload.originalFilename, 'Software_CV.pdf');
  assert.equal(payload.storedFilename, undefined);
  assert.equal(payload.path, undefined);
  assert.equal(serialized.includes(tempRoot), false);
  assert.equal(serialized.includes(absolute), false);
});

test('private storage is not served as static public files', () => {
  const app = readFileSync(fileURLToPath(new URL('../src/app.js', import.meta.url)), 'utf8');
  const routes = readFileSync(fileURLToPath(new URL('../src/routes/meResumes.js', import.meta.url)), 'utf8');
  assert.equal(app.includes('express.static'), false);
  assert.equal(app.includes('multer'), false);
  assert.equal(routes.includes('express.static'), false);
  assert.equal(routes.includes('/uploads'), false);
});
