import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { ResumeError } from './resumeQuery.js';
import { validateResumeUploadBuffer } from './resumeFileValidation.js';
import { readMultipartFile } from './multipartFile.js';
import {
  cleanupOwnedResumeDir,
  cleanupResumeTempFiles,
  generateStoredFilename,
  publicResumeFileMetadata,
  removeEmptyResumeDirs,
  removeResumeTempFile,
  removeStoredResumeFile,
  relocateResumeTempFile,
  resumeFilePath,
  sanitizeOriginalFilename,
  statStoredResumeFile,
  writeResumeTempFile,
} from './resumeStorage.js';

export function serializeResumeFile(record) {
  return publicResumeFileMetadata(record);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function loadOwnedResumeWithFile(client, userId, resumeId) {
  return client.resume.findFirst({
    where: { id: resumeId, userId },
    include: { file: true },
  });
}

export function contentDispositionFor(originalFilename) {
  let safe;
  try {
    safe = sanitizeOriginalFilename(originalFilename).replace(/["\\\r\n]/g, '_');
  } catch {
    safe = 'resume';
  }
  const ascii = [...safe].map((char) => (char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126 ? char : '_')).join('');
  return `attachment; filename="${ascii || 'resume'}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export async function storeOwnedResumeFile(client, userId, resumeId, upload, env = process.env) {
  try {
    await cleanupResumeTempFiles(env);
  } catch {
    // Temp cleanup is best-effort and must not block a valid upload.
  }

  const resume = await loadOwnedResumeWithFile(client, userId, resumeId);
  if (!resume) {
    throw new ResumeError(404, 'Not found');
  }

  const validated = validateResumeUploadBuffer(upload.buffer, upload.originalFilename);
  const digest = sha256(upload.buffer);
  const existing = resume.file;

  if (existing && existing.sha256 === digest) {
    return {
      created: false,
      unchanged: true,
      file: serializeResumeFile(existing),
    };
  }

  const fileId = existing?.id ?? randomUUID();
  const storedFilename = generateStoredFilename(randomUUID(), validated.storedExtension);
  const tempPath = await writeResumeTempFile(upload.buffer, env);

  try {
    await relocateResumeTempFile(tempPath, userId, resumeId, storedFilename, env);
  } catch (error) {
    await removeResumeTempFile(tempPath, env);
    throw error;
  }

  let saved;
  try {
    saved = await client.$transaction(async (tx) => {
      const owned = await tx.resume.findFirst({
        where: { id: resumeId, userId },
        include: { file: true },
      });
      if (!owned) {
        throw new ResumeError(404, 'Not found');
      }

      const data = {
        userId,
        originalFilename: validated.originalFilename,
        storedFilename,
        contentType: validated.contentType,
        byteSize: validated.byteSize,
        sha256: digest,
      };

      if (owned.file) {
        return tx.resumeFile.update({
          where: { resumeId },
          data,
        });
      }

      return tx.resumeFile.create({
        data: {
          id: fileId,
          resumeId,
          ...data,
        },
      });
    });
  } catch (error) {
    await removeStoredResumeFile(userId, resumeId, storedFilename, env);
    throw error;
  }

  if (existing?.storedFilename && existing.storedFilename !== storedFilename) {
    await removeStoredResumeFile(userId, resumeId, existing.storedFilename, env);
  }
  await cleanupOwnedResumeDir(userId, resumeId, storedFilename, env);

  return {
    created: !existing,
    unchanged: false,
    file: serializeResumeFile(saved),
  };
}

export async function sendOwnedResumeFile(client, userId, resumeId, res, env = process.env) {
  const resume = await loadOwnedResumeWithFile(client, userId, resumeId);
  if (!resume) {
    throw new ResumeError(404, 'Not found');
  }
  if (!resume.file) {
    throw new ResumeError(404, 'Not found');
  }

  const stored = resume.file.storedFilename;
  const filePath = resumeFilePath(userId, resumeId, stored, env);
  const stat = await statStoredResumeFile(userId, resumeId, stored, env);
  if (!stat?.isFile) {
    throw new ResumeError(404, 'File is unavailable');
  }

  res.setHeader('Content-Type', resume.file.contentType);
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Content-Disposition', contentDispositionFor(resume.file.originalFilename));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('error', () => {
      reject(new ResumeError(404, 'File is unavailable'));
    });
    stream.on('end', resolve);
    res.on('close', () => {
      stream.destroy();
      resolve();
    });
    stream.pipe(res);
  });
}

export async function deleteOwnedResumeFile(client, userId, resumeId, env = process.env) {
  const resume = await loadOwnedResumeWithFile(client, userId, resumeId);
  if (!resume) {
    throw new ResumeError(404, 'Not found');
  }
  if (!resume.file) {
    throw new ResumeError(404, 'Not found');
  }

  const storedFilename = resume.file.storedFilename;
  const stat = await statStoredResumeFile(userId, resumeId, storedFilename, env);
  if (stat && !stat.isFile) {
    throw new ResumeError(500, 'File could not be removed');
  }
  if (stat?.isFile) {
    try {
      await removeStoredResumeFile(userId, resumeId, storedFilename, env);
    } catch {
      throw new ResumeError(500, 'File could not be removed');
    }
  }

  await client.resumeFile.delete({ where: { resumeId } });
  await cleanupOwnedResumeDir(userId, resumeId, null, env);
  await removeEmptyResumeDirs(userId, resumeId, env);
  return { ok: true };
}

export async function uploadOwnedResumeFile(client, userId, resumeId, req, env = process.env) {
  const part = await readMultipartFile(req);
  return storeOwnedResumeFile(client, userId, resumeId, part, env);
}
