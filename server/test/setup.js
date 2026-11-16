import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTestDatabaseIsolationFromEnv } from '../src/lib/testDatabaseGuard.js';

process.env.PEACEONE_DISABLE_AUTH_RATE_LIMIT = 'true';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

applyTestDatabaseIsolationFromEnv(process.env);
