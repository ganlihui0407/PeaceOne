import { findOwnedResume, ResumeError } from './resumeQuery.js';
import { contentDispositionFor } from './resumeFileQuery.js';
import { generateResumePdf } from './resumePdf.js';
import { pdfFilenameFromTitle } from './resumeViewModel.js';

export async function sendOwnedResumePdf(client, userId, resumeId, res) {
  const resume = await findOwnedResume(client, userId, resumeId);
  if (!resume) {
    throw new ResumeError(404, 'Not found');
  }

  let pdf;
  try {
    pdf = await generateResumePdf(resume);
  } catch {
    throw new ResumeError(500, 'The resume PDF could not be generated.');
  }

  if (!Buffer.isBuffer(pdf) || pdf.length < 5 || pdf.subarray(0, 4).toString('latin1') !== '%PDF') {
    throw new ResumeError(500, 'The resume PDF could not be generated.');
  }

  const filename = pdfFilenameFromTitle(resume.title);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(pdf.length));
  res.setHeader('Content-Disposition', contentDispositionFor(filename));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(pdf);
}
