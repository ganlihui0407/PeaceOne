import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { parseDatabaseTarget, PRESENTATION_DATABASE_NAME } from '../src/lib/databaseTarget.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

const target = parseDatabaseTarget(process.env.DATABASE_URL);
if (target.databaseName !== PRESENTATION_DATABASE_NAME) {
  throw new Error(`Refusing recount: DATABASE_URL is ${target.databaseName}`);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const identity = await client.query('SELECT current_database()::text AS name');
  if (identity.rows[0].name !== PRESENTATION_DATABASE_NAME) {
    throw new Error(`Refusing recount: current_database() is ${identity.rows[0].name}`);
  }
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM users WHERE account_status = 'ACTIVE') AS active_users,
      (SELECT COUNT(*)::int FROM companies) AS companies,
      (SELECT COUNT(*)::int FROM jobs) AS jobs,
      (SELECT COUNT(*)::int FROM jobs WHERE status = 'PUBLISHED') AS published_jobs,
      (SELECT COUNT(*)::int FROM jobs WHERE status = 'DRAFT') AS draft_jobs,
      (SELECT COUNT(*)::int FROM jobs WHERE status = 'CLOSED') AS closed_jobs,
      (SELECT COUNT(*)::int FROM users WHERE role IN ('STUDENT','JOB_SEEKER')) AS candidates,
      (SELECT COUNT(*)::int FROM applications) AS applications,
      (SELECT COUNT(*)::int FROM application_resume_snapshots) AS snapshots,
      (SELECT COUNT(*)::int FROM interviews) AS interviews,
      (SELECT COUNT(*)::int FROM applications WHERE status = 'OFFERED') AS offers,
      (SELECT COUNT(*)::int FROM learning_contents WHERE status = 'PUBLISHED') AS courses,
      (SELECT COUNT(*)::int FROM learning_lessons) AS lessons,
      (SELECT COUNT(*)::int FROM learning_enrollments) AS enrolments,
      (SELECT COUNT(*)::int FROM learning_lesson_progress) AS progress,
      (SELECT COUNT(*)::int FROM learning_attempts) AS attempts,
      (SELECT COUNT(*)::int FROM learning_enrollments WHERE status = 'COMPLETED') AS completed,
      (SELECT COUNT(*)::int FROM notifications) AS notifications,
      (SELECT COUNT(*)::int FROM user_skills) AS user_skills
  `);
  const statuses = await client.query('SELECT status, COUNT(*)::int AS n FROM applications GROUP BY status ORDER BY status');
  const interviewStatuses = await client.query('SELECT status, COUNT(*)::int AS n FROM interviews GROUP BY status ORDER BY status');
  const protectedUsers = await client.query(`
    SELECT email, full_name, role, account_status
    FROM users
    WHERE email IN (
      'admin@peaceone.demo','student@peaceone.demo','graduate@peaceone.demo',
      'hr@techcorp.demo','staff@techcorp.demo'
    )
    ORDER BY email
  `);
  const extraUsers = await client.query(`
    SELECT email, full_name, role
    FROM users
    WHERE email IN (
      'stage55.student.20261028@peaceone.test',
      'stage73.editor.1794538758951@peaceone.test',
      'stage73.editor.1794538770393@peaceone.test',
      'stage83.student.20261113@peaceone.test',
      'stage82.staff.20261113@peaceone.test',
      'stage82.admin.20261113@peaceone.test',
      'stage83.seeker.20261113@peaceone.test',
      'ganlihui0704@gmail.com',
      'leews-am23@student.tarc.edu.my',
      'ganlh-am23@student.tarc.edu.my'
    )
    ORDER BY email
  `);
  const companies = await client.query('SELECT company_name, registration_number FROM companies ORDER BY company_name');
  const jobs = await client.query(`
    SELECT j.title, j.status, c.company_name
    FROM jobs j JOIN companies c ON c.id = j.company_id
    ORDER BY c.company_name, j.title
  `);
  const sql = await client.query(`
    SELECT e.status
    FROM learning_enrollments e
    JOIN learning_contents c ON c.id = e.content_id
    JOIN users u ON u.id = e.user_id
    WHERE u.email = 'student@peaceone.demo' AND c.slug = 'peaceone-demo-sql-fundamentals'
  `);
  const integrity = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM (SELECT 1 FROM applications GROUP BY job_id, applicant_user_id HAVING COUNT(*) > 1) d) AS dup_apps,
      (SELECT COUNT(*)::int FROM (SELECT 1 FROM learning_enrollments GROUP BY user_id, content_id HAVING COUNT(*) > 1) d) AS dup_enrol,
      (SELECT COUNT(*)::int FROM (SELECT 1 FROM user_skills GROUP BY user_id, skill_id HAVING COUNT(*) > 1) d) AS dup_skills,
      (SELECT COUNT(*)::int FROM applications a LEFT JOIN application_resume_snapshots s ON s.application_id = a.id WHERE s.id IS NULL) AS missing_snapshots,
      (SELECT COUNT(*)::int FROM interviews i JOIN applications a ON a.id = i.application_id WHERE i.candidate_user_id <> a.applicant_user_id OR i.job_id <> a.job_id) AS interview_mismatch
  `);
  console.log(JSON.stringify({
    database: identity.rows[0].name,
    counts: counts.rows[0],
    statuses: Object.fromEntries(statuses.rows.map((row) => [row.status, row.n])),
    interviewStatuses: Object.fromEntries(interviewStatuses.rows.map((row) => [row.status, row.n])),
    protectedUsers: protectedUsers.rows,
    extraUsers: extraUsers.rows,
    companies: companies.rows,
    jobs: jobs.rows,
    aisyahSql: sql.rows[0] || null,
    integrity: integrity.rows[0],
  }, null, 2));
} finally {
  await client.end();
}
