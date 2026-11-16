import { disconnectDatabase, prisma } from '../src/db.js';
import { config } from '../src/config.js';
import { DEMO_LEARNING_COURSES } from '../src/lib/demoLearningCatalog.js';

function localHosts() {
  return new Set(['localhost', '127.0.0.1', '::1']);
}

function assertSafeDatabaseTarget(databaseUrl, nodeEnv) {
  if (String(nodeEnv).toLowerCase() === 'production') {
    throw new Error('Refusing to seed learning data: NODE_ENV is production.');
  }
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('Refusing to seed learning data: DATABASE_URL is not a valid URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Refusing to seed learning data: DATABASE_URL must use postgresql.');
  }
  const host = parsed.hostname.toLowerCase();
  if (!localHosts().has(host)) {
    throw new Error(`Refusing to seed learning data: host "${host}" is not local.`);
  }
}

async function findSkillByExactLabel(label) {
  return prisma.skill.findFirst({
    where: { sourceSystem: 'ESCO', preferredLabel: { equals: label, mode: 'insensitive' } },
    select: { id: true, preferredLabel: true, sourceUri: true },
  });
}

async function resolveSkills(labels) {
  const found = [];
  const seen = new Set();
  const missing = [];
  for (const label of labels) {
    const skill = await findSkillByExactLabel(label);
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
  if (!found.length) {
    throw new Error('Course skill list is empty.');
  }
  return found;
}

async function upsertCourse(spec, counts) {
  const skills = await resolveSkills(spec.skillLabels);
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
    await prisma.learningContent.update({
      where: { id: existing.id },
      data: {
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
    where: {
      contentId,
      skillId: { notIn: skillIds },
    },
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
    if (!existingQuestion) {
      await prisma.learningQuestion.create({
        data: {
          assessmentId: assessment.id,
          prompt: question.prompt,
          options: question.options,
          correctOptionId: question.correctOptionId,
          sortOrder: question.sortOrder,
        },
      });
      counts.questionsCreated += 1;
    } else {
      await prisma.learningQuestion.update({
        where: { id: existingQuestion.id },
        data: {
          prompt: question.prompt,
          options: question.options,
          correctOptionId: question.correctOptionId,
        },
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

async function snapshotRecruitment() {
  const [users, applications, interviews, notifications] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: [
        'admin@peaceone.demo',
        'hr@techcorp.demo',
        'staff@techcorp.demo',
        'student@peaceone.demo',
        'graduate@peaceone.demo',
      ] } },
      select: { email: true, role: true, companyId: true },
    }),
    prisma.application.count(),
    prisma.interview.count(),
    prisma.notification.count(),
  ]);
  return { users, applications, interviews, notifications };
}

async function run() {
  assertSafeDatabaseTarget(config.databaseUrl, config.nodeEnv);
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
  };

  console.log(`Seeding PeaceOne demonstration courses into ${config.databaseUrl.replace(/:[^:@/]+@/, ':***@')}`);
  const before = await snapshotRecruitment();

  try {
    if (await prisma.skill.count() === 0) {
      throw new Error('ESCO catalogue is empty. Import ESCO before seeding courses.');
    }
    for (const spec of DEMO_LEARNING_COURSES) {
      await upsertCourse(spec, counts);
    }
    const after = await snapshotRecruitment();
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error('Learning seed modified demonstration recruitment records.');
    }

    const courseCount = await prisma.learningContent.count({
      where: { slug: { startsWith: 'peaceone-demo-' } },
    });
    const lessonCount = await prisma.learningLesson.count({
      where: { content: { slug: { startsWith: 'peaceone-demo-' } } },
    });
    const assessmentCount = await prisma.learningAssessment.count({
      where: { content: { slug: { startsWith: 'peaceone-demo-' } } },
    });

    console.log('\nSeed counts');
    for (const [key, value] of Object.entries(counts)) {
      console.log(`  ${key}: ${value}`);
    }
    console.log(`\nTotals: ${courseCount} courses, ${lessonCount} lessons, ${assessmentCount} assessments`);
    console.log('Student progress rows were not deleted.');
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
