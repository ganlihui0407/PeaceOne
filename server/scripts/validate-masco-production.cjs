
'use strict';

const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { Client } = require('pg');

const EXPECTED_HASH =
  '5ca2b254bee9d8153b2f1054f27e727b3af8489a51bb4bf19f86c1e71d8e644c';

const EXPECTED = {
  unit_groups: 492,
  occupations: 1967,
  crosswalks: 41
};

const ESCO_BASELINE = {
  occupations: 3039,
  skills: 13939,
  relations: 126051
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function count(db, table) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS n FROM "${table}"`
  );
  return result.rows[0].n;
}

async function main() {
  const payloadPath = process.argv[2];

  assert(payloadPath, 'Payload path required');
  assert(fs.existsSync(payloadPath), 'Payload not found');

  const bytes = fs.readFileSync(payloadPath);
  const hash = createHash('sha256')
    .update(bytes)
    .digest('hex');

  console.log('PAYLOAD SHA256:', hash);

  assert(hash === EXPECTED_HASH, 'Payload checksum mismatch');

  const payload = JSON.parse(bytes.toString('utf8'));

  assert(payload.unit_groups.length === EXPECTED.unit_groups,
    'Unit group count mismatch');

  assert(payload.occupation_records.length === EXPECTED.occupations,
    'Occupation count mismatch');

  assert(payload.historical_crosswalks.length === EXPECTED.crosswalks,
    'Crosswalk count mismatch');

  const url = new URL(process.env.DATABASE_URL || '');

  assert(
    ['127.0.0.1', 'localhost'].includes(url.hostname),
    'Unexpected database host'
  );

  assert(
    decodeURIComponent(url.pathname).replace(/^\/+/, '') === 'peaceone',
    'Production database identity mismatch'
  );

  console.log('DATABASE HOST:', url.hostname);
  console.log('EXPECTED DATABASE: peaceone');

  const db = new Client({
    connectionString: url.toString()
  });

  await db.connect();

  try {
    await db.query('BEGIN READ ONLY');

    const identity = await db.query(
      'SELECT current_database() AS name'
    );

    assert(
      identity.rows[0].name === 'peaceone',
      'Connected to wrong database'
    );

    console.log('\nDATABASE:', identity.rows[0].name);

    const esco = {
      occupations: await count(db, 'occupations'),
      skills: await count(db, 'skills'),
      relations: await count(db, 'occupation_skill_relations')
    };

    assert(
      JSON.stringify(esco) === JSON.stringify(ESCO_BASELINE),
      'ESCO baseline mismatch'
    );

    console.log('ESCO:', JSON.stringify(esco));

    const masco = {
      unit_groups: await count(db, 'masco_unit_groups'),
      occupations: await count(db, 'masco_occupation_records'),
      crosswalks: await count(db, 'masco_historical_crosswalks')
    };

    assert(
      Object.values(masco).every(n => n === 0),
      'Production MASCO tables are not empty. STOP.'
    );

    console.log('MASCO:', JSON.stringify(masco));

    const protectedData = {
      users: await count(db, 'users'),
      sessions: await count(db, 'session'),
      user_skills: await count(db, 'user_skills')
    };

    console.log(
      'PROTECTED DATA:',
      JSON.stringify(protectedData)
    );

    await db.query('ROLLBACK');

    console.log('\nREAD-ONLY VERIFICATION: PASS');
    console.log('NO DATABASE RECORDS MODIFIED');

  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await db.end();
  }
}

main().catch(error => {
  console.error('\nVERIFICATION FAILED:', error.message);
  process.exitCode = 1;
});
