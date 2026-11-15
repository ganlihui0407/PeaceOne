import { inflateRawSync } from 'node:zlib';
import { ResumeError } from './resumeQuery.js';
import { sanitizeOriginalFilename } from './resumeStorage.js';

export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024;
export const PDF_CONTENT_TYPE = 'application/pdf';
export const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const MAX_ZIP_ENTRIES = 1024;
const MAX_ZIP_UNCOMPRESSED_ENTRY = 16 * 1024 * 1024;
const MAX_ZIP_UNCOMPRESSED_TOTAL = 32 * 1024 * 1024;
const MAX_ZIP_NAME_LENGTH = 512;
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const ZIP64_MARKER = 0xffffffff;

const PDF_HEADER = Buffer.from('%PDF-');
const MZ_HEADER = Buffer.from([0x4d, 0x5a]);
const OLE_HEADER = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);
const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const MACRO_NAME_RE = /(^|\/)vbaproject\.bin(\/|$)|macroenabled/i;
const MACRO_CONTENT_RE = /macroenabled|vbaproject|vnd\.ms-word\.document\.macro/i;
const UNSUPPORTED_NAME_RE = /\.(exe|dll|js|html|htm|svg|docm|xlsm|pptm|zip)$/i;

function reject(status, message) {
  throw new ResumeError(status, message);
}

function skipBom(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 3;
  }
  return 0;
}

function startsWith(buffer, signature, offset = 0) {
  if (buffer.length < offset + signature.length) {
    return false;
  }
  return buffer.subarray(offset, offset + signature.length).equals(signature);
}

function latin1(buffer, start, length) {
  return buffer.subarray(start, start + length).toString('latin1');
}

function looksLikeHtmlOrSvg(buffer) {
  const start = skipBom(buffer);
  const head = latin1(buffer, start, Math.min(256, buffer.length - start))
    .trimStart()
    .toLowerCase();
  return (
    head.startsWith('<!doctype html') ||
    head.startsWith('<html') ||
    head.startsWith('<svg') ||
    head.startsWith('<?xml') && head.includes('<svg')
  );
}

function extensionOf(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) {
    return 'pdf';
  }
  if (lower.endsWith('.docx')) {
    return 'docx';
  }
  return null;
}

function findEocdOffset(buffer) {
  if (buffer.length < 22) {
    return -1;
  }
  const earliest = Math.max(0, buffer.length - 22 - 65535);
  for (let index = buffer.length - 22; index >= earliest; index -= 1) {
    if (buffer.readUInt32LE(index) !== EOCD_SIGNATURE) {
      continue;
    }
    const commentLength = buffer.readUInt16LE(index + 20);
    if (index + 22 + commentLength === buffer.length) {
      return index;
    }
  }
  return -1;
}

function readZipEntries(buffer) {
  const eocd = findEocdOffset(buffer);
  if (eocd < 0) {
    reject(400, 'Corrupted file');
  }

  const disk = buffer.readUInt16LE(eocd + 4);
  const cdDisk = buffer.readUInt16LE(eocd + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocd + 8);
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const cdSize = buffer.readUInt32LE(eocd + 12);
  const cdOffset = buffer.readUInt32LE(eocd + 16);

  if (disk !== 0 || cdDisk !== 0 || entriesOnDisk !== totalEntries) {
    reject(400, 'Corrupted file');
  }
  if (totalEntries === 0xffff || cdSize === ZIP64_MARKER || cdOffset === ZIP64_MARKER) {
    reject(400, 'Corrupted file');
  }
  if (totalEntries > MAX_ZIP_ENTRIES) {
    reject(400, 'Corrupted file');
  }
  if (cdOffset + cdSize > buffer.length || cdOffset + cdSize > eocd) {
    reject(400, 'Corrupted file');
  }

  const entries = [];
  let cursor = cdOffset;
  let uncompressedTotal = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > cdOffset + cdSize) {
      reject(400, 'Corrupted file');
    }
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      reject(400, 'Corrupted file');
    }

    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const crc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);

    if (nameLength === 0 || nameLength > MAX_ZIP_NAME_LENGTH) {
      reject(400, 'Corrupted file');
    }
    if (cursor + 46 + nameLength + extraLength + commentLength > cdOffset + cdSize) {
      reject(400, 'Corrupted file');
    }
    if (flags & 0x0001 || flags & 0x0040) {
      reject(400, 'Unsupported file format');
    }
    if (method !== 0 && method !== 8) {
      reject(400, 'Corrupted file');
    }
    if (
      compressedSize === ZIP64_MARKER ||
      uncompressedSize === ZIP64_MARKER ||
      localOffset === ZIP64_MARKER
    ) {
      reject(400, 'Corrupted file');
    }
    if (uncompressedSize > MAX_ZIP_UNCOMPRESSED_ENTRY) {
      reject(400, 'Corrupted file');
    }

    uncompressedTotal += uncompressedSize;
    if (uncompressedTotal > MAX_ZIP_UNCOMPRESSED_TOTAL) {
      reject(400, 'Corrupted file');
    }

    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (name.includes('\0') || name.includes('..') || name.startsWith('/') || name.includes('\\')) {
      reject(400, 'Corrupted file');
    }

    entries.push({
      name,
      method,
      flags,
      crc,
      compressedSize,
      uncompressedSize,
      localOffset,
    });

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  if (entries.length !== totalEntries) {
    reject(400, 'Corrupted file');
  }

  return entries;
}

function readLocalPayload(buffer, entry) {
  const offset = entry.localOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== LOCAL_SIGNATURE) {
    reject(400, 'Corrupted file');
  }

  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) {
    reject(400, 'Corrupted file');
  }

  const compressed = buffer.subarray(dataStart, dataEnd);
  if (entry.method === 0) {
    if (compressed.length !== entry.uncompressedSize) {
      reject(400, 'Corrupted file');
    }
    return compressed;
  }

  try {
    const inflated = inflateRawSync(compressed, { maxOutputLength: entry.uncompressedSize });
    if (inflated.length !== entry.uncompressedSize) {
      reject(400, 'Corrupted file');
    }
    return inflated;
  } catch {
    reject(400, 'Corrupted file');
  }
}

function validatePdf(buffer) {
  const start = skipBom(buffer);
  if (!startsWith(buffer, PDF_HEADER, start)) {
    reject(400, 'Unsupported file format');
  }
  if (looksLikeHtmlOrSvg(buffer)) {
    reject(400, 'Unsupported file format');
  }
  const preview = latin1(buffer, start, Math.min(512, buffer.length - start)).toLowerCase();
  if (preview.includes('<html') || preview.includes('<svg') || preview.includes('<!doctype html')) {
    reject(400, 'Unsupported file format');
  }
  const tail = latin1(buffer, Math.max(start, buffer.length - 1024), Math.min(1024, buffer.length));
  if (!tail.includes('%%EOF')) {
    reject(400, 'Corrupted file');
  }
}

function validateDocx(buffer) {
  if (!startsWith(buffer, ZIP_HEADER)) {
    reject(400, 'Unsupported file format');
  }

  const entries = readZipEntries(buffer);
  const names = new Set(entries.map((entry) => entry.name.replaceAll('\\', '/')));

  if (!names.has('[Content_Types].xml') || !names.has('word/document.xml')) {
    reject(400, 'Unsupported file format');
  }

  for (const entry of entries) {
    const normalised = entry.name.replaceAll('\\', '/');
    if (MACRO_NAME_RE.test(normalised) || UNSUPPORTED_NAME_RE.test(normalised)) {
      reject(400, 'Unsupported file format');
    }
  }

  const contentTypesEntry = entries.find((entry) => entry.name === '[Content_Types].xml');
  const contentTypes = readLocalPayload(buffer, contentTypesEntry).toString('utf8');
  if (MACRO_CONTENT_RE.test(contentTypes)) {
    reject(400, 'Unsupported file format');
  }
}

function detectKind(buffer) {
  const start = skipBom(buffer);
  if (startsWith(buffer, MZ_HEADER, start) || startsWith(buffer, OLE_HEADER, start)) {
    reject(400, 'Unsupported file format');
  }
  if (looksLikeHtmlOrSvg(buffer)) {
    reject(400, 'Unsupported file format');
  }
  if (startsWith(buffer, PDF_HEADER, start)) {
    return 'pdf';
  }
  if (startsWith(buffer, ZIP_HEADER)) {
    return 'docx';
  }
  reject(400, 'Unsupported file format');
}

export function validateResumeUploadBuffer(buffer, originalFilename) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    reject(400, 'Invalid request');
  }
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (bytes.length === 0) {
    reject(400, 'File is empty');
  }
  if (bytes.length > MAX_RESUME_FILE_BYTES) {
    reject(413, 'File too large');
  }

  let filename;
  try {
    filename = sanitizeOriginalFilename(originalFilename);
  } catch {
    reject(400, 'Invalid request');
  }

  const extension = extensionOf(filename);
  if (!extension) {
    reject(400, 'Unsupported file format');
  }

  const detected = detectKind(bytes);
  if (detected !== extension) {
    reject(400, 'Unsupported file format');
  }

  if (detected === 'pdf') {
    validatePdf(bytes);
    return {
      originalFilename: filename,
      storedExtension: 'pdf',
      contentType: PDF_CONTENT_TYPE,
      byteSize: bytes.length,
    };
  }

  validateDocx(bytes);
  return {
    originalFilename: filename,
    storedExtension: 'docx',
    contentType: DOCX_CONTENT_TYPE,
    byteSize: bytes.length,
  };
}
