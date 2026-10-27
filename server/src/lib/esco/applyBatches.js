import {
  BATCH_TRANSACTION_TIMEOUT_MS,
  ESCO_SOURCE_SYSTEM,
  IMPORT_BATCH_SIZE,
  OCCUPATIONS_FILE,
  RELATION_BATCH_SIZE,
  RELATIONS_FILE,
  SKILLS_FILE,
} from './constants.js';
import { EscoImportError } from './errors.js';

export function chunk(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function stableStringify(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function jsonEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}

export function emptyDbCounts() {
  return {
    occupationsCreated: 0,
    occupationsUpdated: 0,
    occupationsUnchanged: 0,
    skillsCreated: 0,
    skillsUpdated: 0,
    skillsUnchanged: 0,
    relationsCreated: 0,
    relationsUpdated: 0,
    relationsUnchanged: 0,
    skippedNotEsco: 0,
  };
}

async function withBatchTransaction(client, fn) {
  await client.query('BEGIN');
  try {
    await client.query(`SET LOCAL statement_timeout = ${BATCH_TRANSACTION_TIMEOUT_MS}`);
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The original error is more useful if rollback also fails.
    }
    throw error;
  }
}

function metadataJson(value) {
  return JSON.stringify(value ?? null);
}

async function upsertOccupationBatch(client, batch, rejects, counts) {
  const existing = await client.query(
    `SELECT source_uri, source_system, preferred_label, source_metadata
     FROM occupations
     WHERE source_uri = ANY($1::text[])`,
    [batch.map((item) => item.sourceUri)],
  );
  const byUri = new Map(existing.rows.map((row) => [row.source_uri, row]));
  const toInsert = [];
  const toUpdate = [];

  for (const record of batch) {
    const previous = byUri.get(record.sourceUri);
    if (!previous) {
      toInsert.push(record);
      continue;
    }
    if (previous.source_system !== ESCO_SOURCE_SYSTEM) {
      counts.skippedNotEsco += 1;
      rejects.push({
        file: OCCUPATIONS_FILE,
        rowNumber: record.rowNumber,
        uri: record.sourceUri,
        reason: 'source_system_not_esco',
      });
      continue;
    }
    if (
      previous.preferred_label === record.preferredLabel &&
      jsonEqual(previous.source_metadata, record.sourceMetadata)
    ) {
      counts.occupationsUnchanged += 1;
      continue;
    }
    toUpdate.push(record);
  }

  if (toInsert.length > 0) {
    await client.query(
      `INSERT INTO occupations (
         id, source_system, source_uri, preferred_label, source_metadata, created_at, updated_at
       )
       SELECT gen_random_uuid(), $4, uri, label, metadata, NOW(), NOW()
       FROM unnest($1::text[], $2::text[], $3::jsonb[]) AS t(uri, label, metadata)
       ON CONFLICT (source_uri) DO NOTHING`,
      [
        toInsert.map((item) => item.sourceUri),
        toInsert.map((item) => item.preferredLabel),
        toInsert.map((item) => metadataJson(item.sourceMetadata)),
        ESCO_SOURCE_SYSTEM,
      ],
    );
    counts.occupationsCreated += toInsert.length;
  }

  if (toUpdate.length > 0) {
    await client.query(
      `UPDATE occupations AS occupation
       SET preferred_label = v.label,
           source_metadata = v.metadata,
           updated_at = NOW()
       FROM unnest($1::text[], $2::text[], $3::jsonb[]) AS v(uri, label, metadata)
       WHERE occupation.source_uri = v.uri
         AND occupation.source_system = $4`,
      [
        toUpdate.map((item) => item.sourceUri),
        toUpdate.map((item) => item.preferredLabel),
        toUpdate.map((item) => metadataJson(item.sourceMetadata)),
        ESCO_SOURCE_SYSTEM,
      ],
    );
    counts.occupationsUpdated += toUpdate.length;
  }
}

async function upsertSkillBatch(client, batch, rejects, counts) {
  const existing = await client.query(
    `SELECT source_uri, source_system, preferred_label, skill_type, source_metadata
     FROM skills
     WHERE source_uri = ANY($1::text[])`,
    [batch.map((item) => item.sourceUri)],
  );
  const byUri = new Map(existing.rows.map((row) => [row.source_uri, row]));
  const toInsert = [];
  const toUpdate = [];

  for (const record of batch) {
    const previous = byUri.get(record.sourceUri);
    if (!previous) {
      toInsert.push(record);
      continue;
    }
    if (previous.source_system !== ESCO_SOURCE_SYSTEM) {
      counts.skippedNotEsco += 1;
      rejects.push({
        file: SKILLS_FILE,
        rowNumber: record.rowNumber,
        uri: record.sourceUri,
        reason: 'source_system_not_esco',
      });
      continue;
    }
    if (
      previous.preferred_label === record.preferredLabel &&
      previous.skill_type === record.skillType &&
      jsonEqual(previous.source_metadata, record.sourceMetadata)
    ) {
      counts.skillsUnchanged += 1;
      continue;
    }
    toUpdate.push(record);
  }

  if (toInsert.length > 0) {
    await client.query(
      `INSERT INTO skills (
         id, source_system, source_uri, preferred_label, skill_type, source_metadata, created_at, updated_at
       )
       SELECT gen_random_uuid(), $5, uri, label, skill_type, metadata, NOW(), NOW()
       FROM unnest($1::text[], $2::text[], $3::text[], $4::jsonb[]) AS t(uri, label, skill_type, metadata)
       ON CONFLICT (source_uri) DO NOTHING`,
      [
        toInsert.map((item) => item.sourceUri),
        toInsert.map((item) => item.preferredLabel),
        toInsert.map((item) => item.skillType),
        toInsert.map((item) => metadataJson(item.sourceMetadata)),
        ESCO_SOURCE_SYSTEM,
      ],
    );
    counts.skillsCreated += toInsert.length;
  }

  if (toUpdate.length > 0) {
    await client.query(
      `UPDATE skills AS skill
       SET preferred_label = v.label,
           skill_type = v.skill_type,
           source_metadata = v.metadata,
           updated_at = NOW()
       FROM unnest($1::text[], $2::text[], $3::text[], $4::jsonb[]) AS v(uri, label, skill_type, metadata)
       WHERE skill.source_uri = v.uri
         AND skill.source_system = $5`,
      [
        toUpdate.map((item) => item.sourceUri),
        toUpdate.map((item) => item.preferredLabel),
        toUpdate.map((item) => item.skillType),
        toUpdate.map((item) => metadataJson(item.sourceMetadata)),
        ESCO_SOURCE_SYSTEM,
      ],
    );
    counts.skillsUpdated += toUpdate.length;
  }
}

async function loadUriMap(client, table) {
  if (table !== 'occupations' && table !== 'skills') {
    throw new EscoImportError(`Unsupported URI map table: ${table}`, { code: 'INTERNAL' });
  }
  const result = await client.query(
    `SELECT id, source_uri, source_system FROM ${table}`,
  );
  return new Map(result.rows.map((row) => [row.source_uri, row]));
}

async function upsertRelationBatch(client, batch, occupationByUri, skillByUri, rejects, counts) {
  const resolved = [];
  for (const record of batch) {
    const occupation = occupationByUri.get(record.occupationUri);
    const skill = skillByUri.get(record.skillUri);
    if (!occupation || occupation.source_system !== ESCO_SOURCE_SYSTEM) {
      rejects.push({
        file: RELATIONS_FILE,
        rowNumber: record.rowNumber,
        uri: record.occupationUri,
        reason: occupation ? 'occupation_source_system_not_esco' : 'unresolved_occupation_uri',
      });
      continue;
    }
    if (!skill || skill.source_system !== ESCO_SOURCE_SYSTEM) {
      rejects.push({
        file: RELATIONS_FILE,
        rowNumber: record.rowNumber,
        uri: record.skillUri,
        reason: skill ? 'skill_source_system_not_esco' : 'unresolved_skill_uri',
      });
      continue;
    }
    resolved.push({
      ...record,
      occupationId: occupation.id,
      skillId: skill.id,
    });
  }
  if (resolved.length === 0) {
    return;
  }

  const existing = await client.query(
    `SELECT relation.id, relation.occupation_id, relation.skill_id, relation.relation_type,
            relation.source_system, relation.source_metadata
     FROM occupation_skill_relations AS relation
     INNER JOIN unnest($1::uuid[], $2::uuid[], $3::text[]) AS v(occupation_id, skill_id, relation_type)
       ON relation.occupation_id = v.occupation_id
      AND relation.skill_id = v.skill_id
      AND relation.relation_type = v.relation_type`,
    [
      resolved.map((item) => item.occupationId),
      resolved.map((item) => item.skillId),
      resolved.map((item) => item.relationType),
    ],
  );
  const existingMap = new Map(
    existing.rows.map((row) => [`${row.occupation_id}|${row.skill_id}|${row.relation_type}`, row]),
  );
  const toInsert = [];
  const toUpdate = [];

  for (const record of resolved) {
    const key = `${record.occupationId}|${record.skillId}|${record.relationType}`;
    const previous = existingMap.get(key);
    if (!previous) {
      toInsert.push(record);
      continue;
    }
    if (previous.source_system !== ESCO_SOURCE_SYSTEM) {
      counts.skippedNotEsco += 1;
      rejects.push({
        file: RELATIONS_FILE,
        rowNumber: record.rowNumber,
        uri: `${record.occupationUri}|${record.skillUri}|${record.relationType}`,
        reason: 'source_system_not_esco',
      });
      continue;
    }
    if (jsonEqual(previous.source_metadata, record.sourceMetadata)) {
      counts.relationsUnchanged += 1;
      continue;
    }
    toUpdate.push(record);
  }

  if (toInsert.length > 0) {
    await client.query(
      `INSERT INTO occupation_skill_relations (
         id, occupation_id, skill_id, relation_type, source_system, source_metadata, created_at, updated_at
       )
       SELECT gen_random_uuid(), occupation_id, skill_id, relation_type, $5, metadata, NOW(), NOW()
       FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::jsonb[])
         AS t(occupation_id, skill_id, relation_type, metadata)
       ON CONFLICT (occupation_id, skill_id, relation_type) DO NOTHING`,
      [
        toInsert.map((item) => item.occupationId),
        toInsert.map((item) => item.skillId),
        toInsert.map((item) => item.relationType),
        toInsert.map((item) => metadataJson(item.sourceMetadata)),
        ESCO_SOURCE_SYSTEM,
      ],
    );
    counts.relationsCreated += toInsert.length;
  }

  if (toUpdate.length > 0) {
    await client.query(
      `UPDATE occupation_skill_relations AS relation
       SET source_metadata = v.metadata,
           updated_at = NOW()
       FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::jsonb[])
         AS v(occupation_id, skill_id, relation_type, metadata)
       WHERE relation.occupation_id = v.occupation_id
         AND relation.skill_id = v.skill_id
         AND relation.relation_type = v.relation_type
         AND relation.source_system = $5`,
      [
        toUpdate.map((item) => item.occupationId),
        toUpdate.map((item) => item.skillId),
        toUpdate.map((item) => item.relationType),
        toUpdate.map((item) => metadataJson(item.sourceMetadata)),
        ESCO_SOURCE_SYSTEM,
      ],
    );
    counts.relationsUpdated += toUpdate.length;
  }
}

async function runTableBatches(client, table, records, batchSize, timings, handler) {
  const batches = chunk(records, batchSize);
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const started = Date.now();
    await withBatchTransaction(client, () => handler(batch, index));
    timings.push({
      table,
      batchIndex: index,
      rows: batch.length,
      ms: Date.now() - started,
    });
  }
}

export async function applyPreparedGraph({ client, prepared, failAfter = null }) {
  const rejects = [];
  const counts = emptyDbCounts();
  const timings = [];
  const started = Date.now();

  await runTableBatches(
    client,
    'occupations',
    prepared.occupations.records,
    IMPORT_BATCH_SIZE,
    timings,
    (batch) => upsertOccupationBatch(client, batch, rejects, counts),
  );

  if (failAfter === 'occupations') {
    throw new EscoImportError('Test interrupt after occupations', { code: 'TEST_INTERRUPT' });
  }

  await runTableBatches(
    client,
    'skills',
    prepared.skills.records,
    IMPORT_BATCH_SIZE,
    timings,
    (batch) => upsertSkillBatch(client, batch, rejects, counts),
  );

  if (failAfter === 'skills') {
    throw new EscoImportError('Test interrupt after skills', { code: 'TEST_INTERRUPT' });
  }

  const occupationByUri = await loadUriMap(client, 'occupations');
  const skillByUri = await loadUriMap(client, 'skills');

  await runTableBatches(
    client,
    'occupation_skill_relations',
    prepared.relations.records,
    RELATION_BATCH_SIZE,
    timings,
    (batch) => upsertRelationBatch(client, batch, occupationByUri, skillByUri, rejects, counts),
  );

  return {
    counts,
    rejects,
    timings,
    elapsedMs: Date.now() - started,
    batchSize: IMPORT_BATCH_SIZE,
    relationBatchSize: RELATION_BATCH_SIZE,
    batchTimeoutMs: BATCH_TRANSACTION_TIMEOUT_MS,
  };
}
