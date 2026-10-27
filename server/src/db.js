import './config.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export function createPrismaClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ['warn', 'error'],
  });
}

export const prisma = createPrismaClient();

export async function checkDatabaseConnection() {
  await prisma.$queryRaw`SELECT 1`;
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
