import {
  ALLOWED_RELATION_TYPES,
  OCCUPATION_METADATA_FIELDS,
  SKILL_METADATA_FIELDS,
} from './constants.js';
import { emptyToNull, requiredText } from './csv.js';

function pickMetadata(fields, names) {
  const metadata = {};
  for (const name of names) {
    metadata[name] = fields[name] ?? '';
  }
  return metadata;
}

function parseModifiedDate(value) {
  const raw = value ?? '';
  if (raw.trim() === '') {
    return { raw, valid: false, time: null };
  }
  const time = Date.parse(raw);
  if (Number.isNaN(time)) {
    return { raw, valid: false, time: null };
  }
  return { raw, valid: true, time };
}

function payloadKey(record) {
  return JSON.stringify({
    preferredLabel: record.preferredLabel,
    skillType: record.skillType ?? null,
    sourceMetadata: record.sourceMetadata,
  });
}

function relationPayloadKey(record) {
  return JSON.stringify(record.sourceMetadata);
}

export function collapseConceptRecords(rows, { file, mapRecord }) {
  const rejects = [];
  const duplicates = [];
  const grouped = new Map();

  for (const row of rows) {
    const mapped = mapRecord(row);
    if (!mapped.sourceUri) {
      rejects.push({
        file,
        rowNumber: row.rowNumber,
        uri: null,
        reason: 'missing_concept_uri',
      });
      continue;
    }
    if (!mapped.preferredLabel) {
      rejects.push({
        file,
        rowNumber: row.rowNumber,
        uri: mapped.sourceUri,
        reason: 'missing_preferred_label',
      });
      continue;
    }
    if (!grouped.has(mapped.sourceUri)) {
      grouped.set(mapped.sourceUri, []);
    }
    grouped.get(mapped.sourceUri).push({
      ...mapped,
      rowNumber: row.rowNumber,
      date: parseModifiedDate(row.fields.modifiedDate),
    });
  }

  const accepted = [];
  for (const [uri, group] of grouped) {
    if (group.length === 1) {
      const [only] = group;
      accepted.push(only);
      continue;
    }

    const dated = group.filter((item) => item.date.valid);
    if (dated.length === 0) {
      for (const item of group) {
        rejects.push({
          file,
          rowNumber: item.rowNumber,
          uri,
          reason: 'unresolved_modified_date',
        });
      }
      continue;
    }

    const latest = Math.max(...dated.map((item) => item.date.time));
    const winners = dated.filter((item) => item.date.time === latest);
    const losers = group.filter((item) => !winners.includes(item));

    const winnerKeys = new Set(winners.map(payloadKey));
    if (winnerKeys.size > 1) {
      for (const item of group) {
        rejects.push({
          file,
          rowNumber: item.rowNumber,
          uri,
          reason: 'conflicting_duplicate',
        });
      }
      continue;
    }

    winners.sort((a, b) => a.rowNumber - b.rowNumber);
    const kept = winners[0];
    accepted.push(kept);
    for (const item of losers) {
      duplicates.push({
        file,
        uri,
        keptRow: kept.rowNumber,
        droppedRow: item.rowNumber,
        reason: item.date.valid ? 'older_modified_date' : 'invalid_modified_date',
      });
    }
    for (const item of winners.slice(1)) {
      duplicates.push({
        file,
        uri,
        keptRow: kept.rowNumber,
        droppedRow: item.rowNumber,
        reason: 'identical_duplicate',
      });
    }
  }

  return { accepted, rejects, duplicates, inputRows: rows.length };
}

export function mapOccupationRow(row) {
  return {
    sourceUri: requiredText(row.fields.conceptUri),
    preferredLabel: requiredText(row.fields.preferredLabel) ? row.fields.preferredLabel : null,
    sourceMetadata: pickMetadata(row.fields, OCCUPATION_METADATA_FIELDS),
  };
}

export function mapSkillRow(row) {
  const preferredLabel = requiredText(row.fields.preferredLabel) ? row.fields.preferredLabel : null;
  return {
    sourceUri: requiredText(row.fields.conceptUri),
    preferredLabel,
    skillType: emptyToNull(row.fields.skillType),
    sourceMetadata: pickMetadata(row.fields, SKILL_METADATA_FIELDS),
  };
}

export function prepareOccupations(rows, file) {
  const collapsed = collapseConceptRecords(rows, {
    file,
    mapRecord: mapOccupationRow,
  });
  return {
    records: collapsed.accepted.map((item) => ({
      sourceUri: item.sourceUri,
      preferredLabel: item.preferredLabel,
      sourceMetadata: item.sourceMetadata,
      rowNumber: item.rowNumber,
    })),
    uriMap: new Map(collapsed.accepted.map((item) => [item.sourceUri, item])),
    counts: {
      inputRows: collapsed.inputRows,
      acceptedUnique: collapsed.accepted.length,
      duplicatesCollapsed: collapsed.duplicates.length,
      rejected: collapsed.rejects.length,
    },
    rejects: collapsed.rejects,
    duplicates: collapsed.duplicates,
  };
}

export function prepareSkills(rows, file) {
  const collapsed = collapseConceptRecords(rows, {
    file,
    mapRecord: mapSkillRow,
  });
  return {
    records: collapsed.accepted.map((item) => ({
      sourceUri: item.sourceUri,
      preferredLabel: item.preferredLabel,
      skillType: item.skillType,
      sourceMetadata: item.sourceMetadata,
      rowNumber: item.rowNumber,
    })),
    uriMap: new Map(collapsed.accepted.map((item) => [item.sourceUri, item])),
    counts: {
      inputRows: collapsed.inputRows,
      acceptedUnique: collapsed.accepted.length,
      duplicatesCollapsed: collapsed.duplicates.length,
      rejected: collapsed.rejects.length,
    },
    rejects: collapsed.rejects,
    duplicates: collapsed.duplicates,
  };
}

export function prepareRelations(rows, file, occupationUris, skillUris) {
  const rejects = [];
  const duplicates = [];
  const grouped = new Map();

  for (const row of rows) {
    const occupationUri = requiredText(row.fields.occupationUri);
    const skillUri = requiredText(row.fields.skillUri);
    const relationType = requiredText(row.fields.relationType);

    if (!occupationUri) {
      rejects.push({
        file,
        rowNumber: row.rowNumber,
        uri: null,
        reason: 'missing_occupation_uri',
      });
      continue;
    }
    if (!skillUri) {
      rejects.push({
        file,
        rowNumber: row.rowNumber,
        uri: occupationUri,
        reason: 'missing_skill_uri',
      });
      continue;
    }
    if (!relationType || !ALLOWED_RELATION_TYPES.has(relationType)) {
      rejects.push({
        file,
        rowNumber: row.rowNumber,
        uri: `${occupationUri}|${skillUri}`,
        reason: 'invalid_relation_type',
        relationType: row.fields.relationType ?? '',
      });
      continue;
    }
    if (!occupationUris.has(occupationUri)) {
      rejects.push({
        file,
        rowNumber: row.rowNumber,
        uri: occupationUri,
        reason: 'unresolved_occupation_uri',
      });
      continue;
    }
    if (!skillUris.has(skillUri)) {
      rejects.push({
        file,
        rowNumber: row.rowNumber,
        uri: skillUri,
        reason: 'unresolved_skill_uri',
      });
      continue;
    }

    const record = {
      occupationUri,
      skillUri,
      relationType,
      rowNumber: row.rowNumber,
      sourceMetadata: {
        occupationLabel: row.fields.occupationLabel ?? '',
        skillLabel: row.fields.skillLabel ?? '',
        skillType: emptyToNull(row.fields.skillType),
      },
    };
    const key = `${occupationUri}|${skillUri}|${relationType}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(record);
  }

  const accepted = [];
  for (const [, group] of grouped) {
    if (group.length === 1) {
      accepted.push(group[0]);
      continue;
    }
    const keys = new Set(group.map(relationPayloadKey));
    if (keys.size > 1) {
      for (const item of group) {
        rejects.push({
          file,
          rowNumber: item.rowNumber,
          uri: `${item.occupationUri}|${item.skillUri}|${item.relationType}`,
          reason: 'conflicting_duplicate_relation',
        });
      }
      continue;
    }
    group.sort((a, b) => a.rowNumber - b.rowNumber);
    const kept = group[0];
    accepted.push(kept);
    for (const item of group.slice(1)) {
      duplicates.push({
        file,
        uri: `${item.occupationUri}|${item.skillUri}|${item.relationType}`,
        keptRow: kept.rowNumber,
        droppedRow: item.rowNumber,
        reason: 'identical_duplicate',
      });
    }
  }

  return {
    records: accepted,
    counts: {
      inputRows: rows.length,
      acceptedUnique: accepted.length,
      duplicatesCollapsed: duplicates.length,
      rejected: rejects.length,
    },
    rejects,
    duplicates,
  };
}
