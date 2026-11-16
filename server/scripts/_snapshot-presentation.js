import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

function target(url) {
  const parsed = new URL(url);
  return {
    protocol: parsed.protocol,
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
  };
}

const presentation = process.env.DATABASE_URL;
if (!presentation) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const client = new pg.Client({ connectionString: presentation });
await client.connect();
const db = await client.query('SELECT current_database() AS name');
const counts = await client.query(`
  SELECT
    (SELECT COUNT(*)::int FROM users) AS users,
    (SELECT COUNT(*)::int FROM companies) AS companies,
    (SELECT COUNT(*)::int FROM jobs) AS jobs,
    (SELECT COUNT(*)::int FROM applications) AS applications,
    (SELECT COUNT(*)::int FROM interviews) AS interviews,
    (SELECT COUNT(*)::int FROM notifications) AS notifications,
    (SELECT COUNT(*)::int FROM learning_contents) AS learning_contents,
    (SELECT COUNT(*)::int FROM learning_enrollments) AS learning_enrollments,
    (SELECT COUNT(*)::int FROM learning_lesson_progress) AS learning_lesson_progress,
    (SELECT COUNT(*)::int FROM learning_attempts) AS learning_attempts,
    (SELECT COUNT(*)::int FROM user_skills) AS user_skills
`);
const demos = await client.query(`
  SELECT email, role::text AS role, account_status::text AS account_status, (company_id IS NULL) AS company_id_null
  FROM users
  WHERE email IN (
    'admin@peaceone.demo','hr@techcorp.demo','staff@techcorp.demo',
    'student@peaceone.demo','graduate@peaceone.demo'
  )
  ORDER BY email
`);
const apps = await client.query(`
  SELECT a.status::text AS status, u.email, j.title
  FROM applications a
  JOIN users u ON u.id = a.applicant_user_id
  JOIN jobs j ON j.id = a.job_id
  ORDER BY u.email, j.title
`);
const interviews = await client.query(`
  SELECT i.status::text AS status, u.email
  FROM interviews i
  JOIN applications a ON a.id = i.application_id
  JOIN users u ON u.id = a.applicant_user_id
  ORDER BY u.email
`);
await client.end();

console.log(JSON.stringify({
  presentationTarget: target(presentation),
  testDatabaseUrlConfigured: Boolean(process.env.TEST_DATABASE_URL),
  testTarget: process.env.TEST_DATABASE_URL ? target(process.env.TEST_DATABASE_URL) : null,
  connectedDatabase: db.rows[0].name,
  counts: counts.rows[0],
  demos: demos.rows,
  applications: apps.rows,
  interviews: interviews.rows,
}, null, 2));
