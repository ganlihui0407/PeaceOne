import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOCX_CONTENT_TYPE, PDF_CONTENT_TYPE } from '../src/lib/resumeFileValidation.js';
import {
  EXTRACTION_TIMEOUT_MS,
  MAX_EXTRACTED_TEXT_CHARS,
  MAX_PDF_PAGES,
  extractDocxText,
  extractPdfText,
  extractResumeText,
} from '../src/lib/resumeTextExtraction.js';
import { malformedDocx, malformedPdf, validDocx } from './resumeFileFixtures.js';

function pdfEscape(text) {
  return text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function assemblePdf(objectBodies, trailerExtra = '') {
  const header = '%PDF-1.4\n';
  const chunks = [header];
  const offsets = [0];
  let offset = Buffer.byteLength(header, 'latin1');

  for (let index = 1; index < objectBodies.length; index += 1) {
    offsets[index] = offset;
    const body = `${index} 0 obj\n${objectBodies[index]}\nendobj\n`;
    chunks.push(body);
    offset += Buffer.byteLength(body, 'latin1');
  }

  const xrefStart = offset;
  let xref = `xref\n0 ${objectBodies.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objectBodies.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  chunks.push(xref);

  const trailer = `trailer\n<< /Size ${objectBodies.length} /Root 1 0 R${trailerExtra} >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(trailer);
  return Buffer.from(chunks.join(''), 'latin1');
}

function textPdf(pageTexts) {
  const pages = Array.isArray(pageTexts) ? pageTexts : [pageTexts];
  const pageCount = pages.length;
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const kids = pages.map((_, index) => `${4 + index} 0 R`).join(' ');
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  for (let index = 0; index < pageCount; index += 1) {
    const pageObject = 4 + index;
    const contentObject = 4 + pageCount + index;
    const stream = `BT /F1 12 Tf 72 720 Td (${pdfEscape(pages[index] ?? '')}) Tj ET`;
    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObject} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    objects[contentObject] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  }

  return assemblePdf(objects);
}

function emptyPdf() {
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] =
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>';
  objects[4] = '<< /Length 6 >>\nstream\nBT ET\nendstream';
  return assemblePdf(objects);
}

function encryptedPdf() {
  const pad = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>';
  objects[4] = `<< /Filter /Standard /V 1 /R 2 /O (${pad}) /U (${pad}) /P -4 >>`;
  return assemblePdf(
    objects,
    ' /Encrypt 4 0 R /ID [<11111111111111111111111111111111> <11111111111111111111111111111111>]',
  );
}

function docxWithText(text) {
  const document = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
</w:document>
`,
  );
  return validDocx({ document });
}

function emptyDocx() {
  return docxWithText('');
}

function assertUnreadable(result) {
  assert.deepEqual(result, {
    text: '',
    characterCount: 0,
    readable: false,
    truncated: false,
  });
}

test('extracts text from a text-based PDF', async () => {
  const result = await extractPdfText(textPdf('PeaceOne software internship'));
  assert.equal(result.readable, true);
  assert.equal(result.truncated, false);
  assert.match(result.text, /PeaceOne software internship/);
  assert.equal(result.characterCount, result.text.length);
});

test('extracts plain text from a valid DOCX', async () => {
  const result = await extractDocxText(docxWithText('PeaceOne resume'));
  assert.equal(result.readable, true);
  assert.equal(result.truncated, false);
  assert.equal(result.text, 'PeaceOne resume');
  assert.equal(result.characterCount, 'PeaceOne resume'.length);
});

test('treats an empty PDF as unreadable', async () => {
  assertUnreadable(await extractPdfText(emptyPdf()));
});

test('treats an empty DOCX as unreadable', async () => {
  assertUnreadable(await extractDocxText(emptyDocx()));
});

test('treats a malformed PDF as unreadable', async () => {
  assertUnreadable(await extractPdfText(malformedPdf()));
});

test('treats a malformed DOCX as unreadable', async () => {
  assertUnreadable(await extractDocxText(malformedDocx()));
});

test('rejects unsupported content types without extracting', async () => {
  const pdf = textPdf('should not be read');
  assertUnreadable(await extractResumeText(pdf, 'text/plain'));
  assertUnreadable(await extractResumeText(pdf, 'application/msword'));
  assertUnreadable(await extractResumeText(pdf, ''));
  assertUnreadable(await extractResumeText(pdf, null));
});

test('treats an encrypted PDF as unreadable', async () => {
  assertUnreadable(await extractPdfText(encryptedPdf()));
});

test('stops PDF extraction after 20 pages and marks truncated', async () => {
  const pages = [];
  for (let index = 1; index <= MAX_PDF_PAGES + 1; index += 1) {
    pages.push(`Page ${index} content`);
  }
  const result = await extractPdfText(textPdf(pages));
  assert.equal(result.readable, true);
  assert.equal(result.truncated, true);
  assert.match(result.text, /Page 1 content/);
  assert.match(result.text, new RegExp(`Page ${MAX_PDF_PAGES} content`));
  assert.doesNotMatch(result.text, new RegExp(`Page ${MAX_PDF_PAGES + 1} content`));
});

test('truncates extracted text at 100,000 characters', async () => {
  const payload = 'A'.repeat(MAX_EXTRACTED_TEXT_CHARS + 25);
  const result = await extractDocxText(docxWithText(payload));
  assert.equal(result.readable, true);
  assert.equal(result.truncated, true);
  assert.equal(result.characterCount, MAX_EXTRACTED_TEXT_CHARS);
  assert.equal(result.text.length, MAX_EXTRACTED_TEXT_CHARS);
  assert.equal(result.text, 'A'.repeat(MAX_EXTRACTED_TEXT_CHARS));
});

test('returns unreadable when extraction exceeds the timeout', async () => {
  const result = await extractResumeText(textPdf('late'), PDF_CONTENT_TYPE, {
    timeoutMs: 25,
    extractors: {
      pdf: async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 200);
        });
        return {
          text: 'should not leak',
          characterCount: 15,
          readable: true,
          truncated: false,
        };
      },
    },
  });
  assertUnreadable(result);
  assert.equal(EXTRACTION_TIMEOUT_MS, 10_000);
});

test('validates input buffers and empty documents', async () => {
  assertUnreadable(await extractResumeText(null, PDF_CONTENT_TYPE));
  assertUnreadable(await extractResumeText(undefined, DOCX_CONTENT_TYPE));
  assertUnreadable(await extractResumeText('not-bytes', PDF_CONTENT_TYPE));
  assertUnreadable(await extractResumeText({}, PDF_CONTENT_TYPE));
  assertUnreadable(await extractResumeText(Buffer.alloc(0), PDF_CONTENT_TYPE));
  assertUnreadable(await extractPdfText(new Uint8Array()));
  assertUnreadable(await extractDocxText(Buffer.alloc(0)));
});

test('extractResumeText dispatches PDF and DOCX by detected content type', async () => {
  const pdf = await extractResumeText(textPdf('ICT safety'), PDF_CONTENT_TYPE);
  assert.equal(pdf.readable, true);
  assert.match(pdf.text, /ICT safety/);

  const docx = await extractResumeText(docxWithText('Teamwork'), DOCX_CONTENT_TYPE);
  assert.equal(docx.readable, true);
  assert.equal(docx.text, 'Teamwork');
});
