import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const RESUME_STORAGE_ENV = 'PEACEONE_RESUME_STORAGE';
export const RESUME_FILE_EXTENSIONS = Object.freeze(['pdf', 'docx']);
export const RESUME_STORAGE_SEGMENT = 'resumes';
export const RESUME_TEMP_SEGMENT = 'tmp';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORED_FILENAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|docx)$/i;

function requireUuid(value, label) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value.toLowerCase();
}

function hasPathSeparator(value) {
  return value.includes('/') || value.includes('\\') || value.includes('\0');
}

/**
 * Default private directory outside the repository and OneDrive.
 * Windows: %LOCALAPPDATA%\PeaceOne\resume-storage
 * macOS: ~/Library/Application Support/PeaceOne/resume-storage
 * Linux: $XDG_DATA_HOME/peaceone/resume-storage
 */
export function defaultResumeStorageRoot() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return path.resolve(base, 'PeaceOne', 'resume-storage');
  }
  if (process.platform === 'darwin') {
    return path.resolve(home, 'Library', 'Application Support', 'PeaceOne', 'resume-storage');
  }
  const base = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  return path.resolve(base, 'peaceone', 'resume-storage');
}

export function resolveResumeStorageRoot(env = process.env) {
  const configured = env?.[RESUME_STORAGE_ENV];
  if (typeof configured === 'string' && configured.trim()) {
    return path.resolve(configured.trim());
  }
  return defaultResumeStorageRoot();
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

export function generateStoredFilename(fileId, extension) {
  const id = requireUuid(fileId, 'file id');
  const ext =
    typeof extension === 'string' ? extension.trim().toLowerCase().replace(/^\./, '') : '';
  if (!RESUME_FILE_EXTENSIONS.includes(ext) || hasPathSeparator(ext) || ext.includes('..')) {
    throw new Error('Invalid file extension');
  }
  return `${id}.${ext}`;
}

export function requireStoredFilename(value) {
  if (typeof value !== 'string' || hasPathSeparator(value) || value.includes('..')) {
    throw new Error('Invalid stored filename');
  }
  if (!STORED_FILENAME_RE.test(value)) {
    throw new Error('Invalid stored filename');
  }
  return value.toLowerCase();
}

export function sanitizeOriginalFilename(value) {
  if (typeof value !== 'string') {
    throw new Error('Invalid original filename');
  }
  const base = path.posix.basename(value.replaceAll('\\', '/'));
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, '_').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error('Invalid original filename');
  }
  return cleaned.slice(0, 255);
}

export function resumeUserDir(userId, env = process.env) {
  const root = resolveResumeStorageRoot(env);
  const user = requireUuid(userId, 'user id');
  const resolved = path.resolve(root, RESUME_STORAGE_SEGMENT, user);
  assertInsideRoot(root, resolved);
  return resolved;
}

export function resumeDir(userId, resumeId, env = process.env) {
  const root = resolveResumeStorageRoot(env);
  const user = requireUuid(userId, 'user id');
  const resume = requireUuid(resumeId, 'resume id');
  const resolved = path.resolve(root, RESUME_STORAGE_SEGMENT, user, resume);
  assertInsideRoot(root, resolved);
  return resolved;
}

export function resumeFilePath(userId, resumeId, storedFilename, env = process.env) {
  const root = resolveResumeStorageRoot(env);
  const filename = requireStoredFilename(storedFilename);
  const directory = resumeDir(userId, resumeId, env);
  const resolved = path.resolve(directory, filename);
  assertInsideRoot(root, resolved);
  assertInsideRoot(directory, resolved);
  return resolved;
}

export async function ensureResumeDir(userId, resumeId, env = process.env) {
  const root = resolveResumeStorageRoot(env);
  const directory = resumeDir(userId, resumeId, env);
  assertInsideRoot(root, directory);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  return directory;
}

export function resumeTempDir(env = process.env) {
  const root = resolveResumeStorageRoot(env);
  const resolved = path.resolve(root, RESUME_TEMP_SEGMENT);
  assertInsideRoot(root, resolved);
  return resolved;
}

async function ensureTempDir(env = process.env) {
  const directory = resumeTempDir(env);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  return directory;
}

async function unlinkInsideRoot(candidate, env = process.env) {
  const root = resolveResumeStorageRoot(env);
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

async function relocateInsideRoot(fromPath, toPath, env = process.env) {
  const root = resolveResumeStorageRoot(env);
  assertInsideRoot(root, fromPath);
  assertInsideRoot(root, toPath);
  try {
    await fs.rename(fromPath, toPath);
  } catch (error) {
    if (error?.code !== 'EXDEV') {
      throw error;
    }
    await fs.copyFile(fromPath, toPath);
    await unlinkInsideRoot(fromPath, env);
  }
}

export async function writeResumeTempFile(buffer, env = process.env) {
  const directory = await ensureTempDir(env);
  const tempPath = path.resolve(directory, `upload-${randomUUID()}.part`);
  assertInsideRoot(directory, tempPath);
  await fs.writeFile(tempPath, buffer, { flag: 'wx', mode: 0o600 });
  return tempPath;
}

export async function removeResumeTempFile(tempPath, env = process.env) {
  await unlinkInsideRoot(tempPath, env);
}

export async function relocateResumeTempFile(tempPath, userId, resumeId, storedFilename, env = process.env) {
  await ensureResumeDir(userId, resumeId, env);
  const destination = resumeFilePath(userId, resumeId, storedFilename, env);
  await relocateInsideRoot(tempPath, destination, env);
  return destination;
}

export async function removeStoredResumeFile(userId, resumeId, storedFilename, env = process.env) {
  const destination = resumeFilePath(userId, resumeId, storedFilename, env);
  await unlinkInsideRoot(destination, env);
  return destination;
}

export async function storedResumeFileExists(userId, resumeId, storedFilename, env = process.env) {
  const stat = await statStoredResumeFile(userId, resumeId, storedFilename, env);
  return Boolean(stat?.isFile);
}

export async function readStoredResumeFile(userId, resumeId, storedFilename, env = process.env) {
  const destination = resumeFilePath(userId, resumeId, storedFilename, env);
  const stat = await statStoredResumeFile(userId, resumeId, storedFilename, env);
  if (!stat?.isFile) {
    return null;
  }
  return fs.readFile(destination);
}

export async function statStoredResumeFile(userId, resumeId, storedFilename, env = process.env) {
  const destination = resumeFilePath(userId, resumeId, storedFilename, env);
  try {
    const stat = await fs.stat(destination);
    return {
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function cleanupResumeTempFiles(env = process.env, maxAgeMs = 15 * 60 * 1000) {
  const directory = resumeTempDir(env);
  let entries;
  try {
    entries = await fs.readdir(directory);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  const now = Date.now();
  for (const name of entries) {
    if (!name.startsWith('upload-') || !name.endsWith('.part') || name.includes('..')) {
      continue;
    }
    const fullPath = path.resolve(directory, name);
    if (!isPathInsideRoot(directory, fullPath)) {
      continue;
    }
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile() && now - stat.mtimeMs >= maxAgeMs) {
        await unlinkInsideRoot(fullPath, env);
      }
    } catch {
      // Interrupted temp files are best-effort.
    }
  }
}

export async function cleanupOwnedResumeDir(userId, resumeId, keepFilename = null, env = process.env) {
  const directory = resumeDir(userId, resumeId, env);
  let entries;
  try {
    entries = await fs.readdir(directory);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  const keep = keepFilename ? requireStoredFilename(keepFilename) : null;
  for (const name of entries) {
    let stored;
    try {
      stored = requireStoredFilename(name);
    } catch {
      continue;
    }
    if (keep && stored === keep) {
      continue;
    }
    await unlinkInsideRoot(path.resolve(directory, stored), env);
  }
}

async function rmdirIfEmpty(directory, env = process.env) {
  const root = resolveResumeStorageRoot(env);
  assertInsideRoot(root, directory);
  try {
    await fs.rmdir(directory);
  } catch (error) {
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST', 'EPERM'].includes(error?.code)) {
      throw error;
    }
  }
}

export async function removeEmptyResumeDirs(userId, resumeId, env = process.env) {
  await rmdirIfEmpty(resumeDir(userId, resumeId, env), env);
  await rmdirIfEmpty(resumeUserDir(userId, env), env);
}

export function publicResumeFileMetadata(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }
  return {
    id: record.id,
    originalFilename: record.originalFilename,
    contentType: record.contentType,
    byteSize: record.byteSize,
    sha256: record.sha256,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt,
  };
}
