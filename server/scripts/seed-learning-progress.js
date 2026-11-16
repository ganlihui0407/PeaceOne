import { disconnectDatabase, prisma } from '../src/db.js';
import { config } from '../src/config.js';
import {
  LearningError,
  completeOwnLesson,
  enrollInCourse,
  submitOwnAttempt,
} from '../src/lib/learningQuery.js';

const STUDENT_EMAIL = 'student@peaceone.demo';
const GRADUATE_EMAIL = 'graduate@peaceone.demo';

const SLUGS = {
  studentComplete: 'peaceone-demo-sql-fundamentals',
  studentInProgress: 'peaceone-demo-javascript-programming-fundamentals',
  studentEnrolled: 'peaceone-demo-react-development-essentials',
  graduateInProgress: 'peaceone-demo-python-for-data-analysis',
};

function localHosts() {
  return new Set(['localhost', '127.0.0.1', '::1']);
}

function assertSafeDatabaseTarget(databaseUrl, nodeEnv) {
  if (String(nodeEnv).toLowerCase() === 'production') {
    throw new Error('Refusing to seed learning progress: NODE_ENV is production.');
  }
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('Refusing to seed learning progress: DATABASE_URL is not a valid URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Refusing to seed learning progress: DATABASE_URL must use postgresql.');
  }
  const host = parsed.hostname.toLowerCase();
  if (!localHosts().has(host)) {
    throw new Error(`Refusing to seed learning progress: host "${host}" is not local.`);
  }
}

async function requireUser(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    throw new Error(`Missing demonstration account ${email}. Run db:seed:demo first.`);
  }
  return user;
}

async function requireCourse(slug) {
  const course = await prisma.learningContent.findUnique({
    where: { slug },
    include: {
      lessons: { orderBy: { sortOrder: 'asc' } },
      assessments: {
        include: { questions: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });
  if (!course || course.status !== 'PUBLISHED') {
    throw new Error(`Missing published demonstration course ${slug}. Run db:seed:learning first.`);
  }
  return course;
}

async function ensureEnrolled(userId, contentId, counts) {
  try {
    await enrollInCourse(prisma, userId, contentId);
    counts.enrollmentsCreated += 1;
  } catch (error) {
    if (error instanceof LearningError && error.status === 409) {
      counts.enrollmentsExisting += 1;
      return;
    }
    throw error;
  }
}

async function completeLessons(userId, lessons, counts) {
  for (const lesson of lessons) {
    const existing = await prisma.learningLessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
    });
    if (existing) {
      counts.lessonsExisting += 1;
      continue;
    }
    await completeOwnLesson(prisma, userId, lesson.id);
    counts.lessonsCompleted += 1;
  }
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

async function ensureFailThenPass(userId, assessment, counts) {
  if (!assessment) {
    throw new Error('Course has no assessment.');
  }
  const existing = await prisma.learningAttempt.findMany({
    where: { userId, assessmentId: assessment.id },
    orderBy: { createdAt: 'asc' },
  });
  const hasFail = existing.some((attempt) => attempt.passed === false);
  const hasPass = existing.some((attempt) => attempt.passed === true);

  if (!hasFail && !hasPass) {
    await submitOwnAttempt(prisma, userId, assessment.id, answersFor(assessment.questions, false));
    counts.attemptsFailed += 1;
  } else if (hasFail) {
    counts.attemptsFailedExisting += 1;
  }

  if (!hasPass) {
    await submitOwnAttempt(prisma, userId, assessment.id, answersFor(assessment.questions, true));
    counts.attemptsPassed += 1;
  } else {
    counts.attemptsPassedExisting += 1;
  }
}

async function snapshotRecruitment() {
  const [users, applications, interviews] = await Promise.all([
    prisma.user.findMany({
      where: {
        email: {
          in: [
            'admin@peaceone.demo',
            'hr@techcorp.demo',
            'staff@techcorp.demo',
            STUDENT_EMAIL,
            GRADUATE_EMAIL,
          ],
        },
      },
      select: { email: true, role: true, companyId: true, passwordHash: true },
    }),
    prisma.application.findMany({
      select: { id: true, status: true, applicantUserId: true, jobId: true },
      orderBy: { id: 'asc' },
    }),
    prisma.interview.findMany({
      select: { id: true, status: true, applicationId: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  return { users, applications, interviews };
}

async function run() {
  assertSafeDatabaseTarget(config.databaseUrl, config.nodeEnv);
  const counts = {
    enrollmentsCreated: 0,
    enrollmentsExisting: 0,
    lessonsCompleted: 0,
    lessonsExisting: 0,
    attemptsFailed: 0,
    attemptsFailedExisting: 0,
    attemptsPassed: 0,
    attemptsPassedExisting: 0,
  };

  console.log(`Seeding PeaceOne demonstration learning progress into ${config.databaseUrl.replace(/:[^:@/]+@/, ':***@')}`);
  const before = await snapshotRecruitment();

  const student = await requireUser(STUDENT_EMAIL);
  const graduate = await requireUser(GRADUATE_EMAIL);
  const completeCourse = await requireCourse(SLUGS.studentComplete);
  const inProgressCourse = await requireCourse(SLUGS.studentInProgress);
  const enrolledCourse = await requireCourse(SLUGS.studentEnrolled);
  const graduateCourse = await requireCourse(SLUGS.graduateInProgress);

  await ensureEnrolled(student.id, completeCourse.id, counts);
  await completeLessons(student.id, completeCourse.lessons, counts);
  await ensureFailThenPass(student.id, completeCourse.assessments[0], counts);

  await ensureEnrolled(student.id, inProgressCourse.id, counts);
  await completeLessons(student.id, inProgressCourse.lessons.slice(0, 2), counts);

  await ensureEnrolled(student.id, enrolledCourse.id, counts);

  await ensureEnrolled(graduate.id, graduateCourse.id, counts);
  await completeLessons(graduate.id, graduateCourse.lessons.slice(0, 2), counts);

  const after = await snapshotRecruitment();
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error('Learning progress seed modified demonstration accounts or recruitment records.');
  }

  const studentEnrollments = await prisma.learningEnrollment.findMany({
    where: { userId: student.id },
    include: { content: { select: { slug: true, title: true } } },
    orderBy: { enrolledAt: 'asc' },
  });
  const graduateEnrollments = await prisma.learningEnrollment.findMany({
    where: { userId: graduate.id },
    include: { content: { select: { slug: true, title: true } } },
  });

  console.log('\nSeed counts');
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nStudent enrolments');
  for (const row of studentEnrollments) {
    console.log(`  ${row.content.title}: ${row.status}`);
  }
  console.log('Graduate enrolments');
  for (const row of graduateEnrollments) {
    console.log(`  ${row.content.title}: ${row.status}`);
  }
}

run()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
