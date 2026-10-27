import pg from 'pg';
import { config } from '../src/config.js';
import { createPrismaClient } from '../src/db.js';
import { ESCO_SOURCE_SYSTEM } from '../src/lib/esco/constants.js';
import { importEsco } from '../src/lib/esco/importEsco.js';
import {
  ESCO_TEST_DB_NAME,
  PEACEONE_DB_NAME,
  assertCurrentDatabase,
  databaseNameFromUrl,
} from '../test/escoTestDb.js';

function countsFromClient(label, rows) {
  return {
    label,
    occupations: Number(rows.occupations),
    skills: Number(rows.skills),
    relations: Number(rows.relations),
    userSkills: Number(rows.user_skills),
    users: Number(rows.users),
    sessions: Number(rows.sessions),
  };
}

async function tableCounts(client) {
  const result = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM occupations) AS occupations,
      (SELECT COUNT(*) FROM skills) AS skills,
      (SELECT COUNT(*) FROM occupation_skill_relations) AS relations,
      (SELECT COUNT(*) FROM user_skills) AS user_skills,
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM session) AS sessions
  `);
  return result.rows[0];
}

const developmentName = databaseNameFromUrl(config.databaseUrl);
if (developmentName !== PEACEONE_DB_NAME) {
  throw new Error(`Expected development DATABASE_URL to target ${PEACEONE_DB_NAME}`);
}

const testUrl = new URL(config.databaseUrl);
testUrl.pathname = `/${ESCO_TEST_DB_NAME}`;
const testConnectionString = testUrl.toString();
if (databaseNameFromUrl(testConnectionString) !== ESCO_TEST_DB_NAME) {
  throw new Error('Isolated benchmark URL did not resolve to the ESCO test database');
}

const development = new pg.Client({ connectionString: config.databaseUrl });
const isolated = new pg.Client({ connectionString: testConnectionString });
await development.connect();
await isolated.connect();

try {
  const developmentCurrent = (await development.query('SELECT current_database() AS name')).rows[0].name;
  const isolatedCurrent = (await isolated.query('SELECT current_database() AS name')).rows[0].name;
  if (developmentCurrent !== PEACEONE_DB_NAME || isolatedCurrent !== ESCO_TEST_DB_NAME) {
    throw new Error(
      `Refusing benchmark: development=${developmentCurrent} isolated=${isolatedCurrent}`,
    );
  }
  if (developmentCurrent === isolatedCurrent) {
    throw new Error('Refusing benchmark: isolated target is not distinct from peaceone');
  }

  const peaceoneBefore = countsFromClient('peaceone-before', await tableCounts(development));
  const testBefore = countsFromClient('isolated-before', await tableCounts(isolated));

  const guardEmail = 'esco-benchmark-guard@peaceone.test';
  const existingGuard = await isolated.query('SELECT id, email, full_name, password_hash FROM users WHERE email = $1', [
    guardEmail,
  ]);
  if (existingGuard.rowCount === 0) {
    await isolated.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, account_status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'STUDENT', 'ACTIVE', NOW(), NOW())`,
      [guardEmail, '$2b$10$abcdefghijklmnopqrstuvabcdefghijklmnop', 'Benchmark Guard'],
    );
  }
  const guard = (await isolated.query('SELECT id, email, full_name, password_hash FROM users WHERE email = $1', [guardEmail]))
    .rows[0];
  await isolated.query(
    `INSERT INTO session (sid, sess, expire)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (sid) DO NOTHING`,
    ['esco-benchmark-guard-session', JSON.stringify({ purpose: 'benchmark-guard' }), '2026-12-01T00:00:00.000Z'],
  );
  const sessionBefore = (
    await isolated.query('SELECT sid, sess FROM session WHERE sid = $1', ['esco-benchmark-guard-session'])
  ).rows[0];
  const userSkillCountBefore = Number(
    (await isolated.query('SELECT COUNT(*)::int AS count FROM user_skills')).rows[0].count,
  );

  const prisma = createPrismaClient(testConnectionString);
  await assertCurrentDatabase(prisma, ESCO_TEST_DB_NAME);

  const first = await importEsco({
    mode: 'apply',
    connectionString: testConnectionString,
    writeReport: true,
  });

  const second = await importEsco({
    mode: 'apply',
    connectionString: testConnectionString,
    writeReport: false,
  });

  const emptySkillTypes = Number(
    (await isolated.query(`SELECT COUNT(*)::int AS count FROM skills WHERE source_system = $1 AND skill_type IS NULL`, [
      ESCO_SOURCE_SYSTEM,
    ])).rows[0].count,
  );
  const emptyRelationSkillTypes = Number(
    (
      await isolated.query(
        `SELECT COUNT(*)::int AS count
         FROM occupation_skill_relations
         WHERE source_system = $1
           AND (source_metadata->>'skillType') IS NULL`,
        [ESCO_SOURCE_SYSTEM],
      )
    ).rows[0].count,
  );
  const brokenFks = Number(
    (
      await isolated.query(
        `SELECT COUNT(*)::int AS count
         FROM occupation_skill_relations AS relation
         LEFT JOIN occupations AS occupation ON occupation.id = relation.occupation_id
         LEFT JOIN skills AS skill ON skill.id = relation.skill_id
         WHERE occupation.id IS NULL OR skill.id IS NULL`,
      )
    ).rows[0].count,
  );

  const guardAfter = (await isolated.query('SELECT id, email, full_name, password_hash FROM users WHERE id = $1', [guard.id]))
    .rows[0];
  const sessionAfter = (
    await isolated.query('SELECT sid, sess FROM session WHERE sid = $1', ['esco-benchmark-guard-session'])
  ).rows[0];
  const userSkillCountAfter = Number(
    (await isolated.query('SELECT COUNT(*)::int AS count FROM user_skills')).rows[0].count,
  );

  await isolated.query(`DELETE FROM occupation_skill_relations WHERE source_system = $1`, [ESCO_SOURCE_SYSTEM]);
  await isolated.query(`DELETE FROM occupations WHERE source_system = $1`, [ESCO_SOURCE_SYSTEM]);
  await isolated.query(
    `DELETE FROM skills
     WHERE source_system = $1
       AND id NOT IN (SELECT skill_id FROM user_skills)`,
    [ESCO_SOURCE_SYSTEM],
  );

  const peaceoneAfter = countsFromClient('peaceone-after', await tableCounts(development));
  const testAfterCleanup = countsFromClient('isolated-after-cleanup', await tableCounts(isolated));
  await prisma.$disconnect();

  const summary = {
    targetDatabase: isolatedCurrent,
    developmentDatabase: developmentCurrent,
    isolatedBefore: testBefore,
    firstApply: {
      elapsedMs: first.runtime.elapsedMs,
      batches: first.runtime.batches,
      batchSize: first.runtime.batchSize,
      relationBatchSize: first.runtime.relationBatchSize,
      batchTimeoutMs: first.runtime.batchTimeoutMs,
      maxBatchMs: first.runtime.maxBatchMs,
      database: first.database,
      occupations: first.occupations,
      skills: first.skills,
      relations: first.relations,
      rejects: first.rejects.length,
      reportPath: first.reportPath,
    },
    secondApply: {
      elapsedMs: second.runtime.elapsedMs,
      database: second.database,
    },
    validation: {
      emptySkillTypes,
      emptyRelationSkillTypes,
      brokenFks,
      guardUnchanged:
        guardAfter.email === guard.email &&
        guardAfter.full_name === guard.full_name &&
        guardAfter.password_hash === guard.password_hash,
      sessionUnchanged: JSON.stringify(sessionAfter.sess) === JSON.stringify(sessionBefore.sess),
      userSkillsUnchanged: userSkillCountBefore === userSkillCountAfter,
    },
    isolatedAfterCleanup: testAfterCleanup,
  };

  const peaceoneSame =
    peaceoneBefore.occupations === peaceoneAfter.occupations &&
    peaceoneBefore.skills === peaceoneAfter.skills &&
    peaceoneBefore.relations === peaceoneAfter.relations &&
    peaceoneBefore.users === peaceoneAfter.users &&
    peaceoneBefore.sessions === peaceoneAfter.sessions &&
    peaceoneBefore.userSkills === peaceoneAfter.userSkills;
  summary.peaceoneUnchanged = peaceoneSame;
  summary.peaceoneCounts = { before: peaceoneBefore, after: peaceoneAfter };

  if (!peaceoneSame) {
    throw new Error('peaceone counts changed during isolated benchmark');
  }

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await development.end();
  await isolated.end();
}
