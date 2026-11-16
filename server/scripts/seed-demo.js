import { disconnectDatabase, prisma } from '../src/db.js';
import { config } from '../src/config.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { upsertOwnedCompany } from '../src/lib/companyQuery.js';
import {
  createOwnedJob,
  publishOwnedJob,
  updateOwnedJob,
} from '../src/lib/jobQuery.js';
import {
  createOwnedResume,
  updateOwnedResume,
} from '../src/lib/resumeQuery.js';
import {
  submitOwnedApplication,
  transitionCompanyApplication,
} from '../src/lib/applicationQuery.js';
import {
  acceptOwnedInterview,
  createCompanyInterview,
} from '../src/lib/interviewQuery.js';

const DEMO_REGISTRATION_NUMBER = 'DEMO-TECHCORP-2026';
const DEMO_COMPANY_NAME = 'TechCorp Solutions Sdn. Bhd.';
const RESUME_TITLE_PREFIX = 'Demonstration Resume';
const INTERVIEW_TITLE = 'Junior Data Analyst — first-round interview';
const DEFAULT_LOCAL_PASSWORD = 'PeaceOneDemo1';

const DEMO_ACCOUNTS = [
  {
    key: 'admin',
    email: 'admin@peaceone.demo',
    role: 'ADMIN',
    fullName: 'Nurul Izzah',
    phone: '+60123450001',
    jobTitle: 'Platform Administrator',
    department: 'PeaceOne Operations',
    location: 'Kuala Lumpur',
    experienceSummary: 'PeaceOne demonstration administrator account for academic FYP walkthroughs.',
  },
  {
    key: 'hr',
    email: 'hr@techcorp.demo',
    role: 'COMPANY_STAFF',
    fullName: 'Priya Nair',
    phone: '+60123450002',
    jobTitle: 'Human Resources Manager',
    department: 'People Operations',
    location: 'Petaling Jaya, Selangor',
    experienceSummary: 'Leads hiring for TechCorp Solutions demonstration jobs in the PeaceOne FYP environment.',
  },
  {
    key: 'staff',
    email: 'staff@techcorp.demo',
    role: 'COMPANY_STAFF',
    fullName: 'Daniel Wong',
    phone: '+60123450003',
    jobTitle: 'Talent Coordinator',
    department: 'People Operations',
    location: 'Petaling Jaya, Selangor',
    experienceSummary: 'Supports TechCorp recruitment operations in the PeaceOne demonstration dataset.',
  },
  {
    key: 'student',
    email: 'student@peaceone.demo',
    role: 'STUDENT',
    fullName: 'Aisyah Rahman',
    phone: '+60123450004',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Information Systems',
    institution: 'Tunku Abdul Rahman University of Management and Technology',
    graduationYear: 2027,
    location: 'Setapak, Kuala Lumpur',
    experienceSummary:
      'Final-year information systems student exploring data analysis roles. Demonstration profile only; no external certificates are claimed.',
  },
  {
    key: 'graduate',
    email: 'graduate@peaceone.demo',
    role: 'JOB_SEEKER',
    fullName: 'Tan Wei Jie',
    phone: '+60123450005',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Software Engineering',
    institution: 'Universiti Malaya',
    graduationYear: 2025,
    location: 'Subang Jaya, Selangor',
    experienceSummary:
      'Recent software engineering graduate seeking a first developer role. Demonstration profile only; no external certificates are claimed.',
  },
];

const DEMO_EMAILS = DEMO_ACCOUNTS.map((account) => account.email);

const COMPANY_PROFILE = {
  companyName: DEMO_COMPANY_NAME,
  registrationNumber: DEMO_REGISTRATION_NUMBER,
  industry: 'Information technology',
  companySize: '51-200',
  website: 'https://techcorp.demo',
  email: 'hr@techcorp.demo',
  phone: '+60321000000',
  location: 'Petaling Jaya, Selangor',
  address: 'Level 12, TechCorp Tower, Jalan Utara, 46200 Petaling Jaya, Selangor',
  description:
    'Demonstration employer used in the PeaceOne FYP environment. TechCorp Solutions Sdn. Bhd. is a synthetic company for academic walkthroughs of job posting, applications, and interviews.',
};

const SKILL_ALIASES = {
  python: ['Python', 'python'],
  sql: ['SQL', 'sql'],
  dataAnalysis: ['data analysis', 'analyse data', 'analyze data'],
  statistics: ['statistics', 'statistical analysis'],
  javascript: ['JavaScript', 'javascript'],
  softwareDevelopment: ['software development', 'develop software'],
  git: ['Git', 'git'],
  digitalMarketing: ['digital marketing'],
  socialMedia: ['social media'],
  communication: ['communication'],
};

const OCCUPATION_ALIASES = {
  dataAnalyst: ['data analyst', 'Data analyst'],
  softwareDeveloper: ['software developer', 'Software developer'],
  digitalMarketer: ['digital marketing', 'Digital marketing manager', 'marketing manager'],
};

function localHosts() {
  return new Set(['localhost', '127.0.0.1', '::1']);
}

function assertSafeDatabaseTarget(databaseUrl, nodeEnv) {
  if (String(nodeEnv).toLowerCase() === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production.');
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('Refusing to seed: DATABASE_URL is not a valid URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Refusing to seed: DATABASE_URL must use postgresql.');
  }

  const host = parsed.hostname.toLowerCase();
  if (!localHosts().has(host)) {
    throw new Error(
      `Refusing to seed: DATABASE_URL host "${host}" is not a local development database.`,
    );
  }

  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, '')).toLowerCase();
  if (dbName.includes('prod') || dbName.includes('production')) {
    throw new Error(`Refusing to seed: database name "${dbName}" looks like production.`);
  }
}

function resolveDemoPassword() {
  const fromEnv = process.env.DEMO_SEED_PASSWORD;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    if (fromEnv.length < 8 || fromEnv.length > 72) {
      throw new Error('DEMO_SEED_PASSWORD must be between 8 and 72 characters.');
    }
    return fromEnv;
  }
  if ((process.env.NODE_ENV ?? 'development') === 'development') {
    return DEFAULT_LOCAL_PASSWORD;
  }
  throw new Error('DEMO_SEED_PASSWORD is required outside local development.');
}

function fingerprintUser(user) {
  return JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    passwordHash: user.passwordHash,
    companyId: user.companyId,
    fullName: user.fullName,
  });
}

async function snapshotNonDemoUsers(prisma) {
  const users = await prisma.user.findMany({
    where: { email: { notIn: DEMO_EMAILS } },
    select: {
      id: true,
      email: true,
      role: true,
      accountStatus: true,
      passwordHash: true,
      companyId: true,
      fullName: true,
    },
    orderBy: { email: 'asc' },
  });
  return new Map(users.map((user) => [user.id, fingerprintUser(user)]));
}

function assertNonDemoUsersUnchanged(before, after) {
  if (before.size !== after.size) {
    throw new Error(
      `Demo seed changed non-demo user count (${before.size} → ${after.size}). Aborting report.`,
    );
  }
  for (const [id, fingerprint] of before) {
    if (after.get(id) !== fingerprint) {
      throw new Error(`Demo seed modified non-demo user ${id}.`);
    }
  }
}

async function findCatalogItem(prisma, model, aliases) {
  for (const label of aliases) {
    const exact = await prisma[model].findFirst({
      where: {
        sourceSystem: 'ESCO',
        preferredLabel: { equals: label, mode: 'insensitive' },
      },
      select: { id: true, preferredLabel: true, sourceUri: true },
    });
    if (exact) {
      return exact;
    }
  }
  for (const label of aliases) {
    const partial = await prisma[model].findFirst({
      where: {
        sourceSystem: 'ESCO',
        preferredLabel: { contains: label, mode: 'insensitive' },
      },
      orderBy: { preferredLabel: 'asc' },
      select: { id: true, preferredLabel: true, sourceUri: true },
    });
    if (partial) {
      return partial;
    }
  }
  return null;
}

async function requireSkills(prisma) {
  const resolved = {};
  const missing = [];
  for (const [key, aliases] of Object.entries(SKILL_ALIASES)) {
    const skill = await findCatalogItem(prisma, 'skill', aliases);
    if (!skill) {
      missing.push(`${key} (${aliases[0]})`);
    } else {
      resolved[key] = skill;
    }
  }
  if (missing.length) {
    throw new Error(
      `ESCO skills not found: ${missing.join(', ')}. Import ESCO before seeding (npm run esco:import --prefix server).`,
    );
  }
  return resolved;
}

async function requireOccupations(prisma) {
  const resolved = {};
  const missing = [];
  for (const [key, aliases] of Object.entries(OCCUPATION_ALIASES)) {
    const occupation = await findCatalogItem(prisma, 'occupation', aliases);
    if (!occupation) {
      missing.push(`${key} (${aliases[0]})`);
    } else {
      resolved[key] = occupation;
    }
  }
  if (missing.length) {
    throw new Error(
      `ESCO occupations not found: ${missing.join(', ')}. Import ESCO before seeding.`,
    );
  }
  return resolved;
}

async function upsertDemoUser(prisma, account, passwordHash, plaintextPassword, counts) {
  const existing = await prisma.user.findUnique({
    where: { email: account.email },
  });

  const profile = {
    fullName: account.fullName,
    phone: account.phone,
    role: account.role,
    accountStatus: 'ACTIVE',
    educationLevel: account.educationLevel ?? null,
    fieldOfStudy: account.fieldOfStudy ?? null,
    institution: account.institution ?? null,
    graduationYear: account.graduationYear ?? null,
    location: account.location ?? null,
    experienceSummary: account.experienceSummary ?? null,
    jobTitle: account.jobTitle ?? null,
    department: account.department ?? null,
    termsAcceptedAt: existing?.termsAcceptedAt ?? new Date(),
  };

  if (!existing) {
    const created = await prisma.user.create({
      data: {
        email: account.email,
        passwordHash,
        ...profile,
      },
    });
    counts.usersCreated += 1;
    return created;
  }

  const passwordMatches = await verifyPassword(plaintextPassword, existing.passwordHash);
  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...profile,
      ...(passwordMatches ? {} : { passwordHash }),
    },
  });
  counts.usersUpdated += 1;
  return updated;
}

async function ensureCompany(prisma, hr, staff, counts) {
  const existingByReg = await prisma.company.findFirst({
    where: { registrationNumber: DEMO_REGISTRATION_NUMBER },
  });

  if (hr.companyId && existingByReg && hr.companyId !== existingByReg.id) {
    throw new Error(
      `hr@techcorp.demo is already attached to company ${hr.companyId}, which is not the TechCorp demonstration company.`,
    );
  }

  if (!hr.companyId && existingByReg) {
    await prisma.user.update({
      where: { id: hr.id },
      data: { companyId: existingByReg.id },
    });
    counts.staffLinked += 1;
  }

  const result = await upsertOwnedCompany(prisma, hr.id, COMPANY_PROFILE);
  if (result.error) {
    throw new Error('Could not upsert the TechCorp demonstration company.');
  }
  if (result.created) {
    counts.companiesCreated += 1;
  } else {
    counts.companiesUpdated += 1;
  }

  const company = result.company;
  const staffRecord = await prisma.user.findUnique({ where: { id: staff.id } });
  if (staffRecord.companyId && staffRecord.companyId !== company.id) {
    throw new Error(
      `staff@techcorp.demo is already attached to a different company (${staffRecord.companyId}).`,
    );
  }
  if (staffRecord.companyId !== company.id) {
    await prisma.user.update({
      where: { id: staff.id },
      data: { companyId: company.id },
    });
    counts.staffLinked += 1;
  }

  await prisma.user.update({
    where: { id: (await prisma.user.findUnique({ where: { email: 'admin@peaceone.demo' } })).id },
    data: { companyId: null },
  });

  return company;
}

function jobDefinitions(skills) {
  return [
    {
      title: 'Junior Data Analyst',
      publish: true,
      description:
        'Join the TechCorp analytics team (demonstration posting). You will clean datasets, build descriptive reports, and support business stakeholders with SQL and Python. This vacancy exists only for the PeaceOne FYP demonstration.',
      qualificationRequired: 'Diploma or bachelor’s degree in a quantitative, computing, or related field.',
      experienceRequired: '0–2 years. Internships, final-year projects, or course assignments are welcome.',
      employmentType: 'FULL_TIME',
      location: 'Petaling Jaya, Selangor (hybrid)',
      salaryMin: 3500,
      salaryMax: 4800,
      requiredSkills: [
        { skillId: skills.python.id, requiredLevel: 'Intermediate' },
        { skillId: skills.sql.id, requiredLevel: 'Intermediate' },
        { skillId: skills.dataAnalysis.id, requiredLevel: 'Intermediate' },
        { skillId: skills.statistics.id, requiredLevel: 'Beginner' },
      ],
    },
    {
      title: 'Software Developer',
      publish: true,
      description:
        'Build and maintain internal web services for TechCorp (demonstration posting). Work with JavaScript, version control, and software-development practices alongside the product team.',
      qualificationRequired: 'Bachelor’s degree in software engineering, computer science, or equivalent project experience.',
      experienceRequired: '0–3 years, including internships or substantial personal/academic projects.',
      employmentType: 'FULL_TIME',
      location: 'Kuala Lumpur',
      salaryMin: 4200,
      salaryMax: 6200,
      requiredSkills: [
        { skillId: skills.javascript.id, requiredLevel: 'Intermediate' },
        { skillId: skills.softwareDevelopment.id, requiredLevel: 'Intermediate' },
        { skillId: skills.git.id, requiredLevel: 'Beginner' },
        { skillId: skills.communication.id, requiredLevel: 'Intermediate' },
      ],
    },
    {
      title: 'Digital Marketing Executive',
      publish: false,
      description:
        'Plan and coordinate digital campaigns for TechCorp (demonstration draft). This posting is left as DRAFT so the employer workspace can show unpublished jobs. It is not visible in authenticated candidate search.',
      qualificationRequired: 'Diploma or bachelor’s degree in marketing, communications, or a related field.',
      experienceRequired: '0–2 years in digital marketing, campus media, or related project work.',
      employmentType: 'FULL_TIME',
      location: 'Petaling Jaya, Selangor',
      salaryMin: 3200,
      salaryMax: 4500,
      requiredSkills: [
        { skillId: skills.digitalMarketing.id, requiredLevel: 'Intermediate' },
        { skillId: skills.socialMedia.id, requiredLevel: 'Intermediate' },
        { skillId: skills.communication.id, requiredLevel: 'Intermediate' },
      ],
    },
  ];
}

async function ensureJobs(prisma, hrId, skills, counts) {
  const jobs = {};
  for (const spec of jobDefinitions(skills)) {
    const existing = await prisma.job.findFirst({
      where: {
        title: spec.title,
        company: { registrationNumber: DEMO_REGISTRATION_NUMBER },
      },
      include: { skills: true },
    });

    let jobId;
    if (!existing) {
      const created = await createOwnedJob(prisma, hrId, {
        title: spec.title,
        description: spec.description,
        qualificationRequired: spec.qualificationRequired,
        experienceRequired: spec.experienceRequired,
        employmentType: spec.employmentType,
        location: spec.location,
        salaryMin: spec.salaryMin,
        salaryMax: spec.salaryMax,
        requiredSkills: spec.requiredSkills,
      });
      jobId = created.id;
      counts.jobsCreated += 1;
    } else {
      jobId = existing.id;
      if (existing.status !== 'CLOSED' && existing.status !== 'SUSPENDED') {
        await updateOwnedJob(prisma, hrId, existing.id, {
          description: spec.description,
          qualificationRequired: spec.qualificationRequired,
          experienceRequired: spec.experienceRequired,
          employmentType: spec.employmentType,
          location: spec.location,
          salaryMin: spec.salaryMin,
          salaryMax: spec.salaryMax,
          requiredSkills: spec.requiredSkills,
        });
        counts.jobsUpdated += 1;
      }
    }

    const current = await prisma.job.findUnique({ where: { id: jobId } });
    if (spec.publish && current.status === 'DRAFT') {
      await publishOwnedJob(prisma, hrId, jobId);
      counts.jobsPublished += 1;
    }
    jobs[spec.title] = await prisma.job.findUnique({ where: { id: jobId } });
  }
  return jobs;
}

async function upsertUserSkills(prisma, userId, entries, counts) {
  for (const entry of entries) {
    const existing = await prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId: entry.skillId } },
    });
    if (!existing) {
      await prisma.userSkill.create({
        data: {
          userId,
          skillId: entry.skillId,
          proficiencyLevel: entry.proficiencyLevel,
        },
      });
      counts.userSkillsCreated += 1;
    } else if (existing.proficiencyLevel !== entry.proficiencyLevel) {
      await prisma.userSkill.update({
        where: { id: existing.id },
        data: { proficiencyLevel: entry.proficiencyLevel },
      });
      counts.userSkillsUpdated += 1;
    }
  }
}

async function ensureResume(prisma, user, spec, counts) {
  const title = `${RESUME_TITLE_PREFIX} — ${user.fullName}`;
  const existing = await prisma.resume.findFirst({
    where: { userId: user.id, title },
  });

  const header = {
    title,
    summary: spec.summary,
    templateKey: 'classic',
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    location: user.location,
  };

  let resumeId;
  if (!existing) {
    const created = await createOwnedResume(prisma, user.id, header);
    resumeId = created.id;
    counts.resumesCreated += 1;
  } else {
    resumeId = existing.id;
    counts.resumesUpdated += 1;
  }

  await updateOwnedResume(prisma, user.id, resumeId, {
    ...header,
    education: spec.education,
    experience: spec.experience,
    skills: spec.skills,
    certifications: [],
  });

  return prisma.resume.findUnique({ where: { id: resumeId } });
}

async function ensureApplication(prisma, applicantId, resumeId, jobId, hrId, desiredStatus, reviewNote, counts) {
  const existing = await prisma.application.findUnique({
    where: { jobId_applicantUserId: { jobId, applicantUserId: applicantId } },
  });

  let applicationId;
  if (!existing) {
    const created = await submitOwnedApplication(prisma, applicantId, jobId, resumeId);
    applicationId = created.id;
    counts.applicationsCreated += 1;
  } else {
    applicationId = existing.id;
  }

  const current = await prisma.application.findUnique({ where: { id: applicationId } });
  if (desiredStatus === 'SHORTLISTED') {
    if (current.status === 'SUBMITTED') {
      await transitionCompanyApplication(prisma, hrId, applicationId, 'shortlist', {
        reviewNote,
      });
      counts.applicationsTransitioned += 1;
    } else if (current.status === 'UNDER_REVIEW') {
      await transitionCompanyApplication(prisma, hrId, applicationId, 'shortlist', {
        reviewNote,
      });
      counts.applicationsTransitioned += 1;
    }
  }

  return prisma.application.findUnique({ where: { id: applicationId } });
}

async function ensureInterview(prisma, hrId, studentId, applicationId, counts) {
  const existing = await prisma.interview.findFirst({
    where: {
      applicationId,
      title: INTERVIEW_TITLE,
    },
    orderBy: { createdAt: 'desc' },
  });

  let interviewId;
  if (!existing) {
    const start = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    start.setHours(10, 0, 0, 0);
    const created = await createCompanyInterview(prisma, hrId, {
      applicationId,
      title: INTERVIEW_TITLE,
      interviewType: 'ONLINE',
      scheduledStartAt: start.toISOString(),
      durationMinutes: 45,
      timezone: 'Asia/Kuala_Lumpur',
      meetingLink: 'https://meet.techcorp.demo/peaceone-junior-data-analyst',
      instructions: 'Join five minutes early. This is a PeaceOne demonstration interview, not a real hiring event.',
      employerNotes: 'Demonstration first-round screen.',
    });
    interviewId = created.id;
    counts.interviewsCreated += 1;
  } else {
    interviewId = existing.id;
  }

  const current = await prisma.interview.findUnique({ where: { id: interviewId } });
  if (current.status === 'PROPOSED') {
    await acceptOwnedInterview(prisma, studentId, interviewId);
    counts.interviewsConfirmed += 1;
  }

  return prisma.interview.findUnique({
    where: { id: interviewId },
    include: { events: true },
  });
}

function emptyCounts() {
  return {
    usersCreated: 0,
    usersUpdated: 0,
    companiesCreated: 0,
    companiesUpdated: 0,
    staffLinked: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsPublished: 0,
    userSkillsCreated: 0,
    userSkillsUpdated: 0,
    resumesCreated: 0,
    resumesUpdated: 0,
    applicationsCreated: 0,
    applicationsTransitioned: 0,
    interviewsCreated: 0,
    interviewsConfirmed: 0,
  };
}

async function printVerification(prisma, users, company) {
  const publishedJobs = await prisma.job.count({
    where: { companyId: company.id, status: 'PUBLISHED' },
  });
  const applications = await prisma.application.findMany({
    where: {
      applicant: { email: { in: ['student@peaceone.demo', 'graduate@peaceone.demo'] } },
    },
    include: {
      job: { select: { title: true, companyId: true } },
      applicant: { select: { email: true } },
    },
  });
  const interviews = await prisma.interview.findMany({
    where: { companyId: company.id },
    select: {
      id: true,
      status: true,
      title: true,
      candidateUserId: true,
      createdByUserId: true,
    },
  });
  const notifications = await prisma.notification.groupBy({
    by: ['type'],
    where: { recipientUserId: { in: Object.values(users).map((user) => user.id) } },
    _count: { _all: true },
  });

  const hr = users.hr;
  const staff = users.staff;
  console.log('\nVerification');
  console.log(`  accounts: ${DEMO_EMAILS.join(', ')}`);
  console.log(`  hr.companyId === staff.companyId: ${hr.companyId === staff.companyId && hr.companyId === company.id}`);
  console.log(`  published TechCorp jobs: ${publishedJobs}`);
  console.log(`  demo applications: ${applications.length}`);
  for (const application of applications) {
    console.log(
      `    ${application.applicant.email} → ${application.job.title} [${application.status}] companyMatch=${application.job.companyId === company.id}`,
    );
  }
  console.log(`  TechCorp interviews: ${interviews.length}`);
  for (const interview of interviews) {
    console.log(`    ${interview.title} [${interview.status}]`);
  }
  console.log('  notifications by type:');
  for (const row of notifications) {
    console.log(`    ${row.type}: ${row._count._all}`);
  }
}

async function run() {
  assertSafeDatabaseTarget(config.databaseUrl, config.nodeEnv);
  const plaintextPassword = resolveDemoPassword();
  const counts = emptyCounts();

  console.log(`Seeding PeaceOne demonstration data into ${config.databaseUrl.replace(/:[^:@/]+@/, ':***@')}`);
  console.log(`NODE_ENV=${config.nodeEnv}`);

  try {
    const skillCount = await prisma.skill.count();
    const occupationCount = await prisma.occupation.count();
    if (skillCount === 0 || occupationCount === 0) {
      throw new Error('ESCO catalogue is empty. Run npm run esco:import --prefix server first.');
    }

    const beforeOthers = await snapshotNonDemoUsers(prisma);
    const skills = await requireSkills(prisma);
    const occupations = await requireOccupations(prisma);
    const passwordHash = await hashPassword(plaintextPassword);

    const users = {};
    for (const account of DEMO_ACCOUNTS) {
      users[account.key] = await upsertDemoUser(
        prisma,
        account,
        passwordHash,
        plaintextPassword,
        counts,
      );
    }

    const company = await ensureCompany(prisma, users.hr, users.staff, counts);
    users.hr = await prisma.user.findUnique({ where: { id: users.hr.id } });
    users.staff = await prisma.user.findUnique({ where: { id: users.staff.id } });
    users.admin = await prisma.user.findUnique({ where: { id: users.admin.id } });

    const jobs = await ensureJobs(prisma, users.hr.id, skills, counts);

    await prisma.user.update({
      where: { id: users.student.id },
      data: { targetOccupationId: occupations.dataAnalyst.id },
    });
    await prisma.user.update({
      where: { id: users.graduate.id },
      data: { targetOccupationId: occupations.softwareDeveloper.id },
    });

    await upsertUserSkills(prisma, users.student.id, [
      { skillId: skills.python.id, proficiencyLevel: 'Intermediate' },
      { skillId: skills.sql.id, proficiencyLevel: 'Beginner' },
      { skillId: skills.dataAnalysis.id, proficiencyLevel: 'Beginner' },
      { skillId: skills.communication.id, proficiencyLevel: 'Intermediate' },
    ], counts);

    await upsertUserSkills(prisma, users.graduate.id, [
      { skillId: skills.javascript.id, proficiencyLevel: 'Intermediate' },
      { skillId: skills.softwareDevelopment.id, proficiencyLevel: 'Intermediate' },
      { skillId: skills.git.id, proficiencyLevel: 'Beginner' },
      { skillId: skills.communication.id, proficiencyLevel: 'Intermediate' },
    ], counts);

    const studentResume = await ensureResume(prisma, users.student, {
      summary:
        'Information systems student focusing on data cleaning, SQL reporting, and Python notebooks. This is a PeaceOne demonstration resume, not a claim of completed external courses.',
      education: [
        {
          institution: 'Tunku Abdul Rahman University of Management and Technology',
          qualification: 'Bachelor of Information Systems',
          fieldOfStudy: 'Information Systems',
          startYear: 2023,
          endYear: 2027,
          notes: 'Demonstration education record for the FYP dataset.',
        },
      ],
      experience: [
        {
          jobTitle: 'Data analysis coursework project',
          organization: 'PeaceOne demonstration academic work',
          location: 'Kuala Lumpur',
          startDate: '2025-09-01',
          endDate: '2026-01-15',
          isCurrent: false,
          description: 'Built descriptive dashboards from sample datasets for a class project. Synthetic demonstration experience only.',
        },
      ],
      skills: [
        { skillId: skills.python.id, label: skills.python.preferredLabel, proficiencyLevel: 'Intermediate' },
        { skillId: skills.sql.id, label: skills.sql.preferredLabel, proficiencyLevel: 'Beginner' },
        { skillId: skills.dataAnalysis.id, label: skills.dataAnalysis.preferredLabel, proficiencyLevel: 'Beginner' },
      ],
    }, counts);

    const graduateResume = await ensureResume(prisma, users.graduate, {
      summary:
        'Software engineering graduate seeking a first developer role. Comfortable with JavaScript, Git, and collaborative coursework. This is a PeaceOne demonstration resume.',
      education: [
        {
          institution: 'Universiti Malaya',
          qualification: 'Bachelor of Software Engineering',
          fieldOfStudy: 'Software Engineering',
          startYear: 2021,
          endYear: 2025,
          notes: 'Demonstration education record for the FYP dataset.',
        },
      ],
      experience: [
        {
          jobTitle: 'Software engineering intern (demonstration)',
          organization: 'Campus systems lab — demonstration placement',
          location: 'Kuala Lumpur',
          startDate: '2024-06-01',
          endDate: '2024-08-31',
          isCurrent: false,
          description: 'Supported an internal web prototype during a short internship-style academic placement. Synthetic demonstration experience only.',
        },
      ],
      skills: [
        { skillId: skills.javascript.id, label: skills.javascript.preferredLabel, proficiencyLevel: 'Intermediate' },
        { skillId: skills.softwareDevelopment.id, label: skills.softwareDevelopment.preferredLabel, proficiencyLevel: 'Intermediate' },
        { skillId: skills.git.id, label: skills.git.preferredLabel, proficiencyLevel: 'Beginner' },
      ],
    }, counts);

    const analystJob = jobs['Junior Data Analyst'];
    const developerJob = jobs['Software Developer'];

    const studentApplication = await ensureApplication(
      prisma,
      users.student.id,
      studentResume.id,
      analystJob.id,
      users.hr.id,
      'SHORTLISTED',
      'Demonstration shortlist: profile matches the junior analyst posting.',
      counts,
    );

    await ensureApplication(
      prisma,
      users.graduate.id,
      graduateResume.id,
      developerJob.id,
      users.hr.id,
      'SUBMITTED',
      null,
      counts,
    );

    await ensureInterview(prisma, users.hr.id, users.student.id, studentApplication.id, counts);

    const afterOthers = await snapshotNonDemoUsers(prisma);
    assertNonDemoUsersUnchanged(beforeOthers, afterOthers);

    console.log('\nSeed counts');
    for (const [key, value] of Object.entries(counts)) {
      console.log(`  ${key}: ${value}`);
    }
    console.log(`\nDemonstration password is read from DEMO_SEED_PASSWORD (default local: ${DEFAULT_LOCAL_PASSWORD}).`);
    console.log('Plaintext passwords are not stored in the database.');

    await printVerification(prisma, users, company);
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
