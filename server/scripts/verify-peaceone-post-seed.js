import dotenv from 'dotenv';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { parseDatabaseTarget, PRESENTATION_DATABASE_NAME } from '../src/lib/databaseTarget.js';
import { PHASE2_BACKUP_RELATIVE_PATH, PHASE2_BACKUP_SHA256 } from '../src/lib/peaceonePresentationExpansionCatalog.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });
const target = parseDatabaseTarget(process.env.DATABASE_URL);
if (target.databaseName !== PRESENTATION_DATABASE_NAME) {
  throw new Error(`Refusing verify: ${target.databaseName}`);
}

const original = path.join(path.resolve(serverRoot, '..'), PHASE2_BACKUP_RELATIVE_PATH);
const originalSha = createHash('sha256').update(readFileSync(original)).digest('hex').toUpperCase();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const db = await client.query('SELECT current_database()::text AS name');
  if (db.rows[0].name !== PRESENTATION_DATABASE_NAME) {
    throw new Error(`current_database is ${db.rows[0].name}`);
  }
  const extra = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM (SELECT registration_number FROM companies WHERE registration_number IS NOT NULL GROUP BY registration_number HAVING COUNT(*) > 1) d) AS dup_reg,
      (SELECT COUNT(*)::int FROM (SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1) d) AS dup_email,
      (SELECT COUNT(*)::int FROM applications a LEFT JOIN jobs j ON j.id = a.job_id WHERE j.id IS NULL) AS orphan_apps,
      (SELECT COUNT(*)::int FROM applications a LEFT JOIN users u ON u.id = a.applicant_user_id WHERE u.id IS NULL) AS orphan_applicants,
      (SELECT COUNT(*)::int FROM job_skills js LEFT JOIN skills s ON s.id = js.skill_id WHERE s.id IS NULL OR s.source_system <> 'ESCO') AS invalid_job_skills,
      (SELECT COUNT(*)::int FROM learning_content_skills lcs LEFT JOIN skills s ON s.id = lcs.skill_id WHERE s.id IS NULL OR s.source_system <> 'ESCO') AS invalid_course_skills,
      (SELECT COUNT(*)::int FROM learning_lessons l LEFT JOIN learning_contents c ON c.id = l.content_id WHERE c.id IS NULL) AS orphan_lessons,
      (SELECT COUNT(*)::int FROM learning_attempts a LEFT JOIN learning_assessments ass ON ass.id = a.assessment_id WHERE ass.id IS NULL) AS orphan_attempts,
      (SELECT COUNT(*)::int FROM notifications n
        JOIN applications a ON a.id = n.related_entity_id AND n.related_entity_type = 'APPLICATION'
        JOIN jobs j ON j.id = a.job_id
        JOIN users r ON r.id = n.recipient_user_id
        WHERE r.id <> a.applicant_user_id
          AND NOT (r.role = 'COMPANY_STAFF' AND r.company_id = j.company_id)
      ) AS app_notification_leak,
      (SELECT COUNT(*)::int FROM notifications n
        JOIN interviews i ON i.id = n.related_entity_id AND n.related_entity_type = 'INTERVIEW'
        JOIN users r ON r.id = n.recipient_user_id
        WHERE r.id <> i.candidate_user_id
          AND NOT (r.role = 'COMPANY_STAFF' AND r.company_id = i.company_id)
      ) AS interview_notification_leak,
      (SELECT COUNT(*)::int FROM (SELECT 1 FROM notifications GROUP BY deduplication_key HAVING COUNT(*) > 1) d) AS dup_notification_keys
  `);
  const protectedUsers = await client.query(`
    SELECT email, full_name, role, account_status, length(password_hash) AS hash_len
    FROM users
    WHERE email IN (
      'admin@peaceone.demo','student@peaceone.demo','graduate@peaceone.demo',
      'hr@techcorp.demo','staff@techcorp.demo'
    )
    ORDER BY email
  `);
  const extraUsers = await client.query(`
    SELECT COUNT(*)::int AS n FROM users WHERE email IN (
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
  `);
  const preservedJobs = await client.query(`
    SELECT j.title, j.status, c.company_name
    FROM jobs j JOIN companies c ON c.id = j.company_id
    WHERE (j.title = 'Stage 8.3 Backend Engineer')
       OR (j.title = 'Digital Marketing Executive' AND c.company_name LIKE 'TechCorp%')
       OR (j.title = 'Junior Data Analyst' AND c.company_name LIKE 'Northwind%')
    ORDER BY c.company_name, j.title
  `);
  const aisyah = await client.query(`
    SELECT e.status AS enrolment,
      (SELECT json_agg(json_build_object('label', s.preferred_label, 'level', us.proficiency_level) ORDER BY s.preferred_label)
       FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = u.id) AS skills
    FROM users u
    JOIN learning_contents c ON c.slug = 'peaceone-demo-sql-fundamentals'
    JOIN learning_enrollments e ON e.user_id = u.id AND e.content_id = c.id
    WHERE u.email = 'student@peaceone.demo'
  `);
  const northwind = await client.query(`SELECT company_name FROM companies WHERE company_name = 'Northwind Stage 82'`);
  const interviewStatuses = await client.query('SELECT status, COUNT(*)::int AS n FROM interviews GROUP BY status ORDER BY status');
  const hrCount = await client.query(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'COMPANY_STAFF' AND job_title ILIKE '%Human Resources%' OR (role = 'COMPANY_STAFF' AND job_title ILIKE '%People%')`);
  const generatedCandidates = await client.query(`SELECT COUNT(*)::int AS n FROM users WHERE email LIKE 'demo-candidate-%@peaceone.demo'`);
  console.log(JSON.stringify({
    database: db.rows[0].name,
    originalBackupExists: existsSync(original),
    originalBackupBytes: statSync(original).size,
    originalBackupShaMatches: originalSha === PHASE2_BACKUP_SHA256,
    extra: extra.rows[0],
    protectedUsers: protectedUsers.rows,
    extraUserCount: extraUsers.rows[0].n,
    preservedJobs: preservedJobs.rows,
    aisyah: aisyah.rows[0],
    northwind: northwind.rows[0],
    interviewStatuses: Object.fromEntries(interviewStatuses.rows.map((row) => [row.status, row.n])),
    generatedDemoCandidates: generatedCandidates.rows[0].n,
  }, null, 2));
} finally {
  await client.end();
}
