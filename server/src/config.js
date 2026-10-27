import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const port = Number.parseInt(process.env.PORT ?? '3001', 10);

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number.isInteger(port) && port > 0 ? port : 3001,
  databaseUrl: required('DATABASE_URL'),
};
