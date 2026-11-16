import { hashPassword } from './password.js';
import {
  LEARNING_DATASET_COURSES,
  LEARNING_DATASET_PROTECTED_SLUGS,
} from './learningDatasetCatalog.js';
import {
  LearningError,
  completeOwnLesson,
  enrollInCourse,
  submitOwnAttempt,
} from './learningQuery.js';

export const DATASET_STUDENT_EMAIL = 'student@peaceone.demo';
export const DATASET_GRADUATE_EMAIL = 'graduate@peaceone.demo';
const DEFAULT_LOCAL_PASSWORD = 'PeaceOneDemo1';

const PROGRESS_SLUGS = {
  studentComplete: 'peaceone-demo-sql-fundamentals',
  studentInProgress: 'peaceone-demo-javascript-programming-fundamentals',
  studentEnrolled: 'peaceone-demo-react-development-essentials',
  graduateInProgress: 'peaceone-demo-python-for-data-analysis',
};

export async function assertPeaceoneTestDatabase(prisma) {
  const rows = await prisma.$queryRaw`SELECT current_database()::text AS name`;
  const name = rows[0]?.name;
  if (name !== 'peaceone_test') {
    throw new Error(`Refusing learning dataset seed: current_database() is "${name}", expected peaceone_test.`);
  }
  return name;
}

async function findSkillByExactLabel(prisma, label) {
  return prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO', preferredLabel: { equals: label, mode: 'insensitive' } },
    select: { id: true, preferredLabel: true, sourceUri: true },
  });
}

export async function resolveCourseSkills(prisma, labels) {
  const found = [];
  const seen = new Set();
  const missing = [];
  for (const label of labels) {
    const skill = await findSkillByExactLabel(prisma, label);
    if (!skill) {
      missing.push(label);
      continue;
    }
    if (!seen.has(skill.id)) {
      seen.add(skill.id);
      found.push(skill);
    }
  }
  if (missing.length) {
    throw new Error(`No exact ESCO preferredLabel for: ${missing.join(', ')}`);
  }
  return found;
}

async function upsertCourse(prisma, spec, counts, mappings) {
  const skills = await resolveCourseSkills(prisma, spec.skillLabels);
  const existing = await prisma.learningContent.findUnique({
    where: { slug: spec.slug },
  });

  let contentId;
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
  } else {
    const protectedCourse = LEARNING_DATASET_PROTECTED_SLUGS.includes(spec.slug)
      && existing.status === 'PUBLISHED';
    await prisma.learningContent.update({
      where: { id: existing.id },
      data: protectedCourse
        ? {
            description: spec.description,
            objectives: spec.objectives,
            estimatedMinutes: spec.estimatedMinutes,
          }
        : {
            title: spec.title,
            description: spec.description,
            objectives: spec.objectives,
            category: spec.category,
            difficulty: spec.difficulty,
            estimatedMinutes: spec.estimatedMinutes,
          },
    });
    contentId = existing.id;
    counts.coursesUpdated += 1;
  }

  const skillIds = skills.map((skill) => skill.id);
  await prisma.learningContentSkill.deleteMany({
    where: { contentId, skillId: { notIn: skillIds } },
  });
  for (const skill of skills) {
    await prisma.learningContentSkill.upsert({
      where: { contentId_skillId: { contentId, skillId: skill.id } },
      create: {
        contentId,
        skillId: skill.id,
        targetProficiency: spec.targetProficiency,
      },
      update: { targetProficiency: spec.targetProficiency },
    });
    mappings.push({
      courseId: contentId,
      title: spec.title,
      skillId: skill.id,
      preferredLabel: skill.preferredLabel,
      sourceUri: skill.sourceUri,
      rationale: `${spec.title} teaches ${skill.preferredLabel} using original PeaceOne lesson text. Mapping uses the exact ESCO preferredLabel already stored in PostgreSQL (${skill.sourceUri}).`,
    });
  }

  const existingLessonOrders = await prisma.learningLesson.findMany({
    where: { contentId },
    select: { sortOrder: true },
  });
  const allowedOrders = new Set(spec.lessons.map((item) => item.sortOrder));
  if (!LEARNING_DATASET_PROTECTED_SLUGS.includes(spec.slug)) {
    const stale = existingLessonOrders.filter((item) => !allowedOrders.has(item.sortOrder));
    if (stale.length) {
      await prisma.learningLesson.deleteMany({
        where: { contentId, sortOrder: { in: stale.map((item) => item.sortOrder) } },
      });
    }
  }

  for (const item of spec.lessons) {
    const lesson = await prisma.learningLesson.findUnique({
      where: { contentId_sortOrder: { contentId, sortOrder: item.sortOrder } },
    });
    if (!lesson) {
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
    } else {
      await prisma.learningLesson.update({
        where: { id: lesson.id },
        data: {
          title: item.title,
          body: item.body,
          estimatedMinutes: item.estimatedMinutes,
        },
      });
      counts.lessonsUpdated += 1;
    }
  }

  const quiz = spec.quiz;
  let assessment = await prisma.learningAssessment.findFirst({
    where: { contentId, title: quiz.title },
  });
  if (!assessment) {
    assessment = await prisma.learningAssessment.create({
      data: {
        contentId,
        title: quiz.title,
        passingScore: quiz.passingScore,
      },
    });
    counts.assessmentsCreated += 1;
  } else {
    await prisma.learningAssessment.update({
      where: { id: assessment.id },
      data: { passingScore: quiz.passingScore },
    });
    counts.assessmentsUpdated += 1;
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
        data: {
          assessmentId: assessment.id,
          sortOrder: question.sortOrder,
          ...payload,
        },
      });
      counts.questionsCreated += 1;
    } else {
      await prisma.learningQuestion.update({
        where: { id: existingQuestion.id },
        data: payload,
      });
      counts.questionsUpdated += 1;
    }
  }

  const current = await prisma.learningContent.findUnique({
    where: { id: contentId },
    include: { lessons: true },
  });
  if (current.status !== 'ARCHIVED' && current.lessons.length > 0 && current.status !== 'PUBLISHED') {
    await prisma.learningContent.update({
      where: { id: contentId },
      data: { status: 'PUBLISHED', publishedAt: current.publishedAt ?? new Date() },
    });
    counts.coursesPublished += 1;
  } else if (current.status === 'PUBLISHED') {
    counts.coursesAlreadyPublished += 1;
  }
}

function demoPassword() {
  const fromEnv = process.env.DEMO_SEED_PASSWORD;
  if (fromEnv && fromEnv.length >= 8 && fromEnv.length <= 72) {
    return fromEnv;
  }
  return DEFAULT_LOCAL_PASSWORD;
}

async function ensureLearner(prisma, spec, counts) {
  const existing = await prisma.user.findUnique({ where: { email: spec.email } });
  if (existing) {
    counts.learnersExisting += 1;
    return existing;
  }
  const user = await prisma.user.create({
    data: {
      email: spec.email,
      passwordHash: await hashPassword(demoPassword()),
      fullName: spec.fullName,
      role: spec.role,
      termsAcceptedAt: new Date(),
    },
  });
  counts.learnersCreated += 1;
  return user;
}

async function ensureEnrolled(prisma, userId, contentId, counts) {
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

async function completeLessons(prisma, userId, lessons, counts) {
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

async function ensureFailThenPass(prisma, userId, assessment, counts) {
  if (!assessment) {
    throw new Error('Course has no assessment.');
  }
  const existing = await prisma.learningAttempt.findMany({
    where: { userId, assessmentId: assessment.id },
  });
  const hasFail = existing.some((attempt) => attempt.passed === false);
  const hasPass = existing.some((attempt) => attempt.passed === true);

  if (!hasFail && !hasPass) {
    await submitOwnAttempt(prisma, userId, assessment.id, answersFor(assessment.questions, false));
    counts.attemptsFailed += 1;
  } else {
    counts.attemptsFailedExisting += 1;
  }

  if (!hasPass) {
    await submitOwnAttempt(prisma, userId, assessment.id, answersFor(assessment.questions, true));
    counts.attemptsPassed += 1;
  } else {
    counts.attemptsPassedExisting += 1;
  }
}

async function requireCourse(prisma, slug) {
  const course = await prisma.learningContent.findUnique({
    where: { slug },
    include: {
      lessons: { orderBy: { sortOrder: 'asc' } },
      assessments: { include: { questions: { orderBy: { sortOrder: 'asc' } } } },
    },
  });
  if (!course || course.status !== 'PUBLISHED') {
    throw new Error(`Missing published dataset course ${slug}.`);
  }
  return course;
}

export async function seedLearningDataset(prisma, { includeDemoProgress = true } = {}) {
  await assertPeaceoneTestDatabase(prisma);
  if (await prisma.skill.count() === 0) {
    throw new Error('ESCO catalogue is empty. Import ESCO into peaceone_test before seeding courses.');
  }

  const counts = {
    coursesCreated: 0,
    coursesUpdated: 0,
    coursesPublished: 0,
    coursesAlreadyPublished: 0,
    lessonsCreated: 0,
    lessonsUpdated: 0,
    assessmentsCreated: 0,
    assessmentsUpdated: 0,
    questionsCreated: 0,
    questionsUpdated: 0,
    learnersCreated: 0,
    learnersExisting: 0,
    enrollmentsCreated: 0,
    enrollmentsExisting: 0,
    lessonsCompleted: 0,
    lessonsExisting: 0,
    attemptsFailed: 0,
    attemptsFailedExisting: 0,
    attemptsPassed: 0,
    attemptsPassedExisting: 0,
  };
  const mappings = [];

  for (const spec of LEARNING_DATASET_COURSES) {
    await upsertCourse(prisma, spec, counts, mappings);
  }

  if (includeDemoProgress) {
    const student = await ensureLearner(prisma, {
      email: DATASET_STUDENT_EMAIL,
      fullName: 'Aisyah Rahman',
      role: 'STUDENT',
    }, counts);
    const graduate = await ensureLearner(prisma, {
      email: DATASET_GRADUATE_EMAIL,
      fullName: 'Tan Wei Jie',
      role: 'JOB_SEEKER',
    }, counts);

    const completeCourse = await requireCourse(prisma, PROGRESS_SLUGS.studentComplete);
    const inProgressCourse = await requireCourse(prisma, PROGRESS_SLUGS.studentInProgress);
    const enrolledCourse = await requireCourse(prisma, PROGRESS_SLUGS.studentEnrolled);
    const graduateCourse = await requireCourse(prisma, PROGRESS_SLUGS.graduateInProgress);

    await ensureEnrolled(prisma, student.id, completeCourse.id, counts);
    await completeLessons(prisma, student.id, completeCourse.lessons, counts);
    await ensureFailThenPass(prisma, student.id, completeCourse.assessments[0], counts);

    await ensureEnrolled(prisma, student.id, inProgressCourse.id, counts);
    await completeLessons(prisma, student.id, inProgressCourse.lessons.slice(0, 2), counts);

    await ensureEnrolled(prisma, student.id, enrolledCourse.id, counts);

    await ensureEnrolled(prisma, graduate.id, graduateCourse.id, counts);
    await completeLessons(prisma, graduate.id, graduateCourse.lessons.slice(0, 2), counts);
  }

  const totals = {
    courses: await prisma.learningContent.count({ where: { slug: { startsWith: 'peaceone-demo-' } } }),
    lessons: await prisma.learningLesson.count({ where: { content: { slug: { startsWith: 'peaceone-demo-' } } } }),
    assessments: await prisma.learningAssessment.count({ where: { content: { slug: { startsWith: 'peaceone-demo-' } } } }),
    questions: await prisma.learningQuestion.count({ where: { assessment: { content: { slug: { startsWith: 'peaceone-demo-' } } } } }),
    courseSkills: await prisma.learningContentSkill.count({ where: { content: { slug: { startsWith: 'peaceone-demo-' } } } }),
  };

  return { counts, mappings, totals };
}
