import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  BATCH_TRANSACTION_TIMEOUT_MS,
  ESCO_ARCHIVE_FILENAME,
  ESCO_EXPECTED_VERSION,
  ESCO_EXTRACTED_DIRNAME,
  IMPORT_BATCH_SIZE,
  IMPORT_LOCK_KEY,
  OCCUPATION_HEADERS,
  OCCUPATIONS_FILE,
  RELATION_BATCH_SIZE,
  RELATION_HEADERS,
  RELATIONS_FILE,
  SKILL_HEADERS,
  SKILLS_FILE,
} from './constants.js';
import { applyPreparedGraph, emptyDbCounts } from './applyBatches.js';
import { parseEscoCsv } from './csv.js';
import { EscoImportError } from './errors.js';
import { verifyDataset } from './hash.js';
import { prepareOccupations, prepareRelations, prepareSkills } from './prepare.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const projectRoot = path.resolve(serverRoot, '..');

export function defaultEscoPaths(root = projectRoot) {
  return {
    archivePath: path.join(root, 'data', 'reference', 'esco', 'original', ESCO_ARCHIVE_FILENAME),
    extractedDir: path.join(root, 'data', 'reference', 'esco', 'extracted', ESCO_EXTRACTED_DIRNAME),
    manifestPath: path.join(root, 'data', 'reference', 'esco', 'MANIFEST.json'),
    reportsDir: path.join(root, 'data', 'reference', 'esco', 'imports'),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sanitizeReport(value) {
  const serialized = JSON.stringify(value);
  if (/DATABASE_URL|SESSION_SECRET|CSRF_SECRET|POSTGRES_PASSWORD/i.test(serialized)) {
    throw new EscoImportError('Refusing to write a report that contains secret material', {
      code: 'SECRET_LEAK',
    });
  }
  return value;
}

export function writeImportReport(reportsDir, report) {
  fs.mkdirSync(reportsDir, { recursive: true });
  const stamp = report.startedAt.replaceAll(':', '').replaceAll('.', '');
  const fileName = `esco-import-${report.version}-${report.operation}-${stamp}.json`;
  const filePath = path.join(reportsDir, fileName);
  if (fs.existsSync(filePath)) {
    throw new EscoImportError(`Import report already exists: ${fileName}`, {
      path: filePath,
      code: 'REPORT_EXISTS',
    });
  }
  const safe = sanitizeReport(report);
  fs.writeFileSync(filePath, `${JSON.stringify(safe, null, 2)}\n`, 'utf8');
  return filePath;
}

export function prepareEscoGraph({ occupationsRows, skillsRows, relationsRows }) {
  const occupations = prepareOccupations(occupationsRows, OCCUPATIONS_FILE);
  const skills = prepareSkills(skillsRows, SKILLS_FILE);
  const relations = prepareRelations(
    relationsRows,
    RELATIONS_FILE,
    occupations.uriMap,
    skills.uriMap,
  );
  return { occupations, skills, relations };
}

export function loadPreparedGraph(extractedDir) {
  const occupationsCsv = parseEscoCsv(
    fs.readFileSync(path.join(extractedDir, OCCUPATIONS_FILE)),
    OCCUPATION_HEADERS,
    OCCUPATIONS_FILE,
  );
  const skillsCsv = parseEscoCsv(
    fs.readFileSync(path.join(extractedDir, SKILLS_FILE)),
    SKILL_HEADERS,
    SKILLS_FILE,
  );
  const relationsCsv = parseEscoCsv(
    fs.readFileSync(path.join(extractedDir, RELATIONS_FILE)),
    RELATION_HEADERS,
    RELATIONS_FILE,
  );
  const graph = prepareEscoGraph({
    occupationsRows: occupationsCsv.rows,
    skillsRows: skillsCsv.rows,
    relationsRows: relationsCsv.rows,
  });
  return {
    encoding: {
      occupations: occupationsCsv.encoding,
      skills: skillsCsv.encoding,
      relations: relationsCsv.encoding,
    },
    ...graph,
  };
}

async function withImportLock(connectionString, fn) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [IMPORT_LOCK_KEY]);
    if (!result.rows[0]?.locked) {
      throw new EscoImportError('Another ESCO import is already running', {
        code: 'IMPORT_IN_PROGRESS',
      });
    }
    try {
      return await fn(client);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [IMPORT_LOCK_KEY]);
    }
  } finally {
    await client.end();
  }
}

export async function importEsco(options) {
  const startedAt = new Date();
  const mode = options.mode;
  if (mode !== 'dry-run' && mode !== 'apply') {
    throw new EscoImportError('Import mode must be --dry-run or --apply', { code: 'USAGE' });
  }

  const defaults = defaultEscoPaths(options.projectRoot ?? projectRoot);
  const archivePath = options.archivePath ?? defaults.archivePath;
  const extractedDir = options.extractedDir ?? defaults.extractedDir;
  const manifestPath = options.manifestPath ?? defaults.manifestPath;
  const reportsDir = options.reportsDir ?? defaults.reportsDir;
  const expectedVersion = options.expectedVersion ?? ESCO_EXPECTED_VERSION;
  const requireArchive = options.requireArchive !== false;

  if (!fs.existsSync(manifestPath)) {
    throw new EscoImportError(`ESCO manifest not found: ${manifestPath}`, {
      path: manifestPath,
      code: 'MANIFEST_MISSING',
    });
  }

  const manifest = readJson(manifestPath);
  const verified = verifyDataset({
    manifest,
    archivePath,
    extractedDir,
    expectedVersion,
    requireArchive,
  });
  const prepared = loadPreparedGraph(extractedDir);
  const applyRejects = [];
  const dbCounts = emptyDbCounts();
  let applyRuntime = {
    elapsedMs: 0,
    batchSize: IMPORT_BATCH_SIZE,
    relationBatchSize: RELATION_BATCH_SIZE,
    batchTimeoutMs: BATCH_TRANSACTION_TIMEOUT_MS,
    batches: 0,
    maxBatchMs: 0,
  };

  if (mode === 'apply') {
    const connectionString = options.connectionString ?? process.env.DATABASE_URL;
    if (!connectionString) {
      throw new EscoImportError('Apply requires a database connection', { code: 'DATABASE_REQUIRED' });
    }

    const applied = await withImportLock(connectionString, (client) =>
      applyPreparedGraph({
        client,
        prepared,
        failAfter: options.failAfter ?? null,
      }),
    );
    Object.assign(dbCounts, applied.counts);
    applyRejects.push(...applied.rejects);
    applyRuntime = {
      elapsedMs: applied.elapsedMs,
      batchSize: applied.batchSize,
      relationBatchSize: applied.relationBatchSize,
      batchTimeoutMs: applied.batchTimeoutMs,
      batches: applied.timings.length,
      maxBatchMs: applied.timings.reduce((max, item) => Math.max(max, item.ms), 0),
      timings: applied.timings,
    };
  }

  const finishedAt = new Date();
  const report = {
    dataset: manifest.dataset ?? 'ESCO classification English CSV',
    version: verified.version,
    operation: mode,
    status: 'ok',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    encoding: prepared.encoding,
    paths: {
      archive: verified.archivePath,
      extracted: extractedDir,
      manifest: manifestPath,
    },
    hashes: verified.hashes,
    hashVerification: 'matched',
    runtime: applyRuntime,
    occupations: prepared.occupations.counts,
    skills: prepared.skills.counts,
    relations: prepared.relations.counts,
    database: dbCounts,
    duplicates: [
      ...prepared.occupations.duplicates,
      ...prepared.skills.duplicates,
      ...prepared.relations.duplicates,
    ],
    rejects: [
      ...prepared.occupations.rejects,
      ...prepared.skills.rejects,
      ...prepared.relations.rejects,
      ...applyRejects,
    ],
  };

  if (options.writeReport !== false) {
    report.reportPath = writeImportReport(reportsDir, report);
  }

  return report;
}

function usageError(message) {
  return new EscoImportError(message, { code: 'USAGE' });
}

export function parseCliArgs(argv) {
  const args = {
    dryRun: false,
    apply: false,
    extractedDir: null,
    archivePath: null,
    manifestPath: null,
    reportsDir: null,
    expectedVersion: ESCO_EXPECTED_VERSION,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--apply') {
      args.apply = true;
    } else if (token === '--extracted') {
      args.extractedDir = argv[index + 1];
      index += 1;
    } else if (token === '--archive') {
      args.archivePath = argv[index + 1];
      index += 1;
    } else if (token === '--manifest') {
      args.manifestPath = argv[index + 1];
      index += 1;
    } else if (token === '--reports-dir') {
      args.reportsDir = argv[index + 1];
      index += 1;
    } else if (token === '--expected-version') {
      args.expectedVersion = argv[index + 1];
      index += 1;
    } else {
      throw usageError(`Unknown argument: ${token}`);
    }
  }
  if (args.dryRun === args.apply) {
    throw usageError('Specify exactly one of --dry-run or --apply');
  }
  if (args.apply && args.dryRun) {
    throw usageError('Specify exactly one of --dry-run or --apply');
  }
  return args;
}

export async function runEscoCli(argv, runtime = {}) {
  try {
    const args = parseCliArgs(argv);
    const options = {
      mode: args.apply ? 'apply' : 'dry-run',
      extractedDir: args.extractedDir ?? undefined,
      archivePath: args.archivePath ?? undefined,
      manifestPath: args.manifestPath ?? undefined,
      reportsDir: args.reportsDir ?? undefined,
      expectedVersion: args.expectedVersion,
      connectionString: runtime.connectionString,
      projectRoot: runtime.projectRoot,
      requireArchive: runtime.requireArchive,
      writeReport: runtime.writeReport,
    };
    if (args.apply) {
      options.connectionString = options.connectionString ?? process.env.DATABASE_URL;
    }
    const report = await importEsco(options);
    if (runtime.stdout) {
      runtime.stdout.write(
        `${JSON.stringify(
          {
            status: report.status,
            reportPath: report.reportPath,
            runtime: {
              elapsedMs: report.runtime?.elapsedMs,
              batches: report.runtime?.batches,
              batchSize: report.runtime?.batchSize,
              relationBatchSize: report.runtime?.relationBatchSize,
              batchTimeoutMs: report.runtime?.batchTimeoutMs,
              maxBatchMs: report.runtime?.maxBatchMs,
            },
            counts: {
              occupations: report.occupations,
              skills: report.skills,
              relations: report.relations,
              database: report.database,
            },
          },
          null,
          2,
        )}\n`,
      );
    }
    return { code: 0, report };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runtime.stderr) {
      runtime.stderr.write(`${message}\n`);
    }
    const code = error instanceof EscoImportError && error.code === 'USAGE' ? 2 : 1;
    return { code, error };
  }
}
