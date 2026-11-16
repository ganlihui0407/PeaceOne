import {
  FORBIDDEN_TEST_DATABASE_NAMES,
  isDedicatedTestDatabaseName,
  parseDatabaseTarget,
} from './databaseTarget.js';

export const TEST_PROCESS_FLAG = 'PEACEONE_USE_TEST_DATABASE';
export const PRESENTATION_URL_ENV = 'PEACEONE_PRESENTATION_DATABASE_URL';

export function isTestDatabaseProcessEnabled(env = process.env) {
  return env[TEST_PROCESS_FLAG] === '1';
}

export function assertDedicatedTestDatabaseUrl({
  testDatabaseUrl,
  presentationDatabaseUrl,
  testProcessEnabled,
} = {}) {
  if (testProcessEnabled !== true) {
    throw new Error('Refusing database operation: PeaceOne test-database mode is not enabled.');
  }

  if (!testDatabaseUrl) {
    throw new Error(
      'Missing required environment variable: TEST_DATABASE_URL. Backend tests refuse to use the presentation DATABASE_URL.',
    );
  }

  if (!presentationDatabaseUrl) {
    throw new Error('Presentation DATABASE_URL is required to verify test isolation.');
  }

  if (testDatabaseUrl === presentationDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL must not equal the presentation DATABASE_URL.');
  }

  const test = parseDatabaseTarget(testDatabaseUrl);
  const presentation = parseDatabaseTarget(presentationDatabaseUrl);

  if (test.databaseName === presentation.databaseName) {
    throw new Error(
      `TEST_DATABASE_URL targets the presentation database "${presentation.databaseName}".`,
    );
  }

  if (FORBIDDEN_TEST_DATABASE_NAMES.has(test.databaseName) || !isDedicatedTestDatabaseName(test.databaseName)) {
    throw new Error(
      `TEST_DATABASE_URL database name "${test.databaseName}" is not a dedicated *_test database.`,
    );
  }

  return { test, presentation };
}

export function applyTestDatabaseIsolationFromEnv(env = process.env) {
  const presentationDatabaseUrl = env[PRESENTATION_URL_ENV] || env.DATABASE_URL;
  const isolation = assertDedicatedTestDatabaseUrl({
    testDatabaseUrl: env.TEST_DATABASE_URL,
    presentationDatabaseUrl,
    testProcessEnabled: true,
  });

  env[PRESENTATION_URL_ENV] = presentationDatabaseUrl;
  env[TEST_PROCESS_FLAG] = '1';
  env.DATABASE_URL = env.TEST_DATABASE_URL;
  return isolation;
}

export function resolvePrismaConnectionString(explicit, env = process.env) {
  if (isTestDatabaseProcessEnabled(env)) {
    const isolation = assertDedicatedTestDatabaseUrl({
      testDatabaseUrl: env.TEST_DATABASE_URL,
      presentationDatabaseUrl: env[PRESENTATION_URL_ENV] || '',
      testProcessEnabled: true,
    });

    const candidate = explicit ?? env.TEST_DATABASE_URL;
    if (!candidate) {
      throw new Error('Missing required environment variable: TEST_DATABASE_URL');
    }

    const target = parseDatabaseTarget(candidate);
    if (target.databaseName === isolation.presentation.databaseName) {
      throw new Error('Refusing Prisma client: connection targets the presentation database.');
    }
    if (!isDedicatedTestDatabaseName(target.databaseName)) {
      throw new Error(
        `Refusing Prisma client: "${target.databaseName}" is not a dedicated test database.`,
      );
    }
    return candidate;
  }

  const connectionString = explicit ?? env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }
  return connectionString;
}

export async function assertSafeDestructiveTestOperation(prisma, env = process.env) {
  const isolation = assertDedicatedTestDatabaseUrl({
    testDatabaseUrl: env.TEST_DATABASE_URL,
    presentationDatabaseUrl: env[PRESENTATION_URL_ENV],
    testProcessEnabled: isTestDatabaseProcessEnabled(env),
  });

  if (env.DATABASE_URL !== env.TEST_DATABASE_URL) {
    throw new Error('Refusing destructive test operation: process DATABASE_URL is not TEST_DATABASE_URL.');
  }

  if (!prisma || typeof prisma.$queryRaw !== 'function') {
    throw new Error('Refusing destructive test operation: database client is unavailable.');
  }

  const rows = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const name = rows[0]?.name;
  if (!name) {
    throw new Error('Refusing destructive test operation: current database name is unknown.');
  }
  if (name === isolation.presentation.databaseName) {
    throw new Error('Refusing destructive test operation: connected to the presentation database.');
  }
  if (!isDedicatedTestDatabaseName(name)) {
    throw new Error(
      `Refusing destructive test operation: connected to "${name}", which is not a dedicated test database.`,
    );
  }
  return name;
}
