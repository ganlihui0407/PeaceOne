import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './password.js';
import { submitOwnedApplication } from './applicationQuery.js';
import { PRESENTATION_DATABASE_NAME } from './databaseTarget.js';
import {
  BASE_DEMO_ACCOUNTS,
  DATASET_APPLICATIONS,
  DATASET_CANDIDATES,
  DATASET_COMPANIES,
  DATASET_JOBS,
  JOB_SKILL_SETS,
  KNOWN_MISSING_OCCUPATION_LABELS,
  LEARNING_DATASET_COURSES,
  PHASE2_BACKUP_RELATIVE_PATH,
  PHASE2_BACKUP_SHA256,
  PHASE2_ISOLATED_DATABASE_NAME,
  PRESENTATION_WRITE_APPROVAL,
  PRESENTATION_CANDIDATES,
  PRESENTATION_COMPANIES,
  PRESENTATION_COURSES,
  PRESENTATION_EXPANSION_TARGETS,
  PRESENTATION_JOBS,
  PROTECTED_DEMO_EMAILS,
  PROTECTED_FULL_NAMES,
  PROTECTED_ROLES,
  SKILL_LABEL_ALIASES,
  STATUS_TARGETS,
  TRACKS,
  WRITE_REFUSAL,
} from './peaceonePresentationExpansionCatalog.js';
import {
  applyActions,
  attachStaff,
  emptyCounts,
  ensureCareerTarget,
  ensureCompany,
  ensureEnrolled,
  ensureInterview,
  ensureJob,
  ensureResume,
  ensureUser,
  ensureUserSkills,
  planApplicationStatuses,
  resolveDemoPassword,
  upsertCourse,
  completeLessons,
  ensureAttempts,
} from './presentationDemoDatasetSeed.js';

const ZERO_WRITES = Object.freeze({
  insert: 0,
  update: 0,
  delete: 0,
  upsert: 0,
});

function defaultRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}

export function verifyPhase2BackupChecksum(repoRoot = defaultRepoRoot()) {
  const backupPath = path.join(repoRoot, PHASE2_BACKUP_RELATIVE_PATH);
  if (!existsSync(backupPath)) {
    throw new Error(`Required Phase 2 backup is missing: ${backupPath}`);
  }
  const sha256 = createHash('sha256').update(readFileSync(backupPath)).digest('hex').toUpperCase();
  if (sha256 !== PHASE2_BACKUP_SHA256) {
    throw new Error(
      `Phase 2 backup checksum mismatch. Expected ${PHASE2_BACKUP_SHA256}, got ${sha256}. Stopping.`,
    );
  }
  return {
    backupPath,
    sha256,
    bytes: statSync(backupPath).size,
    relativePath: PHASE2_BACKUP_RELATIVE_PATH,
  };
}

const PROTECTED_SQL_SLUG = 'peaceone-demo-sql-fundamentals';

export async function assertPeaceonePresentationDatabase(prisma) {
  const rows = await prisma.$queryRaw`
    SELECT current_database()::text AS name,
           current_user::text AS db_user,
           version()::text AS version
  `;
  const name = rows[0]?.name;
  if (name === 'peaceone_test') {
    throw new Error('Refusing presentation expansion dry-run: connected to peaceone_test.');
  }
  if (name !== PRESENTATION_DATABASE_NAME) {
    throw new Error(
      `Refusing presentation expansion dry-run: current_database() is "${name}", expected ${PRESENTATION_DATABASE_NAME}.`,
    );
  }
  return {
    database: name,
    currentUser: rows[0].db_user,
    version: rows[0].version,
  };
}

function classify(exists, conflict) {
  if (conflict) {
    return 'CONFLICT';
  }
  return exists ? 'ALREADY EXISTS' : 'MISSING';
}

async function findSkill(prisma, label) {
  return prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO', preferredLabel: { equals: label, mode: 'insensitive' } },
    select: { id: true, preferredLabel: true },
  });
}

async function findOccupation(prisma, label) {
  return prisma.occupation.findFirst({
    where: { sourceSystem: 'ESCO', preferredLabel: { equals: label, mode: 'insensitive' } },
    select: { id: true, preferredLabel: true },
  });
}

export async function collectPresentationBaseline(prisma) {
  const [
    users,
    activeUsers,
    roleGroups,
    companies,
    jobs,
    publishedJobs,
    draftJobs,
    candidates,
    applications,
    snapshots,
    interviews,
    offers,
    notifications,
    courses,
    lessons,
    courseSkills,
    enrolments,
    progress,
    attempts,
    completed,
    userSkills,
    occupations,
    skills,
    statusGroups,
    interviewStatusGroups,
    companyRows,
    staffHr,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { accountStatus: 'ACTIVE' } }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.company.count(),
    prisma.job.count(),
    prisma.job.count({ where: { status: 'PUBLISHED' } }),
    prisma.job.count({ where: { status: 'DRAFT' } }),
    prisma.user.count({ where: { role: { in: ['STUDENT', 'JOB_SEEKER'] } } }),
    prisma.application.count(),
    prisma.applicationResumeSnapshot.count(),
    prisma.interview.count(),
    prisma.application.count({ where: { status: 'OFFERED' } }),
    prisma.notification.count(),
    prisma.learningContent.count({ where: { status: 'PUBLISHED' } }),
    prisma.learningLesson.count(),
    prisma.learningContentSkill.count(),
    prisma.learningEnrollment.count(),
    prisma.learningLessonProgress.count(),
    prisma.learningAttempt.count(),
    prisma.learningEnrollment.count({ where: { status: 'COMPLETED' } }),
    prisma.userSkill.count(),
    prisma.occupation.count({ where: { sourceSystem: 'ESCO' } }),
    prisma.skill.count({ where: { sourceSystem: 'ESCO' } }),
    prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.interview.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.company.findMany({
      select: { id: true, companyName: true, registrationNumber: true, industry: true, location: true },
      orderBy: { companyName: 'asc' },
    }),
    prisma.user.count({
      where: { role: 'COMPANY_STAFF', jobTitle: { contains: 'Human Resources' } },
    }),
  ]);

  const roles = Object.fromEntries(roleGroups.map((row) => [row.role, row._count._all]));
  const statuses = Object.fromEntries(statusGroups.map((row) => [row.status, row._count._all]));
  const interviewStatuses = Object.fromEntries(
    interviewStatusGroups.map((row) => [row.status, row._count._all]),
  );
  const industries = {};
  for (const company of companyRows) {
    const key = company.industry || '(unspecified)';
    industries[key] = (industries[key] || 0) + 1;
  }

  const [
    duplicateApps,
    duplicateEnrol,
    duplicateSkills,
    invalidJobSkills,
    invalidCourseSkills,
    missingSnapshots,
    interviewMismatches,
  ] = await Promise.all([
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM applications GROUP BY job_id, applicant_user_id HAVING COUNT(*) > 1) d`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM learning_enrollments GROUP BY user_id, content_id HAVING COUNT(*) > 1) d`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM user_skills GROUP BY user_id, skill_id HAVING COUNT(*) > 1) d`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM job_skills js LEFT JOIN skills s ON s.id = js.skill_id WHERE s.id IS NULL OR s.source_system <> 'ESCO'`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM learning_content_skills lcs LEFT JOIN skills s ON s.id = lcs.skill_id WHERE s.id IS NULL OR s.source_system <> 'ESCO'`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM applications a LEFT JOIN application_resume_snapshots s ON s.application_id = a.id WHERE s.id IS NULL`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM interviews i JOIN applications a ON a.id = i.application_id WHERE i.candidate_user_id <> a.applicant_user_id OR i.job_id <> a.job_id`,
  ]);

  return {
    users,
    activeUsers,
    roles: {
      ADMIN: roles.ADMIN || 0,
      STUDENT: roles.STUDENT || 0,
      JOB_SEEKER: roles.JOB_SEEKER || 0,
      COMPANY_STAFF: roles.COMPANY_STAFF || 0,
      HR: staffHr,
    },
    companies,
    companyRows,
    industries,
    jobs,
    publishedJobs,
    draftJobs,
    candidates,
    applications,
    snapshots,
    interviews,
    offers,
    notifications,
    courses,
    lessons,
    courseSkills,
    enrolments,
    progress,
    attempts,
    completed,
    userSkills,
    occupations,
    skills,
    statuses,
    interviewStatuses,
    integrity: {
      duplicateApps: duplicateApps[0].n,
      duplicateEnrol: duplicateEnrol[0].n,
      duplicateSkills: duplicateSkills[0].n,
      invalidJobSkills: invalidJobSkills[0].n,
      invalidCourseSkills: invalidCourseSkills[0].n,
      missingSnapshots: missingSnapshots[0].n,
      interviewMismatches: interviewMismatches[0].n,
    },
  };
}

export async function collectProtectedManifest(prisma) {
  const users = await prisma.user.findMany({
    where: { email: { in: PROTECTED_DEMO_EMAILS } },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      accountStatus: true,
      companyId: true,
      targetOccupationId: true,
      _count: {
        select: {
          applications: true,
          candidateInterviews: true,
          resumes: true,
          receivedNotifications: true,
          skills: true,
          learningEnrollments: true,
        },
      },
    },
    orderBy: { email: 'asc' },
  });

  const byEmail = Object.fromEntries(users.map((user) => [user.email, user]));
  const conflicts = [];
  const missing = [];
  for (const email of PROTECTED_DEMO_EMAILS) {
    const user = byEmail[email];
    if (!user) {
      missing.push(email);
      continue;
    }
    if (user.fullName !== PROTECTED_FULL_NAMES[email]) {
      conflicts.push(`${email} fullName is "${user.fullName}", expected "${PROTECTED_FULL_NAMES[email]}".`);
    }
    if (user.role !== PROTECTED_ROLES[email]) {
      conflicts.push(`${email} role is ${user.role}, expected ${PROTECTED_ROLES[email]}.`);
    }
    if (user.accountStatus !== 'ACTIVE') {
      conflicts.push(`${email} accountStatus is ${user.accountStatus}.`);
    }
  }

  const sql = await prisma.learningContent.findUnique({
    where: { slug: PROTECTED_SQL_SLUG },
    select: { id: true, status: true, title: true },
  });
  const aisyah = byEmail['student@peaceone.demo'];
  let sqlEnrolment = null;
  if (aisyah && sql) {
    sqlEnrolment = await prisma.learningEnrollment.findUnique({
      where: { userId_contentId: { userId: aisyah.id, contentId: sql.id } },
      select: { status: true },
    });
  }

  return {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      accountStatus: user.accountStatus,
      hasCompany: Boolean(user.companyId),
      hasCareerTarget: Boolean(user.targetOccupationId),
      applicationCount: user._count.applications,
      interviewCount: user._count.candidateInterviews,
      resumeCount: user._count.resumes,
      notificationCount: user._count.receivedNotifications,
      userSkillCount: user._count.skills,
      enrolmentCount: user._count.learningEnrollments,
    })),
    aisyahSqlCourse: {
      coursePresent: Boolean(sql),
      courseStatus: sql?.status || null,
      enrolmentStatus: sqlEnrolment?.status || null,
    },
    missing,
    conflicts,
  };
}

function uniqueLabels(items) {
  return [...new Set(items.filter(Boolean))];
}

export function resolveSkillLabelAlias(label) {
  return SKILL_LABEL_ALIASES[label] || label;
}

function collectRequiredSkillLabels() {
  const labels = [];
  for (const set of JOB_SKILL_SETS) {
    labels.push(...set);
  }
  for (const track of TRACKS) {
    for (const entry of track.skillLabels) {
      labels.push(...entry.labels);
    }
  }
  for (const job of [...DATASET_JOBS, ...PRESENTATION_JOBS]) {
    labels.push(...(job.skillLabels || []));
  }
  for (const candidate of [...DATASET_CANDIDATES, ...PRESENTATION_CANDIDATES]) {
    for (const entry of candidate.skillLabels || []) {
      labels.push(...entry.labels);
    }
  }
  for (const course of [...LEARNING_DATASET_COURSES, ...PRESENTATION_COURSES]) {
    labels.push(...(course.skillLabels || []));
  }
  return uniqueLabels(labels);
}

export async function dryRunPeaceonePresentationExpansion(prisma) {
  const identity = await assertPeaceonePresentationDatabase(prisma);
  const baseline = await collectPresentationBaseline(prisma);
  const protectedRecords = await collectProtectedManifest(prisma);

  const existingCompanies = await prisma.company.findMany({
    select: { id: true, companyName: true, registrationNumber: true },
  });
  const companyByReg = new Map(existingCompanies.map((row) => [row.registrationNumber, row]));

  const existingUsers = await prisma.user.findMany({
    select: { id: true, email: true, role: true, fullName: true, companyId: true },
  });
  const userByEmail = new Map(existingUsers.map((row) => [row.email, row]));

  const existingJobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      company: { select: { registrationNumber: true, companyName: true } },
    },
  });
  const jobKey = (registrationNumber, title) => `${registrationNumber}::${title}`;
  const jobByKey = new Map(
    existingJobs.map((row) => [jobKey(row.company.registrationNumber, row.title), row]),
  );

  const existingCourses = await prisma.learningContent.findMany({
    select: { id: true, slug: true, title: true, status: true, _count: { select: { lessons: true } } },
  });
  const courseBySlug = new Map(existingCourses.map((row) => [row.slug, row]));

  const existingApps = await prisma.application.findMany({
    select: {
      id: true,
      status: true,
      applicant: { select: { email: true } },
      job: { select: { title: true, company: { select: { registrationNumber: true } } } },
    },
  });
  const appKey = (email, registrationNumber, title) => `${email}::${registrationNumber}::${title}`;
  const appByKey = new Map(
    existingApps.map((row) => [
      appKey(row.applicant.email, row.job.company.registrationNumber, row.job.title),
      row,
    ]),
  );

  const companyPlan = [];
  for (const spec of [...DATASET_COMPANIES, ...PRESENTATION_COMPANIES]) {
    const existing = companyByReg.get(spec.registrationNumber);
    const conflict = existing && existing.companyName !== spec.companyName
      ? `Registration ${spec.registrationNumber} is "${existing.companyName}", catalogue expects "${spec.companyName}".`
      : null;
    companyPlan.push({
      key: spec.key,
      registrationNumber: spec.registrationNumber,
      companyName: spec.companyName,
      industry: spec.industry,
      classification: classify(Boolean(existing), Boolean(conflict)),
      conflict,
    });
  }

  const userPlan = [];
  const staffSpecs = [
    ...BASE_DEMO_ACCOUNTS.filter((item) => item.role === 'COMPANY_STAFF' || item.role === 'ADMIN'),
    ...DATASET_COMPANIES.flatMap((company) => company.staff.map((staff) => ({ ...staff, role: 'COMPANY_STAFF' }))),
    ...PRESENTATION_COMPANIES.flatMap((company) => company.staff.map((staff) => ({ ...staff, role: 'COMPANY_STAFF' }))),
  ];
  const candidateSpecs = [
    ...DATASET_CANDIDATES.map((item) => ({
      email: item.email,
      role: item.role || 'JOB_SEEKER',
      preserveExisting: item.preserveExisting,
    })),
    ...PRESENTATION_CANDIDATES,
  ];
  const seenEmails = new Set();
  for (const spec of [...staffSpecs, ...candidateSpecs]) {
    if (seenEmails.has(spec.email)) {
      continue;
    }
    seenEmails.add(spec.email);
    const existing = userByEmail.get(spec.email);
    let conflict = null;
    if (existing && spec.role && existing.role !== spec.role && !spec.preserveExisting) {
      conflict = `${spec.email} is ${existing.role}, catalogue expects ${spec.role}.`;
    }
    userPlan.push({
      email: spec.email,
      role: spec.role,
      classification: classify(Boolean(existing), Boolean(conflict)),
      conflict,
      preserve: PROTECTED_DEMO_EMAILS.includes(spec.email) || Boolean(spec.preserveExisting),
    });
  }

  const jobPlan = [];
  const companyRegByKey = new Map(
    [...DATASET_COMPANIES, ...PRESENTATION_COMPANIES].map((item) => [item.key, item.registrationNumber]),
  );
  for (const spec of [...DATASET_JOBS, ...PRESENTATION_JOBS]) {
    const registrationNumber = companyRegByKey.get(spec.companyKey);
    const existing = jobByKey.get(jobKey(registrationNumber, spec.title));
    jobPlan.push({
      companyKey: spec.companyKey,
      registrationNumber,
      title: spec.title,
      classification: classify(Boolean(existing), false),
      currentStatus: existing?.status || null,
    });
  }

  const coursePlan = [];
  const seenSlugs = new Set();
  for (const spec of [...LEARNING_DATASET_COURSES, ...PRESENTATION_COURSES]) {
    if (seenSlugs.has(spec.slug)) {
      continue;
    }
    seenSlugs.add(spec.slug);
    const existing = courseBySlug.get(spec.slug);
    const conflict = existing && existing.title !== spec.title
      ? `Slug ${spec.slug} is titled "${existing.title}", catalogue expects "${spec.title}".`
      : null;
    coursePlan.push({
      slug: spec.slug,
      title: spec.title,
      lessonCount: spec.lessons.length,
      classification: classify(Boolean(existing), Boolean(conflict)),
      currentStatus: existing?.status || null,
      existingLessonCount: existing?._count.lessons ?? null,
      conflict,
    });
  }

  const applicationPlan = [];
  for (const spec of DATASET_APPLICATIONS) {
    const registrationNumber = companyRegByKey.get(spec.companyKey);
    const existing = appByKey.get(appKey(spec.candidateEmail, registrationNumber, spec.jobTitle));
    applicationPlan.push({
      candidateEmail: spec.candidateEmail,
      companyKey: spec.companyKey,
      jobTitle: spec.jobTitle,
      classification: classify(Boolean(existing), false),
      currentStatus: existing?.status || null,
    });
  }

  const skillLabels = collectRequiredSkillLabels();
  const missingSkills = [];
  const foundSkills = [];
  const aliasedSkills = [];
  for (const label of skillLabels) {
    const skill = await findSkill(prisma, label);
    if (skill) {
      foundSkills.push(label);
      continue;
    }
    const alias = SKILL_LABEL_ALIASES[label];
    if (alias) {
      const aliased = await findSkill(prisma, alias);
      if (aliased) {
        aliasedSkills.push({ requested: label, resolvedAs: aliased.preferredLabel });
        foundSkills.push(label);
        continue;
      }
    }
    missingSkills.push(label);
  }

  const occupationLabels = uniqueLabels([
    ...TRACKS.flatMap((item) => item.occupationLabels),
    ...DATASET_CANDIDATES.flatMap((item) => item.occupationLabels || []),
    ...PRESENTATION_CANDIDATES.flatMap((item) => item.occupationLabels),
  ]);
  const missingOccupations = [];
  const skippedKnownOccupations = [];
  for (const label of occupationLabels) {
    const occupation = await findOccupation(prisma, label);
    if (!occupation) {
      if (KNOWN_MISSING_OCCUPATION_LABELS.includes(label)) {
        skippedKnownOccupations.push(label);
      } else {
        missingOccupations.push(label);
      }
    }
  }

  const catalogEmails = new Set([
    ...staffSpecs.map((item) => item.email),
    ...candidateSpecs.map((item) => item.email),
  ]);
  const preservedWalkthroughUsers = existingUsers
    .filter((user) => !catalogEmails.has(user.email))
    .map((user) => ({
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      classification: 'PRESERVE EXISTING',
    }));
  const catalogRegistrations = new Set(
    [...DATASET_COMPANIES, ...PRESENTATION_COMPANIES].map((item) => item.registrationNumber),
  );
  const preservedWalkthroughCompanies = existingCompanies
    .filter((row) => !catalogRegistrations.has(row.registrationNumber))
    .map((row) => ({
      companyName: row.companyName,
      registrationNumber: row.registrationNumber,
      classification: 'PRESERVE EXISTING',
    }));
  const catalogJobKeys = new Set(jobPlan.map((item) => `${item.registrationNumber}::${item.title}`));
  const preservedWalkthroughJobs = existingJobs
    .filter((row) => !catalogJobKeys.has(jobKey(row.company.registrationNumber, row.title)))
    .map((row) => ({
      title: row.title,
      companyName: row.company.companyName,
      status: row.status,
      classification: 'PRESERVE EXISTING',
    }));

  const missingCompanies = companyPlan.filter((item) => item.classification === 'MISSING').length;
  const missingUsers = userPlan.filter((item) => item.classification === 'MISSING').length;
  const missingJobs = jobPlan.filter((item) => item.classification === 'MISSING').length;
  const missingCourses = coursePlan.filter((item) => item.classification === 'MISSING').length;
  const missingCatalogApps = applicationPlan.filter((item) => item.classification === 'MISSING').length;
  const missingCourseLessons = coursePlan
    .filter((item) => item.classification === 'MISSING')
    .reduce((sum, item) => sum + item.lessonCount, 0);
  const backfillLessons = coursePlan
    .filter((item) => item.classification === 'ALREADY EXISTS')
    .reduce((sum, item) => sum + Math.max(0, item.lessonCount - (item.existingLessonCount || 0)), 0);

  const proposedCompanies = baseline.companies + missingCompanies;
  const proposedPublishedJobs = baseline.publishedJobs + missingJobs;
  const candidateEmails = new Set([
    ...DATASET_CANDIDATES.map((item) => item.email),
    ...PRESENTATION_CANDIDATES.map((item) => item.email),
  ]);
  const proposedCandidates = baseline.candidates + userPlan.filter((item) => (
    item.classification === 'MISSING' && candidateEmails.has(item.email)
  )).length;
  const proposedCourses = baseline.courses + missingCourses;
  const proposedLessons = baseline.lessons + missingCourseLessons + backfillLessons;

  const remainingApplications = Math.max(
    0,
    PRESENTATION_EXPANSION_TARGETS.applications - (baseline.applications + missingCatalogApps),
  );
  const remainingInterviews = Math.max(0, PRESENTATION_EXPANSION_TARGETS.interviews - baseline.interviews);
  const remainingOffers = Math.max(0, PRESENTATION_EXPANSION_TARGETS.offers - baseline.offers);
  const remainingEnrolments = Math.max(0, PRESENTATION_EXPANSION_TARGETS.enrolments - baseline.enrolments);
  const remainingProgressMin = Math.max(0, PRESENTATION_EXPANSION_TARGETS.lessonProgressMin - baseline.progress);
  const remainingAttempts = Math.max(0, PRESENTATION_EXPANSION_TARGETS.assessmentAttempts - baseline.attempts);
  const remainingCompletedMin = Math.max(
    0,
    PRESENTATION_EXPANSION_TARGETS.completedCoursesMin - baseline.completed,
  );
  const remainingNotificationsMin = Math.max(
    0,
    PRESENTATION_EXPANSION_TARGETS.notificationsMin - baseline.notifications,
  );

  const conflicts = [
    ...companyPlan.filter((item) => item.conflict).map((item) => item.conflict),
    ...userPlan.filter((item) => item.conflict).map((item) => item.conflict),
    ...coursePlan.filter((item) => item.conflict).map((item) => item.conflict),
    ...protectedRecords.conflicts,
    ...protectedRecords.missing.map((email) => `Protected account missing: ${email}`),
    ...missingSkills.map((label) => `ESCO skill missing: ${label}`),
    ...missingOccupations.map((label) => `ESCO occupation missing: ${label}`),
  ];

  const targets = PRESENTATION_EXPANSION_TARGETS;
  const achievable = {
    companies: proposedCompanies === targets.companies && missingSkills.length === 0 && protectedRecords.missing.length === 0,
    publishedJobs: proposedPublishedJobs === targets.publishedJobs,
    candidates: proposedCandidates === targets.candidates,
    courses: proposedCourses === targets.publishedCourses,
    lessons: proposedLessons === targets.lessons,
    applications: remainingApplications >= 0,
    notes: [
      'Option A: every existing presentation record is preserved, including Northwind Stage 82, Stage 8.3 Backend Engineer, and non-catalogue walkthrough users.',
      'Application, interview, enrolment, progress, attempt and notification gaps would be filled with existing business services after catalogue records exist.',
      'Protected accounts, existing applications, interviews, enrolments and UserSkills would be reused, never replaced or password-reset.',
      'UUIDs would be resolved in the destination database; they would not be copied from peaceone_test.',
      'The write entrypoint remains disabled until a later prompt explicitly authorises peaceone mutation.',
    ],
  };

  const phase1Test = {
    companies: 20,
    publishedJobs: 60,
    candidates: 100,
    applications: 250,
    interviews: 60,
    offers: 15,
    courses: 30,
    lessons: 120,
    enrolments: 150,
    progress: 419,
    attempts: 180,
    completed: 51,
    notifications: 1105,
    userSkills: 265,
  };

  return {
    identity,
    writes: { ...ZERO_WRITES },
    presentationMutations: {
      INSERT: 0,
      UPDATE: 0,
      DELETE: 0,
      UPSERT: 0,
    },
    mode: 'dry-run',
    baseline,
    protectedRecords,
    preservedWalkthrough: {
      companies: preservedWalkthroughCompanies,
      users: preservedWalkthroughUsers,
      jobs: preservedWalkthroughJobs,
    },
    plans: {
      companies: companyPlan,
      users: userPlan,
      jobs: jobPlan,
      courses: coursePlan,
      catalogApplications: applicationPlan,
    },
    missing: {
      companies: missingCompanies,
      users: missingUsers,
      jobs: missingJobs,
      courses: missingCourses,
      catalogApplications: missingCatalogApps,
      lessons: missingCourseLessons,
      backfillLessons,
      additionalApplications: remainingApplications,
      additionalInterviews: remainingInterviews,
      additionalOffers: remainingOffers,
      additionalEnrolments: remainingEnrolments,
      additionalProgressAtLeast: remainingProgressMin,
      additionalAttempts: remainingAttempts,
      additionalCompletedAtLeast: remainingCompletedMin,
      additionalNotificationsAtLeast: remainingNotificationsMin,
    },
    proposedFinal: {
      companies: proposedCompanies,
      publishedJobs: proposedPublishedJobs,
      candidates: proposedCandidates,
      applications: targets.applications,
      snapshots: targets.applications,
      interviews: targets.interviews,
      offers: targets.offers,
      courses: proposedCourses,
      lessons: proposedLessons,
      enrolments: targets.enrolments,
      progress: `${targets.lessonProgressMin}-${targets.lessonProgressMax}`,
      attempts: targets.assessmentAttempts,
      completed: `${targets.completedCoursesMin}-${targets.completedCoursesMax}`,
      notifications: `>=${targets.notificationsMin}`,
    },
    comparison: {
      phase1Test,
      optionATargets: targets,
      currentPresentation: {
        companies: baseline.companies,
        publishedJobs: baseline.publishedJobs,
        candidates: baseline.candidates,
        applications: baseline.applications,
        interviews: baseline.interviews,
        offers: baseline.offers,
        courses: baseline.courses,
        lessons: baseline.lessons,
        enrolments: baseline.enrolments,
        progress: baseline.progress,
        attempts: baseline.attempts,
        completed: baseline.completed,
        notifications: baseline.notifications,
        userSkills: baseline.userSkills,
        users: baseline.users,
        staff: baseline.roles.COMPANY_STAFF,
      },
    },
    esco: {
      requiredSkillLabels: skillLabels.length,
      foundSkills: foundSkills.length,
      aliasedSkills,
      missingSkills,
      missingOccupations,
      skippedKnownOccupations,
    },
    conflicts,
    achievable,
    targets,
    statusTargets: STATUS_TARGETS,
  };
}

async function attachStaffIfUnlinked(prisma, user, company, counts, conflicts) {
  if (user.companyId && user.companyId !== company.id) {
    conflicts.push(
      `${user.email} already belongs to another company; left unchanged rather than attaching to ${company.companyName}.`,
    );
    return;
  }
  await attachStaff(prisma, user, company, counts);
}

async function resolveCompanyHr(prisma, companySpec, passwordHash, counts, conflicts) {
  const hrSpec = companySpec.staff.find((item) => item.isHr) || companySpec.staff[0];
  if (hrSpec) {
    return ensureUser(prisma, { ...hrSpec, role: 'COMPANY_STAFF' }, passwordHash, counts);
  }
  if (companySpec.key === 'techcorp') {
    const existing = await prisma.user.findUnique({ where: { email: 'hr@techcorp.demo' } });
    if (!existing) {
      conflicts.push('hr@techcorp.demo is missing; TechCorp jobs cannot be created.');
    }
    return existing;
  }
  conflicts.push(`No HR account specified for ${companySpec.companyName}.`);
  return null;
}

async function staffForCompany(prisma, companyId) {
  return prisma.user.findFirst({
    where: { companyId, role: 'COMPANY_STAFF', jobTitle: { contains: 'Human Resources' } },
  }) || prisma.user.findFirst({
    where: { companyId, role: 'COMPANY_STAFF' },
  });
}

export async function assertPhase2IsolatedWriteDatabase(prisma) {
  const rows = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const name = rows[0]?.name;
  if (name === PRESENTATION_DATABASE_NAME) {
    throw new Error(WRITE_REFUSAL);
  }
  if (name === 'peaceone_test') {
    throw new Error(
      'Refusing Phase 2 presentation seeder: connected to peaceone_test. Use an isolated Phase 2 copy, not the Phase 1 dataset.',
    );
  }
  if (name !== PHASE2_ISOLATED_DATABASE_NAME) {
    throw new Error(
      `Refusing Phase 2 presentation seeder: current_database() is "${name}", expected ${PHASE2_ISOLATED_DATABASE_NAME}.`,
    );
  }
  return name;
}

export async function assertPeaceonePresentationWriteDatabase(prisma) {
  const rows = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const name = rows[0]?.name;
  if (name === 'peaceone_test' || name === PHASE2_ISOLATED_DATABASE_NAME) {
    throw new Error(
      `Refusing presentation expansion write: current_database() is "${name}". Dedicated peaceone population only.`,
    );
  }
  if (name !== PRESENTATION_DATABASE_NAME) {
    throw new Error(
      `Refusing presentation expansion write: current_database() is "${name}", expected ${PRESENTATION_DATABASE_NAME}.`,
    );
  }
  return name;
}

export async function executePeaceonePresentationExpansion(prisma) {
  await assertPhase2IsolatedWriteDatabase(prisma);
  return populatePeaceonePresentationExpansion(prisma);
}

export async function seedPeaceonePresentationExpansion(prisma, options = {}) {
  if (options.authorisedPresentationWrite !== PRESENTATION_WRITE_APPROVAL) {
    throw new Error(WRITE_REFUSAL);
  }
  await assertPeaceonePresentationWriteDatabase(prisma);
  return populatePeaceonePresentationExpansion(prisma);
}

async function populatePeaceonePresentationExpansion(prisma) {
  const passwordHash = await hashPassword(resolveDemoPassword());
  const counts = emptyCounts();
  const conflicts = [];
  const companiesByKey = {};
  const hrByCompanyKey = {};

  for (const account of BASE_DEMO_ACCOUNTS) {
    await ensureUser(prisma, account, passwordHash, counts);
  }

  for (const companySpec of [...DATASET_COMPANIES, ...PRESENTATION_COMPANIES]) {
    let hr = await resolveCompanyHr(prisma, companySpec, passwordHash, counts, conflicts);
    if (!hr) {
      continue;
    }
    const company = await ensureCompany(prisma, companySpec, hr, counts, conflicts);
    companiesByKey[companySpec.key] = company;
    hr = await prisma.user.findUnique({ where: { id: hr.id } });
    await attachStaffIfUnlinked(prisma, hr, company, counts, conflicts);
    hrByCompanyKey[companySpec.key] = await prisma.user.findUnique({ where: { id: hr.id } });
    for (const staffSpec of companySpec.staff.filter((item) => !item.isHr && item.email !== hr.email)) {
      const staff = await ensureUser(
        prisma,
        { ...staffSpec, role: 'COMPANY_STAFF' },
        passwordHash,
        counts,
      );
      await attachStaffIfUnlinked(prisma, staff, company, counts, conflicts);
    }
  }

  const techcorp = companiesByKey.techcorp;
  if (techcorp) {
    const daniel = await prisma.user.findUnique({ where: { email: 'staff@techcorp.demo' } });
    if (daniel) {
      await attachStaffIfUnlinked(prisma, daniel, techcorp, counts, conflicts);
    }
  }

  const jobs = [];
  for (const jobSpec of [...DATASET_JOBS, ...PRESENTATION_JOBS]) {
    const company = companiesByKey[jobSpec.companyKey];
    const hr = hrByCompanyKey[jobSpec.companyKey];
    if (!company || !hr) {
      conflicts.push(`Skipped job ${jobSpec.title}: company ${jobSpec.companyKey} is unresolved.`);
      continue;
    }
    const job = await ensureJob(prisma, jobSpec, hr.id, company, counts, { publishExistingDraft: false });
    jobs.push({ ...job, companyKey: jobSpec.companyKey, hrId: hr.id, title: jobSpec.title });
  }

  const candidateSpecs = [];
  const seenCandidateEmails = new Set();
  for (const spec of [...DATASET_CANDIDATES, ...PRESENTATION_CANDIDATES]) {
    if (seenCandidateEmails.has(spec.email)) {
      continue;
    }
    seenCandidateEmails.add(spec.email);
    candidateSpecs.push(spec);
  }

  const candidates = [];
  for (const spec of candidateSpecs) {
    const user = await ensureUser(prisma, spec, passwordHash, counts);
    if (spec.skillLabels) {
      await ensureUserSkills(prisma, user.id, spec.skillLabels, counts);
    }
    if (spec.occupationLabels) {
      await ensureCareerTarget(prisma, user, spec.occupationLabels, counts);
    }
    if (spec.resume) {
      const resume = await ensureResume(prisma, user, spec, counts);
      candidates.push({ ...user, resumeId: resume.id, email: spec.email });
    }
  }

  for (const spec of DATASET_APPLICATIONS) {
    const candidate = candidates.find((item) => item.email === spec.candidateEmail);
    const job = jobs.find((item) => item.companyKey === spec.companyKey && item.title === spec.jobTitle);
    if (!candidate || !job) {
      conflicts.push(
        `Skipped catalogue application ${spec.candidateEmail} → ${spec.jobTitle}: unresolved identity.`,
      );
      continue;
    }
    const existing = await prisma.application.findUnique({
      where: { jobId_applicantUserId: { jobId: job.id, applicantUserId: candidate.id } },
    });
    if (existing) {
      continue;
    }
    let application = await submitOwnedApplication(prisma, candidate.id, job.id, candidate.resumeId);
    counts.applicationsCreated += 1;
    application = await applyActions(prisma, application, job.hrId, spec.actions || [], counts, conflicts);
    if (spec.interview) {
      const current = await prisma.application.findUnique({ where: { id: application.id } });
      if (['SHORTLISTED', 'INTERVIEW'].includes(current.status)) {
        await ensureInterview(
          prisma,
          spec.interview,
          current,
          job.hrId,
          candidate.id,
          counts,
          conflicts,
        );
      }
    }
  }

  const publishedJobs = await prisma.job.findMany({
    where: { status: 'PUBLISHED' },
    include: { company: { select: { id: true, registrationNumber: true } } },
  });
  const jobHr = {};
  for (const job of publishedJobs) {
    const mapped = jobs.find((item) => item.id === job.id);
    if (mapped) {
      jobHr[job.id] = mapped.hrId;
      continue;
    }
    const staff = await staffForCompany(prisma, job.companyId);
    if (staff) {
      jobHr[job.id] = staff.id;
    }
  }

  const existingPairs = new Set(
    (await prisma.application.findMany({
      select: { jobId: true, applicantUserId: true },
    })).map((row) => `${row.jobId}::${row.applicantUserId}`),
  );
  const statusRows = await prisma.application.groupBy({ by: ['status'], _count: { _all: true } });
  const currentByStatus = {};
  for (const row of statusRows) {
    currentByStatus[row.status] = row._count._all;
  }
  const plan = planApplicationStatuses(currentByStatus);

  const pairs = [];
  for (const candidate of candidates) {
    for (const job of publishedJobs) {
      if (!jobHr[job.id]) {
        continue;
      }
      const key = `${job.id}::${candidate.id}`;
      if (existingPairs.has(key)) {
        continue;
      }
      pairs.push({ candidate, job, key, hrId: jobHr[job.id] });
    }
  }

  let pairCursor = 0;
  for (const item of plan) {
    while (pairCursor < pairs.length && existingPairs.has(pairs[pairCursor].key)) {
      pairCursor += 1;
    }
    if (pairCursor >= pairs.length) {
      conflicts.push(`Ran out of unique candidate/job pairs before finishing ${item.finalStatus}.`);
      break;
    }
    const pair = pairs[pairCursor];
    pairCursor += 1;
    existingPairs.add(pair.key);
    let application = await submitOwnedApplication(
      prisma,
      pair.candidate.id,
      pair.job.id,
      pair.candidate.resumeId,
    );
    counts.applicationsCreated += 1;
    application = await applyActions(prisma, application, pair.hrId, item.actions, counts, conflicts);
    if (item.interview) {
      const current = await prisma.application.findUnique({ where: { id: application.id } });
      if (['SHORTLISTED', 'INTERVIEW'].includes(current.status)) {
        await ensureInterview(
          prisma,
          { title: `${pair.job.title} demonstration interview`, ...item.interview },
          current,
          pair.hrId,
          pair.candidate.id,
          counts,
          conflicts,
        );
      }
    }
    if (item.offerAfterInterview) {
      const current = await prisma.application.findUnique({ where: { id: application.id } });
      await applyActions(prisma, current, pair.hrId, ['offer'], counts, conflicts);
    }
  }

  const seenSlugs = new Set();
  for (const spec of [...LEARNING_DATASET_COURSES, ...PRESENTATION_COURSES]) {
    if (seenSlugs.has(spec.slug)) {
      continue;
    }
    seenSlugs.add(spec.slug);
    await upsertCourse(prisma, spec, counts, { neverUpdateExisting: true });
  }

  const publishedCourses = await prisma.learningContent.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      lessons: { orderBy: { sortOrder: 'asc' } },
      assessments: { include: { questions: { orderBy: { sortOrder: 'asc' } } } },
    },
    orderBy: { slug: 'asc' },
  });
  const expandableCourses = publishedCourses.filter((item) => item.slug !== PROTECTED_SQL_SLUG);
  const learners = await prisma.user.findMany({
    where: { email: { in: candidateSpecs.map((item) => item.email) } },
    select: { id: true, email: true },
    orderBy: { email: 'asc' },
  });
  const existingEnrol = new Set(
    (await prisma.learningEnrollment.findMany({
      select: { userId: true, contentId: true },
    })).map((row) => `${row.userId}::${row.contentId}`),
  );
  const enrolmentSlots = [];
  for (const learner of learners) {
    for (const courseRow of expandableCourses) {
      const key = `${learner.id}::${courseRow.id}`;
      if (existingEnrol.has(key)) {
        continue;
      }
      enrolmentSlots.push({ learner, course: courseRow, key });
    }
  }

  const currentEnrol = await prisma.learningEnrollment.count();
  const neededEnrol = Math.max(0, PRESENTATION_EXPANSION_TARGETS.enrolments - currentEnrol);
  const completeCount = 50;
  const inProgressCount = 70;
  const take = enrolmentSlots.slice(0, neededEnrol);
  take.forEach((slot, index) => {
    if (index < completeCount) {
      slot.mode = 'complete';
    } else if (index < completeCount + inProgressCount) {
      slot.mode = 'inProgress';
    } else {
      slot.mode = 'enrolled';
    }
  });

  for (const slot of take) {
    if (slot.learner.email === 'student@peaceone.demo' && slot.course.slug === PROTECTED_SQL_SLUG) {
      continue;
    }
    await ensureEnrolled(prisma, slot.learner.id, slot.course.id, counts);
    existingEnrol.add(slot.key);
    const assessment = slot.course.assessments[0];
    if (slot.mode === 'complete') {
      await completeLessons(prisma, slot.learner.id, slot.course.lessons, slot.course.lessons.length, counts);
      await ensureAttempts(prisma, slot.learner.id, assessment, 'failThenPass', counts);
      await completeLessons(prisma, slot.learner.id, slot.course.lessons, slot.course.lessons.length, counts);
    } else if (slot.mode === 'inProgress') {
      await completeLessons(prisma, slot.learner.id, slot.course.lessons, 3, counts);
      await ensureAttempts(prisma, slot.learner.id, assessment, 'fail', counts);
    }
  }

  let attemptsNow = await prisma.learningAttempt.count();
  if (attemptsNow < PRESENTATION_EXPANSION_TARGETS.assessmentAttempts) {
    const enrolledOnlySlots = take.filter((slot) => slot.mode === 'enrolled');
    for (const slot of enrolledOnlySlots) {
      if (attemptsNow >= PRESENTATION_EXPANSION_TARGETS.assessmentAttempts) {
        break;
      }
      const assessment = slot.course.assessments[0];
      await ensureAttempts(prisma, slot.learner.id, assessment, 'fail', counts);
      attemptsNow = await prisma.learningAttempt.count();
    }
  }

  const integrity = await collectPresentationBaseline(prisma);
  return { counts, conflicts, integrity };
}
