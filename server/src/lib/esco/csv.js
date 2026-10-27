import { parse } from 'csv-parse/sync';
import { EscoImportError } from './errors.js';

export function decodeUtf8(buffer, fileName) {
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const payload = hasBom ? buffer.subarray(3) : buffer;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(payload);
    return { text, encoding: hasBom ? 'utf-8-bom' : 'utf-8' };
  } catch {
    throw new EscoImportError(`Invalid UTF-8 encoding in ${fileName}`, {
      file: fileName,
      code: 'INVALID_ENCODING',
    });
  }
}

export function parseEscoCsv(buffer, expectedHeaders, fileName) {
  const { text, encoding } = decodeUtf8(buffer, fileName);
  let records;
  try {
    records = parse(text, {
      bom: false,
      columns: false,
      relax_column_count: false,
      skip_empty_lines: false,
      trim: false,
      relax_quotes: false,
      quote: '"',
      escape: '"',
    });
  } catch (error) {
    throw new EscoImportError(`CSV parse error in ${fileName}: ${error.message}`, {
      file: fileName,
      rowNumber: Number.isInteger(error.lines) ? error.lines : null,
      code: 'CSV_PARSE',
    });
  }

  if (!records.length) {
    throw new EscoImportError(`Missing CSV header in ${fileName}`, {
      file: fileName,
      code: 'HEADER_MISMATCH',
    });
  }

  const header = records[0].map((value) => String(value ?? ''));
  if (
    header.length !== expectedHeaders.length ||
    expectedHeaders.some((name, index) => header[index] !== name)
  ) {
    throw new EscoImportError(`Unexpected CSV header in ${fileName}`, {
      file: fileName,
      expected: expectedHeaders,
      actual: header,
      code: 'HEADER_MISMATCH',
    });
  }

  const rows = [];
  for (let index = 1; index < records.length; index += 1) {
    const record = records[index];
    if (record.length === 1 && record[0] === '' && index === records.length - 1) {
      continue;
    }
    if (record.length !== expectedHeaders.length) {
      throw new EscoImportError(`CSV column count mismatch in ${fileName}`, {
        file: fileName,
        rowNumber: index + 1,
        expected: expectedHeaders.length,
        actual: record.length,
        code: 'COLUMN_COUNT',
      });
    }
    const fields = {};
    for (let column = 0; column < expectedHeaders.length; column += 1) {
      fields[expectedHeaders[column]] = record[column] ?? '';
    }
    rows.push({ rowNumber: index + 1, fields });
  }

  return { encoding, header, rows };
}

export function emptyToNull(value) {
  return (value ?? '').trim() === '' ? null : value;
}

export function requiredText(value) {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}
