import fs from 'node:fs';
import path from 'node:path';
import {
  OCCUPATION_HEADERS,
  RELATION_HEADERS,
  SKILL_HEADERS,
} from '../src/lib/esco/constants.js';
import { sha256Buffer } from '../src/lib/esco/hash.js';

export function csvField(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function csvTable(headers, rows) {
  const lines = [headers.map(csvField).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvField(row[header] ?? '')).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

export function occupationFields(overrides = {}) {
  return {
    conceptType: 'Occupation',
    conceptUri: 'http://data.europa.eu/esco/occupation/test-a',
    iscoGroup: '2354',
    preferredLabel: 'test occupation',
    altLabels: '',
    hiddenLabels: '',
    status: 'released',
    modifiedDate: '2025-07-31T09:38:59.122Z',
    regulatedProfessionNote: '',
    scopeNote: '',
    definition: '',
    inScheme: 'http://data.europa.eu/esco/concept-scheme/occupations',
    description: '',
    code: '2354.1',
    naceCode: '',
    ...overrides,
  };
}

export function skillFields(overrides = {}) {
  return {
    conceptType: 'KnowledgeSkillCompetence',
    conceptUri: 'http://data.europa.eu/esco/skill/test-a',
    skillType: 'skill/competence',
    reuseLevel: 'cross-sector',
    preferredLabel: 'test skill',
    altLabels: '',
    hiddenLabels: '',
    status: 'released',
    modifiedDate: '2025-07-31T09:41:33.786Z',
    scopeNote: '',
    definition: '',
    inScheme: 'http://data.europa.eu/esco/concept-scheme/skills',
    description: '',
    ...overrides,
  };
}

export function relationFields(overrides = {}) {
  return {
    occupationUri: 'http://data.europa.eu/esco/occupation/test-a',
    occupationLabel: 'test occupation',
    relationType: 'essential',
    skillType: 'skill/competence',
    skillUri: 'http://data.europa.eu/esco/skill/test-a',
    skillLabel: 'test skill',
    ...overrides,
  };
}

export function writeFixtureDataset(rootDir, spec = {}) {
  const version = spec.version ?? 'v1.2.1';
  const extractedDir = path.join(rootDir, 'extracted');
  const originalDir = path.join(rootDir, 'original');
  fs.mkdirSync(extractedDir, { recursive: true });
  fs.mkdirSync(originalDir, { recursive: true });

  const occupationsCsv = csvTable(OCCUPATION_HEADERS, spec.occupations ?? [occupationFields()]);
  const skillsCsv = csvTable(SKILL_HEADERS, spec.skills ?? [skillFields()]);
  const relationsCsv = csvTable(RELATION_HEADERS, spec.relations ?? [relationFields()]);
  const archiveBuffer = Buffer.from(spec.archiveContents ?? `esco-fixture-archive-${version}`);

  fs.writeFileSync(path.join(extractedDir, 'occupations_en.csv'), occupationsCsv);
  fs.writeFileSync(path.join(extractedDir, 'skills_en.csv'), skillsCsv);
  fs.writeFileSync(path.join(extractedDir, 'occupationSkillRelations_en.csv'), relationsCsv);

  const archivePath = path.join(originalDir, spec.archiveFilename ?? 'ESCO dataset - v1.2.1 - classification - en - csv.zip');
  fs.writeFileSync(archivePath, archiveBuffer);

  const files = [
    ['occupations_en.csv', Buffer.from(occupationsCsv)],
    ['skills_en.csv', Buffer.from(skillsCsv)],
    ['occupationSkillRelations_en.csv', Buffer.from(relationsCsv)],
  ];
  const manifest = {
    dataset: 'ESCO classification English CSV',
    version_from_filename: version,
    hashes: {
      archive: {
        sha256: spec.archiveHash ?? sha256Buffer(archiveBuffer),
        bytes: spec.archiveBytes ?? archiveBuffer.length,
      },
      extracted_files: files.map(([file, buffer]) => ({
        file,
        bytes: buffer.length,
        sha256: sha256Buffer(buffer),
      })),
    },
  };
  if (spec.corruptSkillHash) {
    const skillsEntry = manifest.hashes.extracted_files.find((item) => item.file === 'skills_en.csv');
    skillsEntry.sha256 = '0'.repeat(64);
  }
  const manifestPath = path.join(rootDir, 'MANIFEST.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    rootDir,
    extractedDir,
    archivePath,
    manifestPath,
    reportsDir: path.join(rootDir, 'imports'),
  };
}
