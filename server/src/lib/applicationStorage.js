import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const APPLICATION_STORAGE_ENV = 'PEACEONE_APPLICATION_STORAGE';
export const APPLICATION_STORAGE_SEGMENT = 'applications';
export const APPLICATION_TEMP_SEGMENT = 'tmp';
export const GENERATED_PDF_STORED_FILENAME = 'resume-snapshot.pdf';
export const ORIGINAL_RESUME_STORED_PREFIX = 'original-resume';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORIGINAL_STORED_RE = /^original-resume\.(pdf|docx)$/i;

function requireUuid(value, label) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value.toLowerCase();
}

function hasPathSeparator(value) {
  return value.includes('/') || value.includes('\\') || value.includes('\0');
}

export function defaultApplicationStorageRoot() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return path.resolve(base, 'PeaceOne', 'application-storage');
  }
  if (process.platform === 'darwin') {
    return path.resolve(home, 'Library', 'Application Support', 'PeaceOne', 'application-storage');
  }
  const base = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  return path.resolve(base, 'peaceone', 'application-storage');
}

export function resolveApplicationStorageRoot(env = process.env) {
  const configured = env?.[APPLICATION_STORAGE_ENV];
  if (typeof configured === 'string' && configured.trim()) {
    return path.resolve(configured.trim());
  }
  return defaultApplicationStorageRoot();
}

export function isPathInsideRoot(root, candidate) {
  const rootResolved = path.resolve(root);
  const candidateResolved = path.resolve(candidate);
  const relative = path.relative(rootResolved, candidateResolved);
  if (relative === '') {
    return true;
  }
  if (path.isAbsolute(relative)) {
    return false;
  }
  return relative !== '..' && !relative.startsWith(`..${path.sep}`);
}

function assertInsideRoot(root, candidate) {
  if (!isPathInsideRoot(root, candidate)) {
    throw new Error('Storage path escapes the configured root');
  }
}

export function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function originalStoredFilenameFor(contentType, originalFilename) {
  const name = typeof originalFilename === 'string' ? originalFilename.toLowerCase() : '';
  if (contentType === 'application/pdf' || name.endsWith('.pdf')) {
    return `${ORIGINAL_RESUME_STORED_PREFIX}.pdf`;
  }
  if (
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || name.endsWith('.docx')
  ) {
    return `${ORIGINAL_RESUME_STORED_PREFIX}.docx`;
  }
  throw new Error('Unsupported original resume type');
}

export function requireGeneratedStoredFilename(value) {
  if (value !== GENERATED_PDF_STORED_FILENAME) {
    throw new Error('Invalid generated PDF filename');
  }
  return GENERATED_PDF_STORED_FILENAME;
}

export function requireOriginalStoredFilename(value) {
  if (typeof value !== 'string' || hasPathSeparator(value) || value.includes('..')) {
    throw new Error('Invalid original stored filename');
  }
  if (!ORIGINAL_STORED_RE.test(value)) {
    throw new Error('Invalid original stored filename');
  }
  return value.toLowerCase();
}

export function applicationDir(applicationId, env = process.env) {
  const root = resolveApplicationStorageRoot(env);
  const id = requireUuid(applicationId, 'application id');
  const resolved = path.resolve(root, APPLICATION_STORAGE_SEGMENT, id);
  assertInsideRoot(root, resolved);
  return resolved;
}

export function applicationTempDir(env = process.env) {
  const root = resolveApplicationStorageRoot(env);
  const resolved = path.resolve(root, APPLICATION_TEMP_SEGMENT);
  assertInsideRoot(root, resolved);
  return resolved;
}

export function applicationStagingDir(stagingId, env = process.env) {
  const root = resolveApplicationStorageRoot(env);
  const id = requireUuid(stagingId, 'staging id');
  const resolved = path.resolve(applicationTempDir(env), id);
  assertInsideRoot(root, resolved);
  return resolved;
}

export function applicationFilePath(applicationId, storedFilename, env = process.env) {
  const root = resolveApplicationStorageRoot(env);
  const directory = applicationDir(applicationId, env);
  const filename = storedFilename === GENERATED_PDF_STORED_FILENAME
    ? requireGeneratedStoredFilename(storedFilename)
    : requireOriginalStoredFilename(storedFilename);
  const resolved = path.resolve(directory, filename);
  assertInsideRoot(root, resolved);
  assertInsideRoot(directory, resolved);
  return resolved;
}

async function ensureDir(directory, env = process.env) {
  const root = resolveApplicationStorageRoot(env);
  assertInsideRoot(root, directory);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  return directory;
}

async function unlinkInsideRoot(candidate, env = process.env) {
  const root = resolveApplicationStorageRoot(env);
  if (!isPathInsideRoot(root, candidate)) {
    throw new Error('Storage path escapes the configured root');
  }
  try {
    await fs.unlink(candidate);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function removeDirInsideRoot(candidate, env = process.env) {
  const root = resolveApplicationStorageRoot(env);
  if (!isPathInsideRoot(root, candidate) || path.resolve(candidate) === path.resolve(root)) {
    throw new Error('Storage path escapes the configured root');
  }
  await fs.rm(candidate, { recursive: true, force: true });
}

async function relocateInsideRoot(fromPath, toPath, env = process.env) {
  const root = resolveApplicationStorageRoot(env);
  assertInsideRoot(root, fromPath);
  assertInsideRoot(root, toPath);
  try {
    await fs.rename(fromPath, toPath);
  } catch (error) {
    if (error?.code !== 'EXDEV') {
      throw error;
    }
    await fs.cp(fromPath, toPath, { recursive: true });
    await removeDirInsideRoot(fromPath, env);
  }
}

export async function writeApplicationStagingFiles(files, env = process.env) {
  const stagingId = randomUUID();
  const directory = applicationStagingDir(stagingId, env);
  await ensureDir(applicationTempDir(env), env);
  await ensureDir(directory, env);

  try {
    const generatedPath = path.resolve(directory, GENERATED_PDF_STORED_FILENAME);
    assertInsideRoot(directory, generatedPath);
    await fs.writeFile(generatedPath, files.generatedPdf, { flag: 'wx', mode: 0o600 });
    const generatedHash = sha256Hex(await fs.readFile(generatedPath));
    if (generatedHash !== files.generatedPdfSha256) {
      throw new Error('Generated PDF checksum mismatch');
    }

    if (files.originalBuffer && files.originalStoredFilename && files.originalSha256) {
      const stored = requireOriginalStoredFilename(files.originalStoredFilename);
      const originalPath = path.resolve(directory, stored);
      assertInsideRoot(directory, originalPath);
      await fs.writeFile(originalPath, files.originalBuffer, { flag: 'wx', mode: 0o600 });
      const originalHash = sha256Hex(await fs.readFile(originalPath));
      if (originalHash !== files.originalSha256) {
        throw new Error('Original resume checksum mismatch');
      }
    }
  } catch (error) {
    await removeDirInsideRoot(directory, env);
    throw error;
  }

  return { stagingId, directory };
}

export async function finalizeApplicationStorage(stagingId, applicationId, env = process.env) {
  const staging = applicationStagingDir(stagingId, env);
  const destination = applicationDir(applicationId, env);
  await ensureDir(path.dirname(destination), env);
  await relocateInsideRoot(staging, destination, env);
  return destination;
}

export async function removeApplicationStaging(stagingId, env = process.env) {
  if (!stagingId) {
    return;
  }
  await removeDirInsideRoot(applicationStagingDir(stagingId, env), env);
}

export async function removeApplicationStorage(applicationId, env = process.env) {
  await removeDirInsideRoot(applicationDir(applicationId, env), env);
}

export async function readApplicationFile(applicationId, storedFilename, env = process.env) {
  const destination = applicationFilePath(applicationId, storedFilename, env);
  try {
    return await fs.readFile(destination);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function applicationStorageExists(applicationId, env = process.env) {
  try {
    const stat = await fs.stat(applicationDir(applicationId, env));
    return stat.isDirectory();
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
