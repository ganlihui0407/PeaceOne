import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { describeDatabaseTarget } from '../src/lib/databaseTarget.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

async function snapshot(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
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
        (SELECT COUNT(*)::int FROM user_skills) AS user_skills,
        (SELECT COUNT(*)::int FROM resumes) AS resumes,
        (SELECT COUNT(*)::int FROM resume_files) AS resume_files,
        (SELECT COUNT(*)::int FROM occupations) AS occupations,
        (SELECT COUNT(*)::int FROM skills) AS skills
    `);
    const demos = await client.query(`
      SELECT email, role::text AS role, account_status::text AS account_status
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
    return {
      connectedDatabase: db.rows[0].name,
      target: describeDatabaseTarget(connectionString),
      counts: counts.rows[0],
      demos: demos.rows,
      applications: apps.rows,
      interviews: interviews.rows,
    };
  } finally {
    await client.end();
  }
}

const presentation = await snapshot(process.env.DATABASE_URL);
const test = await snapshot(process.env.TEST_DATABASE_URL);
console.log(JSON.stringify({ presentation, test }, null, 2));
