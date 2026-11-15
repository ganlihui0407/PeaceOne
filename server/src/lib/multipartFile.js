import { ResumeError } from './resumeQuery.js';
import { MAX_RESUME_FILE_BYTES } from './resumeFileValidation.js';

const MAX_MULTIPART_BYTES = MAX_RESUME_FILE_BYTES + 64 * 1024;
const MAX_FILENAME_HEADER = 1024;

function parseBoundary(contentType) {
  if (typeof contentType !== 'string') {
    return null;
  }
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) {
    return null;
  }
  const boundary = (match[1] || match[2] || '').trim();
  if (!boundary || boundary.length > 70) {
    return null;
  }
  return boundary;
}

async function readLimitedBody(req, maxBytes) {
  const declared = Number.parseInt(req.headers['content-length'] ?? '', 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ResumeError(413, 'File too large');
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += piece.length;
    if (total > maxBytes) {
      throw new ResumeError(413, 'File too large');
    }
    chunks.push(piece);
  }
  return chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, total);
}

function headerValue(headers, name) {
  return headers[name] ?? headers[name.toLowerCase()] ?? '';
}

function parsePartHeaders(raw) {
  const headers = {};
  for (const line of raw.split('\r\n')) {
    const index = line.indexOf(':');
    if (index <= 0) {
      continue;
    }
    headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return headers;
}

function parseContentDisposition(value) {
  const result = { name: '', filename: '' };
  if (typeof value !== 'string') {
    return result;
  }
  const nameMatch = value.match(/\bname="([^"]*)"/i);
  const fileMatch = value.match(/\bfilename="([^"]*)"/i);
  const starMatch = value.match(/\bfilename\*=(?:UTF-8'')?([^;]+)/i);
  result.name = nameMatch ? nameMatch[1] : '';
  if (starMatch) {
    try {
      result.filename = decodeURIComponent(starMatch[1].trim().replace(/^"(.*)"$/, '$1'));
    } catch {
      result.filename = starMatch[1];
    }
  } else if (fileMatch) {
    result.filename = fileMatch[1];
  }
  return result;
}

function splitParts(body, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = body.indexOf(delimiter);
  if (start !== 0 && start !== -1) {
    start = body.indexOf(Buffer.concat([Buffer.from('\r\n'), delimiter]));
  }
  if (start === -1) {
    throw new ResumeError(400, 'Invalid request');
  }

  start += start === 0 ? delimiter.length : delimiter.length + 2;
  while (start < body.length) {
    if (body[start] === 0x2d && body[start + 1] === 0x2d) {
      break;
    }
    if (body[start] === 0x0d && body[start + 1] === 0x0a) {
      start += 2;
    }
    const next = body.indexOf(Buffer.concat([Buffer.from('\r\n'), delimiter]), start);
    if (next === -1) {
      throw new ResumeError(400, 'Invalid request');
    }
    parts.push(body.subarray(start, next));
    start = next + 2 + delimiter.length;
  }
  return parts;
}

export async function readMultipartFile(req, { fieldName = 'file' } = {}) {
  const boundary = parseBoundary(req.headers['content-type']);
  if (!boundary) {
    throw new ResumeError(400, 'Invalid request');
  }

  const body = await readLimitedBody(req, MAX_MULTIPART_BYTES);
  if (body.length === 0) {
    throw new ResumeError(400, 'Invalid request');
  }

  const parts = splitParts(body, boundary);
  let file = null;

  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) {
      continue;
    }
    const headerText = part.subarray(0, headerEnd).toString('utf8');
    if (headerText.length > MAX_FILENAME_HEADER * 4) {
      throw new ResumeError(400, 'Invalid request');
    }
    const headers = parsePartHeaders(headerText);
    const disposition = parseContentDisposition(headerValue(headers, 'content-disposition'));
    if (!disposition.filename) {
      continue;
    }
    if (disposition.name !== fieldName) {
      throw new ResumeError(400, 'Invalid request');
    }
    if (file) {
      throw new ResumeError(400, 'Invalid request');
    }
    file = {
      originalFilename: disposition.filename,
      declaredMime: headerValue(headers, 'content-type') || '',
      buffer: part.subarray(headerEnd + 4),
    };
  }

  if (!file) {
    throw new ResumeError(400, 'Invalid request');
  }
  return file;
}
