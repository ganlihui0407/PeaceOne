import './config.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  assertSafeDestructiveTestOperation,
  isTestDatabaseProcessEnabled,
  resolvePrismaConnectionString,
} from './lib/testDatabaseGuard.js';

export function createPrismaClient(connectionString) {
  const resolved = resolvePrismaConnectionString(connectionString);
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: resolved }),
    log: ['warn', 'error'],
  });

  if (!isTestDatabaseProcessEnabled()) {
    return client;
  }

  return client.$extends({
    query: {
      $allModels: {
        async deleteMany({ args, query }) {
          await assertSafeDestructiveTestOperation(client);
          return query(args);
        },
        async delete({ args, query }) {
          await assertSafeDestructiveTestOperation(client);
          return query(args);
        },
      },
    },
  });
}

export const prisma = createPrismaClient();

export async function checkDatabaseConnection() {
  await prisma.$queryRaw`SELECT 1`;
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
