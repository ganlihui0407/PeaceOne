export const PRESENTATION_DATABASE_NAME = 'peaceone';
export const DEDICATED_TEST_DATABASE_NAME = 'peaceone_test';

export const FORBIDDEN_TEST_DATABASE_NAMES = new Set([
  PRESENTATION_DATABASE_NAME,
  'postgres',
  'template0',
  'template1',
]);

export function parseDatabaseTarget(connectionString) {
  if (!connectionString || typeof connectionString !== 'string') {
    throw new Error('Database URL is missing.');
  }

  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('Database URL is not a valid URL.');
  }

  if (!/^postgres(ql)?:$/i.test(parsed.protocol)) {
    throw new Error('Database URL must use postgresql.');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, '').replace(/\/$/, ''));
  if (!databaseName) {
    throw new Error('Database URL does not include a database name.');
  }

  return {
    protocol: parsed.protocol,
    host: parsed.hostname,
    port: parsed.port || '5432',
    databaseName,
  };
}

export function isDedicatedTestDatabaseName(name) {
  return typeof name === 'string'
    && /^[a-z][a-z0-9_]*_test$/.test(name)
    && !FORBIDDEN_TEST_DATABASE_NAMES.has(name);
}

export function describeDatabaseTarget(connectionString) {
  const target = parseDatabaseTarget(connectionString);
  return `${target.host}:${target.port}/${target.databaseName}`;
}
