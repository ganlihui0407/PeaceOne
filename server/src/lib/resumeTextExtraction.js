import { getDocument, PasswordException, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import { DOCX_CONTENT_TYPE, PDF_CONTENT_TYPE } from './resumeFileValidation.js';

export const MAX_EXTRACTED_TEXT_CHARS = 100_000;
export const MAX_PDF_PAGES = 20;
export const EXTRACTION_TIMEOUT_MS = 10_000;

const UNREADABLE = Object.freeze({
  text: '',
  characterCount: 0,
  readable: false,
  truncated: false,
});

function unreadable() {
  return { ...UNREADABLE };
}

function isByteInput(value) {
  return Buffer.isBuffer(value) || value instanceof Uint8Array;
}

function toBuffer(value) {
  if (!isByteInput(value) || value.byteLength === 0) {
    return null;
  }
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

function copyUint8(bytes) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function normalizeExtractedText(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }

  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateText(text) {
  if (text.length <= MAX_EXTRACTED_TEXT_CHARS) {
    return { text, truncated: false };
  }

  let end = MAX_EXTRACTED_TEXT_CHARS;
  const previous = text.charCodeAt(end - 1);
  if (previous >= 0xd800 && previous <= 0xdbff) {
    end -= 1;
  }
  return { text: text.slice(0, end), truncated: true };
}

function finalizeText(raw, extraTruncated = false) {
  const normalized = normalizeExtractedText(raw);
  if (!normalized) {
    return unreadable();
  }

  const clipped = truncateText(normalized);
  return {
    text: clipped.text,
    characterCount: clipped.text.length,
    readable: true,
    truncated: extraTruncated || clipped.truncated,
  };
}

async function withTimeout(work, timeoutMs) {
  const limit = Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : EXTRACTION_TIMEOUT_MS;
  let timer;
  try {
    return await Promise.race([
      work(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('Extraction timeout');
          error.code = 'EXTRACTION_TIMEOUT';
          reject(error);
        }, limit);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function pageTextFromContent(textContent) {
  const items = Array.isArray(textContent?.items) ? textContent.items : [];
  let output = '';
  for (const item of items) {
    if (!item || typeof item !== 'object' || typeof item.str !== 'string') {
      continue;
    }
    output += item.str;
    output += item.hasEOL ? '\n' : ' ';
  }
  return output;
}

async function extractPdfTextUnbounded(bytes) {
  let loadingTask;
  try {
    loadingTask = getDocument({
      data: copyUint8(bytes),
      disableRange: true,
      disableStream: true,
      disableAutoFetch: true,
      disableFontFace: true,
      useSystemFonts: false,
      useWasm: false,
      useWorkerFetch: false,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      enableXfa: false,
      stopAtErrors: true,
      verbosity: VerbosityLevel.ERRORS,
    });

    const pdf = await loadingTask.promise;
    const pageCount = Number.isInteger(pdf.numPages) ? pdf.numPages : 0;
    if (pageCount < 1) {
      await pdf.cleanup();
      return unreadable();
    }

    const pagesToRead = Math.min(pageCount, MAX_PDF_PAGES);
    const parts = [];
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({ includeMarkedContent: false });
      parts.push(pageTextFromContent(content));
      page.cleanup();
    }

    await pdf.cleanup();
    return finalizeText(parts.join('\n'), pageCount > MAX_PDF_PAGES);
  } catch (error) {
    if (error instanceof PasswordException || error?.code === 'EXTRACTION_TIMEOUT') {
      return unreadable();
    }
    return unreadable();
  } finally {
    try {
      await loadingTask?.destroy();
    } catch {
      // Loading-task cleanup is best-effort.
    }
  }
}

async function extractDocxTextUnbounded(bytes) {
  try {
    const result = await mammoth.extractRawText({ buffer: toBuffer(bytes) });
    if (typeof result?.value !== 'string') {
      return unreadable();
    }
    return finalizeText(result.value);
  } catch {
    return unreadable();
  }
}

export async function extractPdfText(buffer, options = {}) {
  const bytes = toBuffer(buffer);
  if (!bytes) {
    return unreadable();
  }

  try {
    return await withTimeout(() => extractPdfTextUnbounded(bytes), options.timeoutMs);
  } catch {
    return unreadable();
  }
}

export async function extractDocxText(buffer, options = {}) {
  const bytes = toBuffer(buffer);
  if (!bytes) {
    return unreadable();
  }

  try {
    return await withTimeout(() => extractDocxTextUnbounded(bytes), options.timeoutMs);
  } catch {
    return unreadable();
  }
}

export async function extractResumeText(buffer, contentType, options = {}) {
  const bytes = toBuffer(buffer);
  if (!bytes) {
    return unreadable();
  }

  const type = typeof contentType === 'string' ? contentType.trim().toLowerCase() : '';
  const extractors = options.extractors ?? {};

  try {
    if (type === PDF_CONTENT_TYPE) {
      const extract = extractors.pdf ?? extractPdfTextUnbounded;
      return await withTimeout(() => extract(bytes, options), options.timeoutMs);
    }
    if (type === DOCX_CONTENT_TYPE) {
      const extract = extractors.docx ?? extractDocxTextUnbounded;
      return await withTimeout(() => extract(bytes, options), options.timeoutMs);
    }
  } catch {
    return unreadable();
  }

  return unreadable();
}
