export const ESCO_SOURCE_SYSTEM = 'ESCO';
export const ESCO_EXPECTED_VERSION = 'v1.2.1';
export const ESCO_ARCHIVE_FILENAME = 'ESCO dataset - v1.2.1 - classification - en - csv.zip';
export const ESCO_EXTRACTED_DIRNAME = 'v1.2.1-classification-en-csv';

export const OCCUPATIONS_FILE = 'occupations_en.csv';
export const SKILLS_FILE = 'skills_en.csv';
export const RELATIONS_FILE = 'occupationSkillRelations_en.csv';

export const OCCUPATION_HEADERS = [
  'conceptType',
  'conceptUri',
  'iscoGroup',
  'preferredLabel',
  'altLabels',
  'hiddenLabels',
  'status',
  'modifiedDate',
  'regulatedProfessionNote',
  'scopeNote',
  'definition',
  'inScheme',
  'description',
  'code',
  'naceCode',
];

export const SKILL_HEADERS = [
  'conceptType',
  'conceptUri',
  'skillType',
  'reuseLevel',
  'preferredLabel',
  'altLabels',
  'hiddenLabels',
  'status',
  'modifiedDate',
  'scopeNote',
  'definition',
  'inScheme',
  'description',
];

export const RELATION_HEADERS = [
  'occupationUri',
  'occupationLabel',
  'relationType',
  'skillType',
  'skillUri',
  'skillLabel',
];

export const OCCUPATION_METADATA_FIELDS = [
  'conceptType',
  'iscoGroup',
  'altLabels',
  'hiddenLabels',
  'status',
  'modifiedDate',
  'regulatedProfessionNote',
  'scopeNote',
  'definition',
  'inScheme',
  'description',
  'code',
  'naceCode',
];

export const SKILL_METADATA_FIELDS = [
  'conceptType',
  'reuseLevel',
  'altLabels',
  'hiddenLabels',
  'status',
  'modifiedDate',
  'scopeNote',
  'definition',
  'inScheme',
  'description',
];

export const ALLOWED_RELATION_TYPES = new Set(['essential', 'optional']);

/** Occupations/skills rows per bounded INSERT/UPDATE transaction. */
export const IMPORT_BATCH_SIZE = 1000;
/** Relationship triples per bounded INSERT/UPDATE transaction. */
export const RELATION_BATCH_SIZE = 2000;
/** PostgreSQL statement_timeout for one batch transaction. */
export const BATCH_TRANSACTION_TIMEOUT_MS = 30_000;
export const IMPORT_LOCK_KEY = 85002152;
export const APPLY_TRANSACTION_MAX_WAIT_MS = 10_000;
