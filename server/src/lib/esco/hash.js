import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EscoImportError } from './errors.js';
import {
  ESCO_ARCHIVE_FILENAME,
  ESCO_EXPECTED_VERSION,
  OCCUPATIONS_FILE,
  RELATIONS_FILE,
  SKILLS_FILE,
} from './constants.js';

export function sha256Buffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function findExtractedHash(manifest, fileName) {
  const entry = (manifest.hashes?.extracted_files ?? []).find((item) => item.file === fileName);
  if (!entry?.sha256) {
    throw new EscoImportError(`Manifest is missing hash for ${fileName}`, {
      file: fileName,
      code: 'MANIFEST_INCOMPLETE',
    });
  }
  return { sha256: String(entry.sha256).toLowerCase(), bytes: entry.bytes };
}

export function verifyDataset({
  manifest,
  archivePath,
  extractedDir,
  expectedVersion = ESCO_EXPECTED_VERSION,
  requireArchive = true,
}) {
  const version = manifest.version_from_filename;
  if (version !== expectedVersion) {
    throw new EscoImportError(
      `ESCO version mismatch: expected ${expectedVersion}, found ${version ?? 'missing'}`,
      {
        expectedVersion,
        actualVersion: version ?? null,
        code: 'VERSION_MISMATCH',
      },
    );
  }

  const hashes = {
    archive: null,
    occupations: null,
    skills: null,
    relations: null,
  };

  if (requireArchive) {
    if (!archivePath || !fs.existsSync(archivePath)) {
      throw new EscoImportError(`ESCO archive not found: ${archivePath ?? ESCO_ARCHIVE_FILENAME}`, {
        path: archivePath ?? null,
        code: 'ARCHIVE_MISSING',
      });
    }
    const archiveBuffer = fs.readFileSync(archivePath);
    const actual = sha256Buffer(archiveBuffer);
    const expected = String(manifest.hashes?.archive?.sha256 ?? '').toLowerCase();
    if (!expected || actual !== expected) {
      throw new EscoImportError('ESCO archive hash mismatch', {
        file: path.basename(archivePath),
        expected,
        actual,
        code: 'HASH_MISMATCH',
      });
    }
    if (
      Number.isInteger(manifest.hashes?.archive?.bytes) &&
      archiveBuffer.length !== manifest.hashes.archive.bytes
    ) {
      throw new EscoImportError('ESCO archive size mismatch', {
        file: path.basename(archivePath),
        expected: manifest.hashes.archive.bytes,
        actual: archiveBuffer.length,
        code: 'SIZE_MISMATCH',
      });
    }
    hashes.archive = { sha256: actual, bytes: archiveBuffer.length };
  }

  const files = [
    ['occupations', OCCUPATIONS_FILE],
    ['skills', SKILLS_FILE],
    ['relations', RELATIONS_FILE],
  ];
  for (const [key, fileName] of files) {
    const filePath = path.join(extractedDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new EscoImportError(`ESCO CSV not found: ${fileName}`, {
        file: fileName,
        path: filePath,
        code: 'CSV_MISSING',
      });
    }
    const buffer = fs.readFileSync(filePath);
    const actual = sha256Buffer(buffer);
    const expected = findExtractedHash(manifest, fileName);
    if (actual !== expected.sha256) {
      throw new EscoImportError(`ESCO CSV hash mismatch: ${fileName}`, {
        file: fileName,
        expected: expected.sha256,
        actual,
        code: 'HASH_MISMATCH',
      });
    }
    if (Number.isInteger(expected.bytes) && buffer.length !== expected.bytes) {
      throw new EscoImportError(`ESCO CSV size mismatch: ${fileName}`, {
        file: fileName,
        expected: expected.bytes,
        actual: buffer.length,
        code: 'SIZE_MISMATCH',
      });
    }
    hashes[key] = { sha256: actual, bytes: buffer.length, file: fileName };
  }

  return {
    version,
    hashes,
    archivePath: requireArchive ? archivePath : null,
    extractedDir,
  };
}
