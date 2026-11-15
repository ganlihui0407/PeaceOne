'use strict';

const fs = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');
const { Client } = require('pg');

const EXPECTED = {
  unit_groups: 492,
  occupation_records: 1967,
  historical_crosswalks: 41
};

const VALID_SCOPES = [
  'V4_EXAMPLE',
  'SUPPLEMENTAL_INDEX'
];

const EXPECTED_HASH =
  '5ca2b254bee9d8153b2f1054f27e727b3af8489a51bb4bf19f86c1e71d8e644c';

const ZERO_LINKED = [
  '1219', '1619', '1629', '3139',
  '3259', '3639', '5329', '9329'
];

const ESCO_BASELINE = {
  occupations: 3039,
  skills: 13939,
  relations: 126051
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function required(value, label) {
  assert(
    typeof value === 'string' && value.trim(),
    `Invalid ${label}`
  );
  return value;
}

function optionalText(value, label) {
  if (value == null || value === '') return null;
  assert(typeof value === 'string', `Invalid ${label}`);
  return value;
}

function jsonMetadata(value, label) {
  if (value == null) return null;

  assert(
    typeof value === 'object' && !Array.isArray(value),
    `Invalid ${label}`
  );

  return JSON.stringify(value);
}

function unique(records, key, label) {
  const seen = new Set();

  for (const record of records) {
    const value = key(record);
    assert(!seen.has(value), `Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

async function count(db, table) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS n FROM ${table}`
  );
  return result.rows[0].n;
}

async function main() {
  const apply = process.argv.includes('--apply-production');
  const payloadPath = process.argv.slice(2).find(
    arg => !arg.startsWith('--')
  );

  assert(payloadPath, 'Payload path required');
  assert(fs.existsSync(payloadPath), 'Payload file not found');

  const bytes = fs.readFileSync(payloadPath);
  const hash = createHash('sha256').update(bytes).digest('hex');

  console.log('PAYLOAD SHA256:', hash);

  assert(hash === EXPECTED_HASH, 'Payload checksum mismatch');

  const payload = JSON.parse(bytes.toString('utf8'));

  for (const [name, expected] of Object.entries(EXPECTED)) {
    assert(
      Array.isArray(payload[name]) &&
      payload[name].length === expected,
      `${name}: unexpected record count`
    );
  }

  unique(payload.unit_groups, r => required(r.code, 'group code'), 'group');
  unique(payload.occupation_records, r => required(r.code, 'occupation code'), 'occupation');

  unique(
    payload.historical_crosswalks,
    r => [
      r.source_version,
      r.target_version,
      r.historical_code,
      r.current_code
    ].join('|'),
    'crosswalk'
  );

  const groupCodes = new Set(payload.unit_groups.map(r => r.code));
  const occupationCodes = new Set(
    payload.occupation_records.map(r => r.code)
  );

  for (const r of payload.unit_groups) {
    assert(
      /^\d{4}$/.test(required(r.code, 'group code')),
      `Invalid unit group code: ${r.code}`
    );

    required(r.title, `group ${r.code} title`);
    jsonMetadata(r.source_metadata, 'group metadata');
  }

  for (const r of payload.occupation_records) {
    assert(
      /^\d{4}-\d{2}$/.test(required(r.code, 'occupation code')),
      `Invalid occupation code: ${r.code}`
    );

    required(r.title, `occupation ${r.code} title`);

    assert(
      VALID_SCOPES.includes(required(r.record_scope, 'record scope')),
      `Invalid record scope: ${r.record_scope}`
    );

    assert(
      groupCodes.has(r.unit_group_code),
      `Unknown group: ${r.unit_group_code}`
    );

    assert(
      r.code.slice(0, 4) === r.unit_group_code,
      `Code/group mismatch: ${r.code}`
    );

    jsonMetadata(r.source_metadata, 'occupation metadata');
  }

  for (const r of payload.historical_crosswalks) {
    required(r.historical_code, 'historical code');
    required(r.current_code, 'current code');
    required(r.mapping_status, 'mapping status');

    assert(
      r.source_version === '2013' &&
      r.target_version === '2020',
      'Unexpected crosswalk version'
    );

    assert(
      occupationCodes.has(r.current_code),
      `Missing crosswalk target: ${r.current_code}`
    );

    jsonMetadata(r.source_metadata, 'crosswalk metadata');
  }

  const linkedGroups = new Set(
    payload.occupation_records.map(r => r.unit_group_code)
  );

  const zeroGroups = [...groupCodes]
    .filter(code => !linkedGroups.has(code))
    .sort();

  assert(
    JSON.stringify(zeroGroups) === JSON.stringify(ZERO_LINKED),
    'Zero-linked group verification failed'
  );

  const source = new URL(process.env.DATABASE_URL || '');

  const sourceHost = source.hostname.toLowerCase().trim();

  const sourceDatabase = decodeURIComponent(source.pathname)
    .replace(/\/+$/, '')
    .trim();

  assert(
    ['127.0.0.1', 'localhost'].includes(sourceHost),
    'Only local PostgreSQL is permitted'
  );

  console.log('SOURCE HOST:', sourceHost);
  console.log('SOURCE DATABASE:', sourceDatabase);

  assert(
    sourceDatabase === '/peaceone',
    `Unexpected source database: ${sourceDatabase}`
  );

  source.pathname = '/peaceone';

  console.log('TARGET DATABASE:', source.pathname);

  const db = new Client({ connectionString: source.toString() });

  await db.connect();

  let transaction = false;

  try {
    const identity = await db.query(
      'SELECT current_database() AS name'
    );

    assert(
      identity.rows[0].name === 'peaceone',
      'Wrong target database'
    );

    console.log('\nTARGET:', identity.rows[0].name);

    const escoBefore = {
      occupations: await count(db, 'occupations'),
      skills: await count(db, 'skills'),
      relations: await count(db, 'occupation_skill_relations')
    };

    assert(
      JSON.stringify(escoBefore) === JSON.stringify(ESCO_BASELINE),
      'ESCO baseline mismatch'
    );

    const protectedBefore = {
      users: await count(db, 'users'),
      sessions: await count(db, 'session'),
      user_skills: await count(db, 'user_skills')
    };

    console.log('PROTECTED DATA BEFORE:', JSON.stringify(protectedBefore));

    const tables = [
      'masco_unit_groups',
      'masco_occupation_records',
      'masco_historical_crosswalks'
    ];

    const before = {};

    for (const table of tables) {
      before[table] = await count(db, table);
    }

    assert(
      Object.values(before).every(n => n === 0),
      'MASCO tables must be empty'
    );

    console.log('BEFORE:', JSON.stringify(before));

    if (!apply) {
      console.log('\nDRY RUN: PASS');
      console.log('No database records modified.');
      return;
    }

    await db.query('BEGIN');
    transaction = true;

    await db.query("SET LOCAL lock_timeout = '10s'");
    await db.query('SELECT pg_advisory_xact_lock(2020, 492)');

    const groupIds = new Map();

    for (const r of payload.unit_groups) {
      const id = randomUUID();

      await db.query(`
        INSERT INTO masco_unit_groups
        (id, classification, version, code, title,
         description, tasks, source_metadata, updated_at)
        VALUES ($1, 'MASCO', '2020', $2, $3,
                $4, $5, $6::jsonb, CURRENT_TIMESTAMP)
      `, [
        id,
        r.code,
        r.title,
        optionalText(r.description, 'description'),
        optionalText(r.tasks, 'tasks'),
        jsonMetadata(r.source_metadata, 'group metadata')
      ]);

      groupIds.set(r.code, id);
    }

    console.log('INSERTED UNIT GROUPS:', groupIds.size);

    const recordIds = new Map();

    for (const r of payload.occupation_records) {
      const id = randomUUID();

      await db.query(`
        INSERT INTO masco_occupation_records
        (id, classification, version, code, title,
         record_scope, unit_group_id, occupation_id,
         source_metadata, updated_at)
        VALUES ($1, 'MASCO', '2020', $2, $3,
                $4, $5, NULL, $6::jsonb, CURRENT_TIMESTAMP)
      `, [
        id,
        r.code,
        r.title,
        r.record_scope,
        groupIds.get(r.unit_group_code),
        jsonMetadata(r.source_metadata, 'occupation metadata')
      ]);

      recordIds.set(r.code, id);
    }

    console.log('INSERTED OCCUPATIONS:', recordIds.size);

    for (const r of payload.historical_crosswalks) {
      await db.query(`
        INSERT INTO masco_historical_crosswalks
        (id, source_version, target_version,
         historical_code, current_code, current_record_id,
         mapping_status, review_decision, source_metadata,
         updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                $9::jsonb, CURRENT_TIMESTAMP)
      `, [
        randomUUID(),
        r.source_version,
        r.target_version,
        r.historical_code,
        r.current_code,
        recordIds.get(r.current_code),
        r.mapping_status,
        optionalText(r.review_decision, 'review decision'),
        jsonMetadata(r.source_metadata, 'crosswalk metadata')
      ]);
    }

    console.log(
      'INSERTED CROSSWALKS:',
      payload.historical_crosswalks.length
    );

    const after = {
      unit_groups: await count(db, 'masco_unit_groups'),
      occupation_records: await count(db, 'masco_occupation_records'),
      historical_crosswalks: await count(db, 'masco_historical_crosswalks')
    };

    assert(after.unit_groups === 492, 'Unit group count mismatch');
    assert(after.occupation_records === 1967, 'Occupation count mismatch');
    assert(after.historical_crosswalks === 41, 'Crosswalk count mismatch');

    const orphan = await db.query(`
      SELECT COUNT(*)::int AS n
      FROM masco_occupation_records o
      LEFT JOIN masco_unit_groups g ON g.id = o.unit_group_id
      WHERE g.id IS NULL
    `);

    const broken = await db.query(`
      SELECT COUNT(*)::int AS n
      FROM masco_historical_crosswalks c
      LEFT JOIN masco_occupation_records o
        ON o.id = c.current_record_id
      WHERE o.id IS NULL OR o.code <> c.current_code
    `);

    const escoLinks = await db.query(`
      SELECT COUNT(*)::int AS n
      FROM masco_occupation_records
      WHERE occupation_id IS NOT NULL
    `);

    assert(orphan.rows[0].n === 0, 'Orphan occupation found');
    assert(broken.rows[0].n === 0, 'Broken crosswalk found');
    assert(escoLinks.rows[0].n === 0, 'Unexpected ESCO link found');

    const escoAfter = {
      occupations: await count(db, 'occupations'),
      skills: await count(db, 'skills'),
      relations: await count(db, 'occupation_skill_relations')
    };

    assert(
      JSON.stringify(escoBefore) === JSON.stringify(escoAfter),
      'ESCO data changed'
    );

    const protectedAfter = {
      users: await count(db, 'users'),
      sessions: await count(db, 'session'),
      user_skills: await count(db, 'user_skills')
    };

    assert(
      JSON.stringify(protectedBefore) === JSON.stringify(protectedAfter),
      'Users, sessions or user skills changed'
    );

    console.log('PROTECTED DATA AFTER:', JSON.stringify(protectedAfter));
    console.log('USER AND SESSION PRESERVATION: PASS');

    console.log('AFTER:', JSON.stringify(after));
    console.log('ESCO PRESERVATION: PASS');
    console.log('FOREIGN KEY CHECK: PASS');

    await db.query('COMMIT');
    transaction = false;

    console.log('\nPRODUCTION IMPORT: COMMITTED');
    console.log('TARGET: peaceone');

  } catch (error) {
    if (transaction) {
      await db.query('ROLLBACK');
      console.error('TRANSACTION: ROLLED BACK');
    }
    throw error;
  } finally {
    await db.end();
  }
}

main().catch(error => {
  console.error('\nIMPORT FAILED:', error.message);
  process.exitCode = 1;
});