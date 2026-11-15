import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResumeError } from '../src/lib/resumeQuery.js';
import {
  MAX_RESUME_FILE_BYTES,
  validateResumeUploadBuffer,
} from '../src/lib/resumeFileValidation.js';
import {
  htmlDocument,
  macroDocx,
  malformedDocx,
  malformedPdf,
  renamedExecutable,
  svgDocument,
  tooManyZipEntries,
  validDocx,
  validPdf,
  zipBombDocx,
} from './resumeFileFixtures.js';

function assertRejects(buffer, filename, status, message) {
  assert.throws(
    () => validateResumeUploadBuffer(buffer, filename),
    (error) => error instanceof ResumeError && error.status === status && error.message === message,
  );
}

test('accepts valid PDF and DOCX bytes and ignores declared MIME type', () => {
  const pdf = validateResumeUploadBuffer(validPdf(), 'C:\\\\Users\\\\x\\\\Software_CV.pdf');
  assert.equal(pdf.originalFilename, 'Software_CV.pdf');
  assert.equal(pdf.storedExtension, 'pdf');
  assert.equal(pdf.contentType, 'application/pdf');
  assert.equal(pdf.byteSize, validPdf().length);

  const docx = validateResumeUploadBuffer(validDocx(), ' intern-cv.DOCX ');
  assert.equal(docx.originalFilename, 'intern-cv.DOCX');
  assert.equal(docx.storedExtension, 'docx');
  assert.equal(docx.contentType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

test('rejects empty, oversized, mismatched, executable and corrupted uploads', () => {
  assertRejects(Buffer.alloc(0), 'resume.pdf', 400, 'File is empty');
  assertRejects(Buffer.alloc(MAX_RESUME_FILE_BYTES + 1), 'resume.pdf', 413, 'File too large');
  assertRejects(validPdf(), 'resume.docx', 400, 'Unsupported file format');
  assertRejects(validDocx(), 'resume.pdf', 400, 'Unsupported file format');
  assertRejects(renamedExecutable(), 'resume.pdf', 400, 'Unsupported file format');
  assertRejects(htmlDocument(), 'resume.pdf', 400, 'Unsupported file format');
  assertRejects(svgDocument(), 'resume.pdf', 400, 'Unsupported file format');
  assertRejects(malformedPdf(), 'resume.pdf', 400, 'Corrupted file');
  assertRejects(malformedDocx(), 'resume.docx', 400, 'Corrupted file');
  assertRejects(macroDocx(), 'resume.docx', 400, 'Unsupported file format');
  assertRejects(zipBombDocx(), 'resume.docx', 400, 'Corrupted file');
  assertRejects(tooManyZipEntries(), 'resume.docx', 400, 'Corrupted file');
  assertRejects(validPdf(), 'resume.exe', 400, 'Unsupported file format');
});
