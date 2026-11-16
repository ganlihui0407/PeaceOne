import { hashPassword } from './password.js';
import { upsertOwnedCompany } from './companyQuery.js';
import { createOwnedJob, publishOwnedJob } from './jobQuery.js';
import { createOwnedResume, updateOwnedResume } from './resumeQuery.js';
import { submitOwnedApplication, transitionCompanyApplication } from './applicationQuery.js';
import {
  acceptOwnedInterview,
  cancelCompanyInterview,
  completeCompanyInterview,
  createCompanyInterview,
  rescheduleOwnedInterview,
} from './interviewQuery.js';
import {
  BASE_DEMO_ACCOUNTS,
  DATASET_APPLICATIONS,
  DATASET_CANDIDATE_EMAILS,
  DATASET_CANDIDATES,
  DATASET_COMPANIES,
  DATASET_COMPANY_REGISTRATIONS,
  DATASET_JOBS,
  DATASET_STAFF_EMAILS,
  PROTECTED_DEMO_EMAILS,
} from './recruitmentDatasetCatalog.js';

const DEFAULT_LOCAL_PASSWORD = 'PeaceOneDemo1';
const TARGETS = {
  companies: 5,
  jobs: 10,
  candidates: 15,
  applications: 25,
};

export function catalogApplicationKey(email, registrationNumber, jobTitle) {
  return `${email}::${registrationNumber}::${jobTitle}`;
}

export function expectedCatalogApplicationKeys() {
  const registrations = Object.fromEntries(
    DATASET_COMPANIES.map((company) => [company.key, company.registrationNumber]),
  );
  return DATASET_APPLICATIONS.map((item) => catalogApplicationKey(
    item.candidateEmail,
    registrations[item.companyKey],
    item.jobTitle,
  ));
}

export async function assertPeaceoneTestDatabase(prisma) {
  const rows = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const name = rows[0]?.name;
  if (name !== 'peaceone_test') {
    throw new Error(
      `Refusing recruitment dataset seed: current_database() is "${name}", expected peaceone_test.`,
    );
  }
  return name;
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

function emptyCounts() {
  return {
    usersCreated: 0,
    staffCreated: 0,
    candidatesCreated: 0,
    companiesCreated: 0,
    staffLinked: 0,
    jobsCreated: 0,
    jobsPublished: 0,
    userSkillsCreated: 0,
    careerTargetsSet: 0,
    resumesCreated: 0,
    applicationsCreated: 0,
    applicationsTransitioned: 0,
    interviewsCreated: 0,
    interviewsAdvanced: 0,
    offersIssued: 0,
  };
}

async function findSkillByExactLabel(prisma, label) {
  return prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO', preferredLabel: { equals: label, mode: 'insensitive' } },
    select: { id: true, preferredLabel: true, sourceUri: true },
  });
}

const SKILL_EXACT_FALLBACKS = {
  Git: ['develop software prototype', 'web programming'],
  'software development': ['develop software prototype'],
  statistics: ['statistics'],
};

async function requireSkill(prisma, labels) {
  const list = Array.isArray(labels) ? labels : [labels];
  const expanded = [];
  for (const label of list) {
    expanded.push(...(SKILL_EXACT_FALLBACKS[label] || [label]));
  }
  const seen = new Set();
  for (const label of expanded) {
    if (seen.has(label)) continue;
    seen.add(label);
    const skill = await findSkillByExactLabel(prisma, label);
    if (skill) {
      return skill;
    }
  }
  throw new Error(
    `No exact ESCO preferredLabel for: ${list.join(', ')}. Import ESCO before seeding.`,
  );
}

async function findOccupation(prisma, labels) {
  for (const label of labels) {
    const occupation = await prisma.occupation.findFirst({
      where: { sourceSystem: 'ESCO', preferredLabel: { equals: label, mode: 'insensitive' } },
      select: { id: true, preferredLabel: true, sourceUri: true },
    });
    if (occupation) {
      return occupation;
    }
  }
  return null;
}

async function resolveJobSkills(prisma, skillLabels) {
  const requiredSkills = [];
  const mappings = [];
  const seen = new Set();
  for (const label of skillLabels) {
    const skill = await requireSkill(prisma, [label]);
    if (seen.has(skill.id)) {
      continue;
    }
    seen.add(skill.id);
    requiredSkills.push({ skillId: skill.id, requiredLevel: 'Intermediate' });
    mappings.push({
      preferredLabel: skill.preferredLabel,
      skillId: skill.id,
      sourceUri: skill.sourceUri,
    });
  }
  return { requiredSkills, mappings };
}

async function ensureUser(prisma, spec, passwordHash, counts, conflicts) {
  const existing = await prisma.user.findUnique({ where: { email: spec.email } });
  if (existing) {
    if (spec.role && existing.role !== spec.role && !spec.preserveExisting) {
      conflicts.push(
        `User ${spec.email} exists with role ${existing.role}; expected ${spec.role}. Left unchanged.`,
      );
    }
    return existing;
  }

  const created = await prisma.user.create({
    data: {
      email: spec.email,
      passwordHash,
      fullName: spec.fullName,
      phone: spec.phone ?? null,
      role: spec.role,
      accountStatus: 'ACTIVE',
      educationLevel: spec.educationLevel ?? null,
      fieldOfStudy: spec.fieldOfStudy ?? null,
      institution: spec.institution ?? null,
      graduationYear: spec.graduationYear ?? null,
      location: spec.location ?? null,
      experienceSummary: spec.experienceSummary ?? null,
      jobTitle: spec.jobTitle ?? null,
      department: spec.department ?? null,
      termsAcceptedAt: new Date(),
    },
  });
  counts.usersCreated += 1;
  if (spec.role === 'COMPANY_STAFF') {
    counts.staffCreated += 1;
  }
  if (spec.role === 'STUDENT' || spec.role === 'JOB_SEEKER') {
    counts.candidatesCreated += 1;
  }
  return created;
}

async function ensureCompany(prisma, spec, hrUser, counts, conflicts) {
  const existing = await prisma.company.findFirst({
    where: { registrationNumber: spec.registrationNumber },
  });

  if (existing) {
    if (existing.companyName !== spec.companyName) {
      conflicts.push(
        `Registration ${spec.registrationNumber} already belongs to "${existing.companyName}"; expected "${spec.companyName}". Left unchanged.`,
      );
    }
    if (hrUser.companyId && hrUser.companyId !== existing.id) {
      conflicts.push(
        `${hrUser.email} is attached to a different company than ${spec.registrationNumber}. Left unchanged.`,
      );
      return existing;
    }
    if (!hrUser.companyId) {
      await prisma.user.update({
        where: { id: hrUser.id },
        data: { companyId: existing.id },
      });
      counts.staffLinked += 1;
    }
    return existing;
  }

  if (hrUser.companyId) {
    conflicts.push(
      `${hrUser.email} already has a company but ${spec.registrationNumber} is missing. Left unchanged.`,
    );
    return prisma.company.findUnique({ where: { id: hrUser.companyId } });
  }

  const result = await upsertOwnedCompany(prisma, hrUser.id, {
    companyName: spec.companyName,
    registrationNumber: spec.registrationNumber,
    industry: spec.industry,
    companySize: spec.companySize,
    website: spec.website,
    email: spec.email,
    phone: spec.phone,
    location: spec.location,
    address: spec.address,
    description: spec.description,
  });
  if (result.error) {
    throw new Error(`Could not create company ${spec.companyName}.`);
  }
  counts.companiesCreated += 1;
  return result.company;
}

async function attachStaff(prisma, user, company, counts, conflicts) {
  if (user.companyId && user.companyId !== company.id) {
    conflicts.push(
      `${user.email} is attached to a different company than ${company.companyName}. Left unchanged.`,
    );
    return;
  }
  if (user.companyId !== company.id) {
    await prisma.user.update({
      where: { id: user.id },
      data: { companyId: company.id },
    });
    counts.staffLinked += 1;
  }
}

async function ensureJob(prisma, spec, hrId, company, counts, mappings) {
  const existing = await prisma.job.findFirst({
    where: { title: spec.title, companyId: company.id },
  });
  if (existing) {
    if (existing.status === 'DRAFT') {
      await publishOwnedJob(prisma, hrId, existing.id);
      counts.jobsPublished += 1;
    }
    const skills = await prisma.jobSkill.findMany({
      where: { jobId: existing.id },
      include: { skill: { select: { id: true, preferredLabel: true, sourceUri: true } } },
    });
    for (const row of skills) {
      mappings.push({
        jobTitle: spec.title,
        companyName: company.companyName,
        skillId: row.skill.id,
        preferredLabel: row.skill.preferredLabel,
        sourceUri: row.skill.sourceUri,
      });
    }
    return existing;
  }

  const resolved = await resolveJobSkills(prisma, spec.skillLabels);
  const closesAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const created = await createOwnedJob(prisma, hrId, {
    title: spec.title,
    description: spec.description,
    qualificationRequired: spec.qualificationRequired,
    experienceRequired: spec.experienceRequired,
    employmentType: spec.employmentType,
    location: spec.location,
    salaryMin: spec.salaryMin,
    salaryMax: spec.salaryMax,
    closesAt: closesAt.toISOString(),
    requiredSkills: resolved.requiredSkills,
  });
  counts.jobsCreated += 1;
  await publishOwnedJob(prisma, hrId, created.id);
  counts.jobsPublished += 1;
  for (const mapping of resolved.mappings) {
    mappings.push({
      jobTitle: spec.title,
      companyName: company.companyName,
      ...mapping,
    });
  }
  return prisma.job.findUnique({ where: { id: created.id } });
}

async function ensureUserSkills(prisma, userId, entries, counts) {
  for (const entry of entries) {
    const skill = await requireSkill(prisma, entry.labels);
    const existing = await prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId: skill.id } },
    });
    if (!existing) {
      await prisma.userSkill.create({
        data: {
          userId,
          skillId: skill.id,
          proficiencyLevel: entry.proficiencyLevel,
        },
      });
      counts.userSkillsCreated += 1;
    }
  }
}

async function ensureCareerTarget(prisma, user, labels, counts) {
  if (user.targetOccupationId) {
    return;
  }
  const occupation = await findOccupation(prisma, labels);
  if (!occupation) {
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { targetOccupationId: occupation.id },
  });
  counts.careerTargetsSet += 1;
}

async function ensureResume(prisma, user, spec, counts) {
  const existing = await prisma.resume.findFirst({
    where: { userId: user.id, title: spec.resumeTitle },
  });
  const header = {
    title: spec.resumeTitle,
    summary: spec.resume.summary,
    templateKey: 'classic',
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    location: user.location,
  };

  const skillRows = [];
  for (const entry of spec.skillLabels) {
    const skill = await requireSkill(prisma, entry.labels);
    skillRows.push({
      skillId: skill.id,
      label: skill.preferredLabel,
      proficiencyLevel: entry.proficiencyLevel,
    });
  }

  if (!existing) {
    const created = await createOwnedResume(prisma, user.id, header);
    await updateOwnedResume(prisma, user.id, created.id, {
      ...header,
      education: spec.resume.education,
      experience: spec.resume.experience,
      skills: skillRows,
      certifications: [],
    });
    counts.resumesCreated += 1;
    return prisma.resume.findUnique({ where: { id: created.id } });
  }
  return existing;
}

function futureDate(daysAhead, hour) {
  const start = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  start.setHours(hour, 0, 0, 0);
  if (start.getTime() <= Date.now()) {
    start.setDate(start.getDate() + 1);
  }
  return start;
}

async function applyActions(prisma, application, hrId, actions, counts, conflicts) {
  let current = await prisma.application.findUnique({ where: { id: application.id } });
  for (const action of actions) {
    const already = {
      review: 'UNDER_REVIEW',
      shortlist: 'SHORTLISTED',
      reject: 'REJECTED',
      offer: 'OFFERED',
    }[action];
    if (current.status === already) {
      continue;
    }
    if (action === 'offer' && current.status === 'INTERVIEW') {
      await transitionCompanyApplication(prisma, hrId, current.id, 'offer', {
        reviewNote: 'PeaceOne demonstration offer. Not a real employment contract.',
      });
      counts.applicationsTransitioned += 1;
      counts.offersIssued += 1;
      current = await prisma.application.findUnique({ where: { id: current.id } });
      continue;
    }
    if (action === 'offer' && current.status === 'SHORTLISTED') {
      await transitionCompanyApplication(prisma, hrId, current.id, 'offer', {
        reviewNote: 'PeaceOne demonstration offer. Not a real employment contract.',
      });
      counts.applicationsTransitioned += 1;
      counts.offersIssued += 1;
      current = await prisma.application.findUnique({ where: { id: current.id } });
      continue;
    }
    if (action === 'shortlist' && current.status === 'INTERVIEW') {
      continue;
    }
    if (action === 'shortlist' && current.status === 'OFFERED') {
      continue;
    }
    if (action === 'review' && ['UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED'].includes(current.status)) {
      continue;
    }
    try {
      await transitionCompanyApplication(prisma, hrId, current.id, action, {
        reviewNote: `PeaceOne demonstration ${action}. Synthetic recruitment walkthrough only.`,
      });
      counts.applicationsTransitioned += 1;
      if (action === 'offer') {
        counts.offersIssued += 1;
      }
      current = await prisma.application.findUnique({ where: { id: current.id } });
    } catch (error) {
      conflicts.push(
        `Could not apply ${action} to application ${current.id} (${current.status}): ${error.message}`,
      );
      break;
    }
  }
  return current;
}

async function ensureInterview(prisma, spec, application, hrId, candidateId, counts, conflicts) {
  const existing = await prisma.interview.findFirst({
    where: { applicationId: application.id, title: spec.title },
  });

  let interview = existing;
  if (!interview) {
    const start = futureDate(spec.daysAhead, spec.hour);
    const created = await createCompanyInterview(prisma, hrId, {
      applicationId: application.id,
      title: spec.title,
      interviewType: 'ONLINE',
      scheduledStartAt: start.toISOString(),
      durationMinutes: 45,
      timezone: 'Asia/Kuala_Lumpur',
      meetingLink: `https://meet.peaceone.demo/${encodeURIComponent(spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`,
      instructions: 'Join five minutes early. This is a PeaceOne demonstration interview, not a real hiring event.',
      employerNotes: 'Demonstration interview record.',
    });
    interview = await prisma.interview.findUnique({ where: { id: created.id } });
    counts.interviewsCreated += 1;
  }

  if (spec.flow === 'propose') {
    return interview;
  }

  if (spec.flow === 'cancel') {
    if (['PROPOSED', 'CONFIRMED', 'RESCHEDULE_REQUESTED'].includes(interview.status)) {
      await cancelCompanyInterview(prisma, hrId, interview.id);
      counts.interviewsAdvanced += 1;
    }
    return prisma.interview.findUnique({ where: { id: interview.id } });
  }

  if (interview.status === 'PROPOSED' && ['accept', 'complete', 'reschedule'].includes(spec.flow)) {
    await acceptOwnedInterview(prisma, candidateId, interview.id);
    counts.interviewsAdvanced += 1;
    interview = await prisma.interview.findUnique({ where: { id: interview.id } });
  }

  if (spec.flow === 'complete' && interview.status === 'CONFIRMED') {
    await completeCompanyInterview(prisma, hrId, interview.id, {
      attendance: 'ATTENDED',
      outcome: 'POSITIVE',
      employerNotes: 'Demonstration completion. Not a real hiring decision.',
    });
    counts.interviewsAdvanced += 1;
  }

  if (spec.flow === 'reschedule' && ['PROPOSED', 'CONFIRMED'].includes(interview.status)) {
    const requested = futureDate(spec.daysAhead + 3, spec.hour + 1);
    await rescheduleOwnedInterview(prisma, candidateId, interview.id, {
      requestedStartAt: requested.toISOString(),
      requestedDurationMinutes: 45,
      candidateResponseNote: 'PeaceOne demonstration reschedule request.',
    });
    counts.interviewsAdvanced += 1;
  } else if (spec.flow === 'reschedule' && interview.status !== 'RESCHEDULE_REQUESTED') {
    conflicts.push(
      `Interview "${spec.title}" is ${interview.status}; expected RESCHEDULE_REQUESTED after flow.`,
    );
  }

  return prisma.interview.findUnique({ where: { id: interview.id } });
}

export async function collectRecruitmentIntegrity(prisma) {
  const candidateEmails = DATASET_CANDIDATE_EMAILS;
  const [
    database,
    companies,
    jobs,
    candidates,
    applications,
    interviews,
    notifications,
    userSkills,
    resumes,
    snapshots,
    jobSkills,
    duplicateApps,
    duplicateEmails,
    duplicateRegs,
    orphanJobSkills,
    snapshotGaps,
    interviewMismatches,
    notificationCross,
    statusGroups,
    storedApplications,
  ] = await Promise.all([
    prisma.$queryRaw`SELECT current_database()::text AS name`,
    prisma.company.count({ where: { registrationNumber: { in: DATASET_COMPANY_REGISTRATIONS } } }),
    prisma.job.count({
      where: { company: { registrationNumber: { in: DATASET_COMPANY_REGISTRATIONS } } },
    }),
    prisma.user.count({
      where: { email: { in: candidateEmails }, role: { in: ['STUDENT', 'JOB_SEEKER'] } },
    }),
    prisma.application.count({
      where: { applicant: { email: { in: candidateEmails } } },
    }),
    prisma.interview.count({
      where: { candidate: { email: { in: candidateEmails } } },
    }),
    prisma.notification.count({
      where: { recipient: { email: { in: [...candidateEmails, ...DATASET_STAFF_EMAILS] } } },
    }),
    prisma.userSkill.count({
      where: { user: { email: { in: candidateEmails } } },
    }),
    prisma.resume.count({
      where: { user: { email: { in: candidateEmails } } },
    }),
    prisma.applicationResumeSnapshot.count({
      where: { application: { applicant: { email: { in: candidateEmails } } } },
    }),
    prisma.jobSkill.count({
      where: { job: { company: { registrationNumber: { in: DATASET_COMPANY_REGISTRATIONS } } } },
    }),
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS n FROM (
        SELECT 1 FROM applications
        GROUP BY job_id, applicant_user_id
        HAVING COUNT(*) > 1
      ) d
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS n FROM (
        SELECT 1 FROM users
        GROUP BY email
        HAVING COUNT(*) > 1
      ) d
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS n FROM (
        SELECT 1 FROM companies
        WHERE registration_number IS NOT NULL
        GROUP BY registration_number
        HAVING COUNT(*) > 1
      ) d
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS n
      FROM job_skills js
      LEFT JOIN skills s ON s.id = js.skill_id
      WHERE s.id IS NULL OR s.source_system <> 'ESCO'
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS n
      FROM applications a
      LEFT JOIN application_resume_snapshots s ON s.application_id = a.id
      WHERE s.id IS NULL
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS n
      FROM interviews i
      JOIN applications a ON a.id = i.application_id
      WHERE i.candidate_user_id <> a.applicant_user_id
         OR i.job_id <> a.job_id
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS n
      FROM notifications n
      JOIN interviews i ON n.related_entity_id = i.id
      WHERE n.related_entity_type = 'INTERVIEW'
        AND n.recipient_user_id <> i.candidate_user_id
        AND n.recipient_user_id NOT IN (
          SELECT u.id FROM users u WHERE u.company_id = i.company_id
        )
    `,
    prisma.application.groupBy({
      by: ['status'],
      where: { applicant: { email: { in: candidateEmails } } },
      _count: { _all: true },
    }),
    prisma.application.findMany({
      where: { applicant: { email: { in: candidateEmails } } },
      select: {
        applicant: { select: { email: true } },
        job: {
          select: {
            title: true,
            status: true,
            company: { select: { registrationNumber: true } },
          },
        },
        snapshot: { select: { id: true } },
      },
    }),
  ]);

  const statuses = {};
  for (const row of statusGroups) {
    statuses[row.status] = row._count._all;
  }

  const expectedKeys = expectedCatalogApplicationKeys();
  const expectedKeySet = new Set(expectedKeys);
  const storedKeys = storedApplications.map((row) => catalogApplicationKey(
    row.applicant.email,
    row.job.company.registrationNumber,
    row.job.title,
  ));
  const presentCatalog = storedKeys.filter((key) => expectedKeySet.has(key));
  const additionalApplications = storedKeys.filter((key) => !expectedKeySet.has(key));

  const protectedUsers = await prisma.user.findMany({
    where: { email: { in: PROTECTED_DEMO_EMAILS } },
    select: { email: true, fullName: true, role: true, companyId: true },
    orderBy: { email: 'asc' },
  });

  return {
    database: database[0]?.name,
    totals: {
      companies,
      jobs,
      candidates,
      applications,
      interviews,
      notifications,
      userSkills,
      resumes,
      snapshots,
      jobSkills,
    },
    catalog: {
      expected: expectedKeys.length,
      present: new Set(presentCatalog).size,
      additional: additionalApplications.length,
    },
    statuses,
    duplicates: {
      applications: duplicateApps[0].n,
      emails: duplicateEmails[0].n,
      registrations: duplicateRegs[0].n,
    },
    orphans: {
      jobSkills: orphanJobSkills[0].n,
      missingSnapshots: snapshotGaps[0].n,
      interviewMismatches: interviewMismatches[0].n,
      notificationCross: notificationCross[0].n,
    },
    protectedUsers,
  };
}

export async function seedRecruitmentDataset(prisma) {
  await assertPeaceoneTestDatabase(prisma);
  const password = resolveDemoPassword();
  const passwordHash = await hashPassword(password);
  const counts = emptyCounts();
  const conflicts = [];
  const mappings = [];
  const createdLogins = [];

  const usersByEmail = {};
  for (const account of BASE_DEMO_ACCOUNTS) {
    usersByEmail[account.email] = await ensureUser(
      prisma,
      { ...account, preserveExisting: true },
      passwordHash,
      counts,
      conflicts,
    );
  }

  const companiesByKey = {};
  for (const companySpec of DATASET_COMPANIES) {
    let hr;
    if (companySpec.key === 'techcorp') {
      hr = usersByEmail['hr@techcorp.demo'];
    } else {
      const staffSpec = companySpec.staff[0];
      const staffExisted = Boolean(await prisma.user.findUnique({ where: { email: staffSpec.email } }));
      hr = await ensureUser(
        prisma,
        {
          ...staffSpec,
          role: 'COMPANY_STAFF',
          experienceSummary: staffSpec.experienceSummary,
        },
        passwordHash,
        counts,
        conflicts,
      );
      usersByEmail[staffSpec.email] = hr;
      if (!staffExisted) {
        createdLogins.push({
          email: staffSpec.email,
          role: 'COMPANY_STAFF',
          company: companySpec.companyName,
        });
      }
    }
    const company = await ensureCompany(prisma, companySpec, hr, counts, conflicts);
    companiesByKey[companySpec.key] = company;
    hr = await prisma.user.findUnique({ where: { id: hr.id } });
    usersByEmail[hr.email] = hr;
    await attachStaff(prisma, hr, company, counts, conflicts);

    if (companySpec.key === 'techcorp') {
      const staff = usersByEmail['staff@techcorp.demo'];
      await attachStaff(prisma, staff, company, counts, conflicts);
    }
  }

  const admin = await prisma.user.findUnique({ where: { email: 'admin@peaceone.demo' } });
  if (admin?.companyId) {
    await prisma.user.update({ where: { id: admin.id }, data: { companyId: null } });
  }

  const jobsByKey = {};
  for (const jobSpec of DATASET_JOBS) {
    const company = companiesByKey[jobSpec.companyKey];
    const hrEmail = DATASET_COMPANIES.find((item) => item.key === jobSpec.companyKey).email;
    const hr = await prisma.user.findUnique({ where: { email: hrEmail } });
    const job = await ensureJob(prisma, jobSpec, hr.id, company, counts, mappings);
    jobsByKey[`${jobSpec.companyKey}::${jobSpec.title}`] = job;
  }

  for (const candidate of DATASET_CANDIDATES) {
    const existing = await prisma.user.findUnique({ where: { email: candidate.email } });
    const user = existing
      ? existing
      : await ensureUser(
        prisma,
        { ...candidate, role: candidate.role || 'JOB_SEEKER', preserveExisting: candidate.preserveExisting },
        passwordHash,
        counts,
        conflicts,
      );
    usersByEmail[candidate.email] = user;
    if (!existing) {
      createdLogins.push({
        email: candidate.email,
        role: candidate.role || 'JOB_SEEKER',
        fullName: candidate.fullName,
      });
    }
    await ensureUserSkills(prisma, user.id, candidate.skillLabels, counts);
    await ensureCareerTarget(prisma, user, candidate.occupationLabels, counts);
    const resume = await ensureResume(prisma, user, candidate, counts);
    usersByEmail[candidate.email] = { ...user, resumeId: resume.id };
  }

  for (const applicationSpec of DATASET_APPLICATIONS) {
    const applicant = usersByEmail[applicationSpec.candidateEmail];
    const job = jobsByKey[`${applicationSpec.companyKey}::${applicationSpec.jobTitle}`];
    const hrEmail = DATASET_COMPANIES.find((item) => item.key === applicationSpec.companyKey).email;
    const hr = await prisma.user.findUnique({ where: { email: hrEmail } });
    if (!applicant?.resumeId || !job || !hr) {
      conflicts.push(
        `Missing prerequisites for ${applicationSpec.candidateEmail} → ${applicationSpec.jobTitle}.`,
      );
      continue;
    }

    const existing = await prisma.application.findUnique({
      where: {
        jobId_applicantUserId: {
          jobId: job.id,
          applicantUserId: applicant.id,
        },
      },
    });

    let application = existing;
    if (!application) {
      application = await submitOwnedApplication(prisma, applicant.id, job.id, applicant.resumeId);
      counts.applicationsCreated += 1;
    }

    application = await applyActions(
      prisma,
      application,
      hr.id,
      applicationSpec.actions,
      counts,
      conflicts,
    );

    if (applicationSpec.interview) {
      const current = await prisma.application.findUnique({ where: { id: application.id } });
      if (!['SHORTLISTED', 'INTERVIEW'].includes(current.status)) {
        conflicts.push(
          `Interview skipped for ${applicationSpec.candidateEmail} / ${applicationSpec.jobTitle}: status is ${current.status}.`,
        );
      } else {
        await ensureInterview(
          prisma,
          applicationSpec.interview,
          current,
          hr.id,
          applicant.id,
          counts,
          conflicts,
        );
      }
    }
  }

  const integrity = await collectRecruitmentIntegrity(prisma);
  return {
    counts,
    conflicts,
    mappings,
    createdLogins,
    integrity,
    targets: TARGETS,
    passwordHint: 'Local demonstration password matches DEMO_SEED_PASSWORD (PeaceOneDemo1 in development).',
  };
}
