import { deflateRawSync } from 'node:zlib';
import { MAX_RESUME_FILE_BYTES } from '../src/lib/resumeFileValidation.js';

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer) {
  let hash = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    hash = CRC_TABLE[(hash ^ buffer[index]) & 0xff] ^ (hash >>> 8);
  }
  return (hash ^ 0xffffffff) >>> 0;
}

function encodeName(name) {
  return Buffer.from(name, 'utf8');
}

export function zipEntries(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = encodeName(file.name);
    const uncompressed = Buffer.from(file.data);
    const usedMethod = file.method ?? 0;
    const payload = usedMethod === 8 ? deflateRawSync(uncompressed) : uncompressed;
    const crc = crc32(uncompressed);
    const uncompressedSize = file.uncompressedSize ?? uncompressed.length;
    const compressedSize = file.compressedSize ?? payload.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(usedMethod, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressedSize, 18);
    local.writeUInt32LE(uncompressedSize, 22);
    local.writeUInt16LE(name.length, 26);

    const localFull = Buffer.concat([local, name, payload]);
    localParts.push(localFull);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(usedMethod, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressedSize, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(Buffer.concat([central, name]));
    offset += localFull.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDir, eocd]);
}

const CONTENT_TYPES = Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
`);

const DOCUMENT_XML = Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>PeaceOne resume</w:t></w:r></w:p></w:body>
</w:document>
`);

const RELS = Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
`);

export function validPdf() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
}

function pdfEscape(text) {
  return String(text).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function assemblePdf(objectBodies) {
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
  chunks.push(
    `trailer\n<< /Size ${objectBodies.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );
  return Buffer.from(chunks.join(''), 'latin1');
}

export function textPdf(pageTexts) {
  const pages = Array.isArray(pageTexts) ? pageTexts : [pageTexts];
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  for (let index = 0; index < pages.length; index += 1) {
    const pageObject = 4 + index;
    const contentObject = 4 + pages.length + index;
    const stream = `BT /F1 12 Tf 72 720 Td (${pdfEscape(pages[index] ?? '')}) Tj ET`;
    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObject} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    objects[contentObject] =
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  }
  return assemblePdf(objects);
}

export function emptyTextPdf() {
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] =
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>';
  objects[4] = '<< /Length 6 >>\nstream\nBT ET\nendstream';
  return assemblePdf(objects);
}

export function docxWithText(text) {
  const document = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
</w:document>
`,
  );
  return validDocx({ document });
}

export function validDocx(overrides = {}) {
  return zipEntries([
    { name: '[Content_Types].xml', data: overrides.contentTypes ?? CONTENT_TYPES },
    { name: '_rels/.rels', data: RELS },
    { name: 'word/document.xml', data: overrides.document ?? DOCUMENT_XML },
    ...(overrides.extra ?? []),
  ]);
}

export function malformedPdf() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');
}

export function malformedDocx() {
  return Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02, 0x03, 0xff, 0xff]);
}

export function renamedExecutable() {
  const buffer = Buffer.alloc(64, 0);
  buffer[0] = 0x4d;
  buffer[1] = 0x5a;
  buffer.write('This program cannot be run', 64 - 26);
  return buffer;
}

export function htmlDocument() {
  return Buffer.from('<!DOCTYPE html><html><body>not a resume</body></html>');
}

export function svgDocument() {
  return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
}

export function macroDocx() {
  return validDocx({
    extra: [{ name: 'word/vbaProject.bin', data: Buffer.from('macro') }],
  });
}

export function zipBombDocx() {
  return zipEntries([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: 'word/document.xml', data: DOCUMENT_XML, uncompressedSize: 64 * 1024 * 1024, compressedSize: DOCUMENT_XML.length },
  ]);
}

export function tooManyZipEntries() {
  const extra = [];
  for (let index = 0; index < 1025; index += 1) {
    extra.push({ name: `word/media/pad${index}.xml`, data: Buffer.from('<a/>') });
  }
  return validDocx({ extra });
}

export function oversizedPdf() {
  const buffer = Buffer.alloc(MAX_RESUME_FILE_BYTES + 1, 0x20);
  buffer.write('%PDF-1.4\n', 0);
  buffer.write('%%EOF', buffer.length - 5);
  return buffer;
}
