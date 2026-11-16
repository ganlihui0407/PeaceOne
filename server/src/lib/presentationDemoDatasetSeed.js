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
  LearningError,
  completeOwnLesson,
  enrollInCourse,
  submitOwnAttempt,
} from './learningQuery.js';
import {
  DATASET_TARGETS,
  PRESENTATION_CANDIDATES,
  PRESENTATION_COMPANIES,
  PRESENTATION_COURSES,
  PRESENTATION_JOBS,
  PRESENTATION_REGISTRATIONS,
  STATUS_TARGETS,
} from './presentationDemoDatasetCatalog.js';

const DEFAULT_LOCAL_PASSWORD = 'PeaceOneDemo1';
const PROTECTED_SQL_SLUG = 'peaceone-demo-sql-fundamentals';
const PROTECTED_STUDENT = 'student@peaceone.demo';

export async function assertPeaceoneTestDatabase(prisma) {
  const rows = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const name = rows[0]?.name;
  if (name !== 'peaceone_test') {
    throw new Error(
      `Refusing presentation demo dataset seed: current_database() is "${name}", expected peaceone_test.`,
    );
  }
  return name;
}

export function resolveDemoPassword() {
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

async function findSkillByExactLabel(prisma, label) {
  return prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO', preferredLabel: { equals: label, mode: 'insensitive' } },
    select: { id: true, preferredLabel: true, sourceUri: true },
  });
}

export async function requireSkill(prisma, labels) {
  const list = Array.isArray(labels) ? labels : [labels];
  for (const label of list) {
    const skill = await findSkillByExactLabel(prisma, label);
    if (skill) {
      return skill;
    }
  }
  throw new Error(`No exact ESCO preferredLabel for: ${list.join(', ')}. Import ESCO before seeding.`);
}

export async function findOccupation(prisma, labels) {
  for (const label of labels) {
    const occupation = await prisma.occupation.findFirst({
      where: { sourceSystem: 'ESCO', preferredLabel: { equals: label, mode: 'insensitive' } },
      select: { id: true },
    });
    if (occupation) {
      return occupation;
    }
  }
  return null;
}

async function resolveJobSkills(prisma, skillLabels) {
  const requiredSkills = [];
  const seen = new Set();
  for (const label of skillLabels) {
    const skill = await requireSkill(prisma, [label]);
    if (seen.has(skill.id)) {
      continue;
    }
    seen.add(skill.id);
    requiredSkills.push({ skillId: skill.id, requiredLevel: 'Intermediate' });
  }
  return requiredSkills;
}

export function emptyCounts() {
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
    coursesCreated: 0,
    lessonsCreated: 0,
    enrollmentsCreated: 0,
    lessonsCompleted: 0,
    attemptsFailed: 0,
    attemptsPassed: 0,
  };
}

export async function ensureUser(prisma, spec, passwordHash, counts) {
  const existing = await prisma.user.findUnique({ where: { email: spec.email } });
  if (existing) {
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

export async function ensureCompany(prisma, spec, hrUser, counts, conflicts) {
  const existing = await prisma.company.findFirst({
    where: { registrationNumber: spec.registrationNumber },
  });
  if (existing) {
    if (!hrUser.companyId) {
      await prisma.user.update({ where: { id: hrUser.id }, data: { companyId: existing.id } });
      counts.staffLinked += 1;
    }
    return existing;
  }
  if (hrUser.companyId) {
    conflicts.push(`${hrUser.email} already has a company; skipped ${spec.registrationNumber}.`);
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

export async function attachStaff(prisma, user, company, counts) {
  if (user.companyId !== company.id) {
    await prisma.user.update({ where: { id: user.id }, data: { companyId: company.id } });
    counts.staffLinked += 1;
  }
}

export async function ensureJob(prisma, spec, hrId, company, counts, options = {}) {
  const existing = await prisma.job.findFirst({
    where: { title: spec.title, companyId: company.id },
  });
  if (existing) {
    if (existing.status === 'DRAFT' && options.publishExistingDraft !== false) {
      await publishOwnedJob(prisma, hrId, existing.id);
      counts.jobsPublished += 1;
    }
    return existing;
  }
  const requiredSkills = await resolveJobSkills(prisma, spec.skillLabels);
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
    requiredSkills,
  });
  counts.jobsCreated += 1;
  await publishOwnedJob(prisma, hrId, created.id);
  counts.jobsPublished += 1;
  return prisma.job.findUnique({ where: { id: created.id } });
}

export async function ensureUserSkills(prisma, userId, entries, counts) {
  for (const entry of entries) {
    const skill = await requireSkill(prisma, entry.labels);
    const existing = await prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId: skill.id } },
    });
    if (!existing) {
      await prisma.userSkill.create({
        data: { userId, skillId: skill.id, proficiencyLevel: entry.proficiencyLevel },
      });
      counts.userSkillsCreated += 1;
    }
  }
}

export async function ensureCareerTarget(prisma, user, labels, counts) {
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

export async function ensureResume(prisma, user, spec, counts) {
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

export async function applyActions(prisma, application, hrId, actions, counts, conflicts) {
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
    if (action === 'shortlist' && ['INTERVIEW', 'OFFERED'].includes(current.status)) {
      continue;
    }
    if (action === 'review' && ['UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED'].includes(current.status)) {
      continue;
    }
    try {
      await transitionCompanyApplication(prisma, hrId, current.id, action, {
        reviewNote: `PeaceOne demonstration ${action}. Synthetic expansion dataset only.`,
      });
      counts.applicationsTransitioned += 1;
      if (action === 'offer') {
        counts.offersIssued += 1;
      }
      current = await prisma.application.findUnique({ where: { id: current.id } });
    } catch (error) {
      conflicts.push(`Could not apply ${action} to ${current.id} (${current.status}): ${error.message || error}`);
      break;
    }
  }
  return current;
}

export async function ensureInterview(prisma, spec, application, hrId, candidateId, counts, conflicts = []) {
  const existing = await prisma.interview.findFirst({
    where: { applicationId: application.id, title: spec.title },
  });
  let interview = existing;
  if (!interview) {
    const start = futureDate(spec.daysAhead, spec.hour);
    try {
      const created = await createCompanyInterview(prisma, hrId, {
        applicationId: application.id,
        title: spec.title,
        interviewType: 'ONLINE',
        scheduledStartAt: start.toISOString(),
        durationMinutes: 45,
        timezone: 'Asia/Kuala_Lumpur',
        meetingLink: `https://meet.peaceone.demo/${encodeURIComponent(spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`,
        instructions: 'Demonstration interview. Not a real hiring event.',
        employerNotes: 'Expanded PeaceOne FYP interview record.',
      });
      interview = await prisma.interview.findUnique({ where: { id: created.id } });
      counts.interviewsCreated += 1;
    } catch (error) {
      conflicts.push(`Could not create interview for ${application.id}: ${error.message || error}`);
      return null;
    }
  }
  if (spec.flow === 'propose') {
    return interview;
  }
  if (spec.flow === 'cancel' && ['PROPOSED', 'CONFIRMED', 'RESCHEDULE_REQUESTED'].includes(interview.status)) {
    await cancelCompanyInterview(prisma, hrId, interview.id);
    counts.interviewsAdvanced += 1;
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
      employerNotes: 'Demonstration completion.',
    });
    counts.interviewsAdvanced += 1;
  }
  if (spec.flow === 'reschedule' && ['PROPOSED', 'CONFIRMED'].includes(interview.status)) {
    await rescheduleOwnedInterview(prisma, candidateId, interview.id, {
      requestedStartAt: futureDate(spec.daysAhead + 3, spec.hour + 1).toISOString(),
      requestedDurationMinutes: 45,
      candidateResponseNote: 'PeaceOne demonstration reschedule request.',
    });
    counts.interviewsAdvanced += 1;
  }
  return prisma.interview.findUnique({ where: { id: interview.id } });
}

export function planApplicationStatuses(currentByStatus) {
  const needed = {};
  for (const [status, target] of Object.entries(STATUS_TARGETS)) {
    const have = currentByStatus[status] || 0;
    needed[status] = Math.max(0, target - have);
  }
  const plan = [];
  const push = (status, count, spec) => {
    for (let index = 0; index < count; index += 1) {
      plan.push({ finalStatus: status, ...spec });
    }
  };
  push('SUBMITTED', needed.SUBMITTED, { actions: [] });
  push('UNDER_REVIEW', needed.UNDER_REVIEW, { actions: ['review'] });
  push('SHORTLISTED', needed.SHORTLISTED, { actions: ['review', 'shortlist'] });
  push('INTERVIEW', needed.INTERVIEW, {
    actions: ['review', 'shortlist'],
    interview: { flow: 'accept', daysAhead: 8, hour: 10 },
  });
  push('OFFERED', needed.OFFERED, {
    actions: ['review', 'shortlist'],
    interview: { flow: 'complete', daysAhead: 6, hour: 11 },
    offerAfterInterview: true,
  });
  push('REJECTED', needed.REJECTED, { actions: ['review', 'reject'] });
  return plan;
}

export async function upsertCourse(prisma, spec, counts, options = {}) {
  const skills = [];
  for (const label of spec.skillLabels) {
    skills.push(await requireSkill(prisma, [label]));
  }
  const existing = await prisma.learningContent.findUnique({ where: { slug: spec.slug } });
  let contentId = existing?.id;
  if (!existing) {
    const created = await prisma.learningContent.create({
      data: {
        slug: spec.slug,
        title: spec.title,
        description: spec.description,
        objectives: spec.objectives,
        category: spec.category,
        difficulty: spec.difficulty,
        estimatedMinutes: spec.estimatedMinutes,
        status: 'DRAFT',
      },
    });
    contentId = created.id;
    counts.coursesCreated += 1;
  }
  for (const skill of skills) {
    if (options.neverUpdateExisting) {
      const existingMap = await prisma.learningContentSkill.findUnique({
        where: { contentId_skillId: { contentId, skillId: skill.id } },
      });
      if (!existingMap) {
        await prisma.learningContentSkill.create({
          data: { contentId, skillId: skill.id, targetProficiency: spec.targetProficiency },
        });
      }
    } else {
      await prisma.learningContentSkill.upsert({
        where: { contentId_skillId: { contentId, skillId: skill.id } },
        create: { contentId, skillId: skill.id, targetProficiency: spec.targetProficiency },
        update: { targetProficiency: spec.targetProficiency },
      });
    }
  }
  for (const item of spec.lessons) {
    const lessonRow = await prisma.learningLesson.findUnique({
      where: { contentId_sortOrder: { contentId, sortOrder: item.sortOrder } },
    });
    if (!lessonRow) {
      await prisma.learningLesson.create({
        data: {
          contentId,
          title: item.title,
          body: item.body,
          sortOrder: item.sortOrder,
          estimatedMinutes: item.estimatedMinutes,
        },
      });
      counts.lessonsCreated += 1;
    }
  }
  const quiz = spec.quiz;
  let assessment = await prisma.learningAssessment.findFirst({
    where: { contentId, title: quiz.title },
  });
  if (!assessment) {
    assessment = await prisma.learningAssessment.create({
      data: { contentId, title: quiz.title, passingScore: quiz.passingScore },
    });
  }
  for (const question of quiz.questions) {
    const existingQuestion = await prisma.learningQuestion.findUnique({
      where: { assessmentId_sortOrder: { assessmentId: assessment.id, sortOrder: question.sortOrder } },
    });
    const payload = {
      prompt: question.prompt,
      options: question.options,
      correctOptionId: question.correctOptionId,
    };
    if (!existingQuestion) {
      await prisma.learningQuestion.create({
        data: { assessmentId: assessment.id, sortOrder: question.sortOrder, ...payload },
      });
    }
  }
  const current = await prisma.learningContent.findUnique({
    where: { id: contentId },
    include: { lessons: true },
  });
  if (current.status !== 'PUBLISHED' && current.lessons.length > 0) {
    await prisma.learningContent.update({
      where: { id: contentId },
      data: { status: 'PUBLISHED', publishedAt: current.publishedAt ?? new Date() },
    });
  }
  return contentId;
}

function wrongOptionId(question) {
  const options = Array.isArray(question.options) ? question.options : [];
  const wrong = options.find((option) => option.id !== question.correctOptionId);
  return wrong?.id || question.correctOptionId;
}

function answersFor(questions, passing) {
  return questions.map((question) => ({
    questionId: question.id,
    optionId: passing ? question.correctOptionId : wrongOptionId(question),
  }));
}

export async function ensureEnrolled(prisma, userId, contentId, counts) {
  try {
    await enrollInCourse(prisma, userId, contentId);
    counts.enrollmentsCreated += 1;
  } catch (error) {
    if (error instanceof LearningError && error.status === 409) {
      return;
    }
    throw error;
  }
}

export async function completeLessons(prisma, userId, lessons, limit, counts) {
  const slice = lessons.slice(0, limit);
  for (const lessonRow of slice) {
    const existing = await prisma.learningLessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: lessonRow.id } },
    });
    if (existing) {
      continue;
    }
    await completeOwnLesson(prisma, userId, lessonRow.id);
    counts.lessonsCompleted += 1;
  }
}

export async function ensureAttempts(prisma, userId, assessment, mode, counts) {
  if (!assessment) {
    return;
  }
  const existing = await prisma.learningAttempt.findMany({
    where: { userId, assessmentId: assessment.id },
  });
  const hasFail = existing.some((attempt) => attempt.passed === false);
  const hasPass = existing.some((attempt) => attempt.passed === true);
  if ((mode === 'fail' || mode === 'failThenPass') && !hasFail) {
    await submitOwnAttempt(prisma, userId, assessment.id, answersFor(assessment.questions, false));
    counts.attemptsFailed += 1;
  }
  if (mode === 'failThenPass' && !hasPass) {
    await submitOwnAttempt(prisma, userId, assessment.id, answersFor(assessment.questions, true));
    counts.attemptsPassed += 1;
  }
}

export async function collectPresentationDemoIntegrity(prisma) {
  const database = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const [
    companies,
    publishedJobs,
    candidates,
    hrAccounts,
    staffAccounts,
    applications,
    snapshots,
    interviews,
    offers,
    courses,
    lessons,
    enrolments,
    progress,
    attempts,
    completed,
    notifications,
    duplicateApps,
    duplicateEnrol,
    duplicateSkills,
    invalidJobSkills,
    invalidCourseSkills,
    missingSnapshots,
    interviewMismatches,
    statusGroups,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.job.count({ where: { status: 'PUBLISHED' } }),
    prisma.user.count({ where: { role: { in: ['STUDENT', 'JOB_SEEKER'] } } }),
    prisma.user.count({ where: { role: 'COMPANY_STAFF', jobTitle: { contains: 'Human Resources' } } }),
    prisma.user.count({ where: { role: 'COMPANY_STAFF' } }),
    prisma.application.count(),
    prisma.applicationResumeSnapshot.count(),
    prisma.interview.count(),
    prisma.application.count({ where: { status: 'OFFERED' } }),
    prisma.learningContent.count({ where: { status: 'PUBLISHED' } }),
    prisma.learningLesson.count(),
    prisma.learningEnrollment.count(),
    prisma.learningLessonProgress.count(),
    prisma.learningAttempt.count(),
    prisma.learningEnrollment.count({ where: { status: 'COMPLETED' } }),
    prisma.notification.count(),
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM applications GROUP BY job_id, applicant_user_id HAVING COUNT(*) > 1) d`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM learning_enrollments GROUP BY user_id, content_id HAVING COUNT(*) > 1) d`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM user_skills GROUP BY user_id, skill_id HAVING COUNT(*) > 1) d`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM job_skills js LEFT JOIN skills s ON s.id = js.skill_id WHERE s.id IS NULL OR s.source_system <> 'ESCO'`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM learning_content_skills lcs LEFT JOIN skills s ON s.id = lcs.skill_id WHERE s.id IS NULL OR s.source_system <> 'ESCO'`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM applications a LEFT JOIN application_resume_snapshots s ON s.application_id = a.id WHERE s.id IS NULL`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM interviews i JOIN applications a ON a.id = i.application_id WHERE i.candidate_user_id <> a.applicant_user_id OR i.job_id <> a.job_id`,
    prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const statuses = {};
  for (const row of statusGroups) {
    statuses[row.status] = row._count._all;
  }
  const generatedCompanies = await prisma.company.count({
    where: { registrationNumber: { in: PRESENTATION_REGISTRATIONS } },
  });
  return {
    database: database[0]?.name,
    totals: {
      companies,
      publishedJobs,
      candidates,
      hrAccounts,
      staffAccounts,
      applications,
      snapshots,
      interviews,
      offers,
      courses,
      lessons,
      enrolments,
      progress,
      attempts,
      completed,
      notifications,
      generatedCompanies,
    },
    statuses,
    duplicates: {
      applications: duplicateApps[0].n,
      enrolments: duplicateEnrol[0].n,
      userSkills: duplicateSkills[0].n,
    },
    orphans: {
      jobSkills: invalidJobSkills[0].n,
      courseSkills: invalidCourseSkills[0].n,
      missingSnapshots: missingSnapshots[0].n,
      interviewMismatches: interviewMismatches[0].n,
    },
    targets: DATASET_TARGETS,
  };
}

export async function seedPresentationDemoDataset(prisma) {
  await assertPeaceoneTestDatabase(prisma);
  const passwordHash = await hashPassword(resolveDemoPassword());
  const counts = emptyCounts();
  const conflicts = [];

  const companiesByKey = {};
  const hrByCompanyKey = {};
  for (const companySpec of PRESENTATION_COMPANIES) {
    const hrSpec = companySpec.staff.find((item) => item.isHr) || companySpec.staff[0];
    let hr = await ensureUser(
      prisma,
      { ...hrSpec, role: 'COMPANY_STAFF' },
      passwordHash,
      counts,
    );
    const company = await ensureCompany(prisma, companySpec, hr, counts, conflicts);
    companiesByKey[companySpec.key] = company;
    hr = await prisma.user.findUnique({ where: { id: hr.id } });
    await attachStaff(prisma, hr, company, counts);
    hrByCompanyKey[companySpec.key] = hr;
    for (const staffSpec of companySpec.staff.filter((item) => !item.isHr)) {
      const staff = await ensureUser(
        prisma,
        { ...staffSpec, role: 'COMPANY_STAFF' },
        passwordHash,
        counts,
      );
      await attachStaff(prisma, staff, company, counts);
    }
  }

  const jobs = [];
  for (const jobSpec of PRESENTATION_JOBS) {
    const company = companiesByKey[jobSpec.companyKey];
    const hr = hrByCompanyKey[jobSpec.companyKey];
    const job = await ensureJob(prisma, jobSpec, hr.id, company, counts);
    jobs.push({ ...job, companyKey: jobSpec.companyKey, hrId: hr.id, title: jobSpec.title });
  }

  const candidates = [];
  for (const spec of PRESENTATION_CANDIDATES) {
    const user = await ensureUser(prisma, spec, passwordHash, counts);
    await ensureUserSkills(prisma, user.id, spec.skillLabels, counts);
    await ensureCareerTarget(prisma, user, spec.occupationLabels, counts);
    const resume = await ensureResume(prisma, user, spec, counts);
    candidates.push({ ...user, resumeId: resume.id, email: spec.email });
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
  const neededInterviews = Math.max(0, DATASET_TARGETS.interviews - await prisma.interview.count());

  let pairCursor = 0;
  const pairs = [];
  for (const candidate of candidates) {
    for (const job of jobs) {
      const key = `${job.id}::${candidate.id}`;
      if (existingPairs.has(key)) {
        continue;
      }
      pairs.push({ candidate, job, key });
    }
  }

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

    let application = await prisma.application.findUnique({
      where: { jobId_applicantUserId: { jobId: pair.job.id, applicantUserId: pair.candidate.id } },
    });
    if (!application) {
      application = await submitOwnedApplication(
        prisma,
        pair.candidate.id,
        pair.job.id,
        pair.candidate.resumeId,
      );
      counts.applicationsCreated += 1;
    }
    application = await applyActions(prisma, application, pair.job.hrId, item.actions, counts, conflicts);

    if (item.interview) {
      const current = await prisma.application.findUnique({ where: { id: application.id } });
      if (['SHORTLISTED', 'INTERVIEW'].includes(current.status)) {
        await ensureInterview(
          prisma,
          { title: `${pair.job.title} demonstration interview`, ...item.interview },
          current,
          pair.job.hrId,
          pair.candidate.id,
          counts,
          conflicts,
        );
      }
    }
    if (item.offerAfterInterview) {
      const current = await prisma.application.findUnique({ where: { id: application.id } });
      await applyActions(prisma, current, pair.job.hrId, ['offer'], counts, conflicts);
    }
  }

  const interviewsNow = await prisma.interview.count();
  if (interviewsNow < DATASET_TARGETS.interviews) {
    conflicts.push(
      `Interview total is ${interviewsNow}; target is ${DATASET_TARGETS.interviews}. Extra SHORTLISTED conversions were not applied because they would change application status totals.`,
    );
  }

  for (const spec of PRESENTATION_COURSES) {
    await upsertCourse(prisma, spec, counts);
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
    where: { email: { in: PRESENTATION_CANDIDATES.map((item) => item.email) } },
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
  const neededEnrol = Math.max(0, DATASET_TARGETS.enrolments - currentEnrol);
  const completeCount = 50;
  const inProgressCount = 70;
  const enrolledOnly = Math.max(0, neededEnrol - completeCount - inProgressCount);

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
    if (slot.learner.email === PROTECTED_STUDENT && slot.course.slug === PROTECTED_SQL_SLUG) {
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
  if (attemptsNow < DATASET_TARGETS.assessmentAttempts) {
    const enrolledOnlySlots = take.filter((slot) => slot.mode === 'enrolled');
    for (const slot of enrolledOnlySlots) {
      if (attemptsNow >= DATASET_TARGETS.assessmentAttempts) {
        break;
      }
      const assessment = slot.course.assessments[0];
      await ensureAttempts(prisma, slot.learner.id, assessment, 'fail', counts);
      attemptsNow = await prisma.learningAttempt.count();
    }
  }

  const integrity = await collectPresentationDemoIntegrity(prisma);
  return {
    counts,
    conflicts,
    integrity,
    unusedEnrolmentSlots: Math.max(0, enrolledOnly),
    neededInterviews,
  };
}
