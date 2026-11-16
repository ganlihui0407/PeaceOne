import { z } from 'zod';
import { normalizeLabelSearch, paginationMeta, serializeSkillSummary } from './escoQuery.js';
import { USER_SKILL_PROFICIENCY_LEVELS } from './userSkillQuery.js';
import { notifyLearningCourseCompleted } from './notificationQuery.js';
import {
  SKILL_GAP_RELATION_LIMIT,
  skillGapOccupationSelect,
  skillGapRelationOrder,
  skillGapRelationSelect,
  skillGapUserSkillSelect,
  serializeSkillGap,
} from './skillGapQuery.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const LEARNING_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
export const LEARNING_DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
export const LEARNING_ENROLLMENT_STATUSES = ['ENROLLED', 'IN_PROGRESS', 'COMPLETED'];
export const LEARNING_CATEGORIES = [
  'DATA_ANALYTICS',
  'SOFTWARE_DEVELOPMENT',
  'DIGITAL_MARKETING',
  'UI_UX_DESIGN',
  'CYBERSECURITY',
];

export const LEARNING_ALREADY_ENROLLED = 'You are already enrolled in this course';
export const LEARNING_NOT_PUBLISHED = 'Course is not available';
export const LEARNING_NOT_ENROLLED = 'Enrolment required';
export const LEARNING_CANNOT_BE_DELETED = 'Course cannot be deleted while enrolments exist';
export const LEARNING_ASSESSMENT_INCOMPLETE = 'Answer every question';
export const LEARNING_SKILL_NOT_READY = 'Course requirements are not complete';

const PROFICIENCY_RANK = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
};

const FIELD_LIMITS = {
  title: 150,
  description: 5000,
  body: 12000,
  slug: 80,
  category: 80,
  objective: 300,
  thumbnailUrl: 500,
  prompt: 1000,
  option: 300,
};

export class LearningError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'LearningError';
    this.status = status;
  }
}

function singleQueryValue(value) {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  }
  return String(value);
}

function emptyToNull(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const pageQuery = z.preprocess((value) => {
  const normalized = singleQueryValue(value);
  return normalized === undefined ? '1' : normalized;
}, z.string().regex(/^[1-9]\d{0,6}$/).transform((value) => Number.parseInt(value, 10)));

const limitQuery = z.preprocess((value) => {
  const normalized = singleQueryValue(value);
  return normalized === undefined ? '20' : normalized;
}, z.string().regex(/^[1-9]\d{0,2}$/).transform((value) => Number.parseInt(value, 10)).refine((value) => value <= 50));

export const learningIdParamsSchema = z.object({
  id: z.string().regex(UUID_RE),
});

export const publishedCourseListQuerySchema = z.object({
  q: z.preprocess(singleQueryValue, z.string().max(200).optional()),
  category: z.preprocess(singleQueryValue, z.enum(LEARNING_CATEGORIES).optional()),
  difficulty: z.preprocess(singleQueryValue, z.enum(LEARNING_DIFFICULTIES).optional()),
  skillId: z.preprocess(singleQueryValue, z.string().regex(UUID_RE).optional()),
  page: pageQuery,
  limit: limitQuery,
});

export const adminCourseListQuerySchema = z.object({
  q: z.preprocess(singleQueryValue, z.string().max(200).optional()),
  category: z.preprocess(singleQueryValue, z.enum(LEARNING_CATEGORIES).optional()),
  difficulty: z.preprocess(singleQueryValue, z.enum(LEARNING_DIFFICULTIES).optional()),
  status: z.preprocess(singleQueryValue, z.enum(LEARNING_STATUSES).optional()),
  page: pageQuery,
  limit: limitQuery,
});

const skillLinkSchema = z.object({
  skillId: z.string().regex(UUID_RE),
  targetProficiency: z.enum(USER_SKILL_PROFICIENCY_LEVELS),
}).strict();

export const createCourseBodySchema = z.object({
  slug: z.string().trim().min(1).max(FIELD_LIMITS.slug).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(FIELD_LIMITS.title),
  description: z.string().trim().min(1).max(FIELD_LIMITS.description),
  objectives: z.array(z.string().trim().min(1).max(FIELD_LIMITS.objective)).min(1).max(8),
  category: z.enum(LEARNING_CATEGORIES),
  difficulty: z.enum(LEARNING_DIFFICULTIES),
  estimatedMinutes: z.number().int().min(15).max(2400),
  thumbnailUrl: z.preprocess(emptyToNull, z.union([z.string().trim().max(FIELD_LIMITS.thumbnailUrl), z.null()]).optional()),
  skills: z.array(skillLinkSchema).max(12).optional().default([]),
}).strict();

export const updateCourseBodySchema = z.object({
  title: z.string().trim().min(1).max(FIELD_LIMITS.title).optional(),
  description: z.string().trim().min(1).max(FIELD_LIMITS.description).optional(),
  objectives: z.array(z.string().trim().min(1).max(FIELD_LIMITS.objective)).min(1).max(8).optional(),
  category: z.enum(LEARNING_CATEGORIES).optional(),
  difficulty: z.enum(LEARNING_DIFFICULTIES).optional(),
  estimatedMinutes: z.number().int().min(15).max(2400).optional(),
  thumbnailUrl: z.preprocess(emptyToNull, z.union([z.string().trim().max(FIELD_LIMITS.thumbnailUrl), z.null()]).optional()),
  skills: z.array(skillLinkSchema).max(12).optional(),
}).strict();

export const createLessonBodySchema = z.object({
  title: z.string().trim().min(1).max(FIELD_LIMITS.title),
  body: z.string().trim().min(1).max(FIELD_LIMITS.body),
  sortOrder: z.number().int().min(1).max(50),
  estimatedMinutes: z.number().int().min(5).max(240),
}).strict();

export const updateLessonBodySchema = createLessonBodySchema.partial().strict();

export const enrollBodySchema = z.object({
  contentId: z.string().regex(UUID_RE),
}).strict();

export const emptyLearningBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z.object({}).strict(),
);

export const assessmentAttemptBodySchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().regex(UUID_RE),
    optionId: z.string().trim().min(1).max(80),
  }).strict()).min(1).max(20),
}).strict();

const questionOptionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(FIELD_LIMITS.option),
}).strict();

export const createAssessmentBodySchema = z.object({
  title: z.string().trim().min(1).max(FIELD_LIMITS.title),
  passingScore: z.number().int().min(1).max(100),
  lessonId: z.preprocess(emptyToNull, z.union([z.string().regex(UUID_RE), z.null()]).optional()),
  questions: z.array(z.object({
    prompt: z.string().trim().min(1).max(FIELD_LIMITS.prompt),
    options: z.array(questionOptionSchema).min(2).max(6),
    correctOptionId: z.string().trim().min(1).max(80),
    sortOrder: z.number().int().min(1).max(20),
  }).strict().superRefine((question, ctx) => {
    if (!question.options.some((option) => option.id === question.correctOptionId)) {
      ctx.addIssue({ code: 'custom', message: 'Invalid request' });
    }
  })).min(1).max(10),
}).strict();

export const updateAssessmentBodySchema = createAssessmentBodySchema;

function iso(value) {
  return value ? value.toISOString() : null;
}

function asObjectives(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

export function publicQuestionOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }
  return options.map((option) => ({
    id: option.id,
    text: option.text,
  }));
}

function explanationForOption(options, optionId) {
  if (!Array.isArray(options) || !optionId) {
    return null;
  }
  const match = options.find((option) => option.id === optionId);
  return typeof match?.explanation === 'string' && match.explanation.trim()
    ? match.explanation.trim()
    : null;
}

export function progressPercent(completedLessons, totalLessons) {
  if (!totalLessons) {
    return 0;
  }
  return Math.floor((completedLessons / totalLessons) * 100);
}

function serializeLinkedSkill(record) {
  return {
    skillId: record.skillId,
    targetProficiency: record.targetProficiency,
    skill: serializeSkillSummary(record.skill),
  };
}

export function serializeCourseSummary(record, extras = {}) {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    objectives: asObjectives(record.objectives),
    category: record.category,
    difficulty: record.difficulty,
    estimatedMinutes: record.estimatedMinutes,
    thumbnailUrl: record.thumbnailUrl ?? null,
    status: record.status,
    publishedAt: iso(record.publishedAt),
    lessonCount: record._count?.lessons ?? record.lessons?.length ?? 0,
    skills: (record.skills ?? []).map(serializeLinkedSkill),
    ...extras,
  };
}

function serializeLessonSummary(lesson, completedLessonIds) {
  return {
    id: lesson.id,
    title: lesson.title,
    sortOrder: lesson.sortOrder,
    estimatedMinutes: lesson.estimatedMinutes,
    completed: completedLessonIds ? completedLessonIds.has(lesson.id) : undefined,
  };
}

function serializeAssessmentPublic(assessment, attempts = []) {
  const best = attempts.reduce((current, attempt) => {
    if (!current || attempt.score > current.score) {
      return attempt;
    }
    return current;
  }, null);
  return {
    id: assessment.id,
    title: assessment.title,
    passingScore: assessment.passingScore,
    questionCount: assessment.questions?.length ?? assessment._count?.questions ?? 0,
    passed: Boolean(attempts.some((attempt) => attempt.passed)),
    latestScore: attempts[0] ? attempts[0].score : null,
    bestScore: best ? best.score : null,
  };
}

async function assertEscoSkills(client, skills) {
  if (!skills?.length) {
    return;
  }
  const ids = [...new Set(skills.map((item) => item.skillId))];
  const found = await client.skill.findMany({
    where: { id: { in: ids }, sourceSystem: 'ESCO' },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw new LearningError(400, 'Invalid request');
  }
}

async function replaceCourseSkills(tx, contentId, skills) {
  await assertEscoSkills(tx, skills);
  await tx.learningContentSkill.deleteMany({ where: { contentId } });
  if (!skills.length) {
    return;
  }
  await tx.learningContentSkill.createMany({
    data: skills.map((item) => ({
      contentId,
      skillId: item.skillId,
      targetProficiency: item.targetProficiency,
    })),
  });
}

const courseListInclude = {
  skills: { include: { skill: true } },
  _count: { select: { lessons: true, enrollments: true } },
};

const courseDetailInclude = {
  skills: { include: { skill: true } },
  lessons: { orderBy: { sortOrder: 'asc' } },
  assessments: {
    include: {
      questions: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { questions: true } },
    },
  },
  _count: { select: { lessons: true, enrollments: true } },
};

export async function listPublishedCourses(client, query, userId) {
  const search = normalizeLabelSearch(query.q);
  const where = {
    status: 'PUBLISHED',
    ...(query.category ? { category: query.category } : {}),
    ...(query.difficulty ? { difficulty: query.difficulty } : {}),
    ...(query.skillId ? { skills: { some: { skillId: query.skillId } } } : {}),
    ...(search
      ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }
      : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [total, records] = await Promise.all([
    client.learningContent.count({ where }),
    client.learningContent.findMany({
      where,
      include: courseListInclude,
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      skip,
      take: query.limit,
    }),
  ]);

  const ids = records.map((item) => item.id);
  let enrollmentMeta = new Map();
  if (userId && ids.length) {
    const [enrollments, progressRows] = await Promise.all([
      client.learningEnrollment.findMany({
        where: { userId, contentId: { in: ids } },
        select: { contentId: true, status: true },
      }),
      client.learningLessonProgress.groupBy({
        by: ['contentId'],
        where: { userId, contentId: { in: ids } },
        _count: { _all: true },
      }),
    ]);
    const completedByContent = new Map(progressRows.map((row) => [row.contentId, row._count._all]));
    enrollmentMeta = new Map(enrollments.map((item) => [item.contentId, {
      enrollmentStatus: item.status,
      completedLessonCount: completedByContent.get(item.contentId) ?? 0,
    }]));
  }

  return {
    courses: records.map((record) => {
      const meta = enrollmentMeta.get(record.id);
      const lessonCount = record._count?.lessons ?? 0;
      return serializeCourseSummary(record, meta
        ? {
          enrollmentStatus: meta.enrollmentStatus,
          completedLessonCount: meta.completedLessonCount,
          progressPercent: progressPercent(meta.completedLessonCount, lessonCount),
        }
        : {
          enrollmentStatus: null,
          completedLessonCount: null,
          progressPercent: null,
        });
    }),
    ...paginationMeta(query.page, query.limit, total),
  };
}

export async function findPublishedCourse(client, contentId, userId) {
  const record = await client.learningContent.findFirst({
    where: { id: contentId, status: 'PUBLISHED' },
    include: courseDetailInclude,
  });
  if (!record) {
    throw new LearningError(404, 'Not found');
  }
  let enrollment = null;
  let completedLessonIds = new Set();
  let attemptsByAssessment = new Map();
  if (userId) {
    enrollment = await client.learningEnrollment.findUnique({
      where: { userId_contentId: { userId, contentId } },
    });
    if (enrollment) {
      const progress = await client.learningLessonProgress.findMany({
        where: { userId, contentId },
        select: { lessonId: true },
      });
      completedLessonIds = new Set(progress.map((item) => item.lessonId));
      const attempts = await client.learningAttempt.findMany({
        where: { userId, assessmentId: { in: record.assessments.map((item) => item.id) } },
        orderBy: { createdAt: 'desc' },
      });
      for (const attempt of attempts) {
        const list = attemptsByAssessment.get(attempt.assessmentId) ?? [];
        list.push(attempt);
        attemptsByAssessment.set(attempt.assessmentId, list);
      }
    }
  }

  const completedCount = record.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
  return {
    course: serializeCourseSummary(record, {
      enrollmentStatus: enrollment?.status ?? null,
      enrolledAt: iso(enrollment?.enrolledAt),
      completedAt: iso(enrollment?.completedAt),
      progressPercent: enrollment ? progressPercent(completedCount, record.lessons.length) : null,
      completedLessonCount: enrollment ? completedCount : null,
    }),
    lessons: record.lessons.map((lesson) => serializeLessonSummary(lesson, enrollment ? completedLessonIds : null)),
    assessments: record.assessments.map((assessment) => (
      enrollment
        ? serializeAssessmentPublic(assessment, attemptsByAssessment.get(assessment.id) ?? [])
        : {
          id: assessment.id,
          title: assessment.title,
          passingScore: assessment.passingScore,
          questionCount: assessment.questions?.length ?? assessment._count?.questions ?? 0,
        }
    )),
  };
}

export async function enrollInCourse(client, userId, contentId) {
  const course = await client.learningContent.findFirst({
    where: { id: contentId, status: 'PUBLISHED' },
    select: { id: true },
  });
  if (!course) {
    throw new LearningError(404, LEARNING_NOT_PUBLISHED);
  }

  const existing = await client.learningEnrollment.findUnique({
    where: { userId_contentId: { userId, contentId } },
  });
  if (existing) {
    throw new LearningError(409, LEARNING_ALREADY_ENROLLED);
  }

  try {
    const enrollment = await client.learningEnrollment.create({
      data: { userId, contentId },
    });
    return { enrollment: serializeEnrollment(enrollment) };
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new LearningError(409, LEARNING_ALREADY_ENROLLED);
    }
    throw error;
  }
}

function serializeEnrollment(record, extras = {}) {
  return {
    id: record.id,
    contentId: record.contentId,
    status: record.status,
    enrolledAt: iso(record.enrolledAt),
    completedAt: iso(record.completedAt),
    skillsAwardedAt: iso(record.skillsAwardedAt),
    ...extras,
  };
}

export async function listOwnEnrollments(client, userId) {
  const records = await client.learningEnrollment.findMany({
    where: { userId },
    include: {
      content: {
        include: {
          skills: { include: { skill: true } },
          _count: { select: { lessons: true } },
        },
      },
    },
    orderBy: [{ enrolledAt: 'desc' }],
  });

  const progressRows = await client.learningLessonProgress.groupBy({
    by: ['contentId'],
    where: { userId },
    _count: { _all: true },
  });
  const completedByContent = new Map(progressRows.map((row) => [row.contentId, row._count._all]));

  return {
    enrollments: records.map((record) => {
      const totalLessons = record.content._count.lessons;
      const completedLessons = completedByContent.get(record.contentId) ?? 0;
      return serializeEnrollment(record, {
        progressPercent: progressPercent(completedLessons, totalLessons),
        completedLessonCount: completedLessons,
        lessonCount: totalLessons,
        course: serializeCourseSummary(record.content),
      });
    }),
  };
}

export async function findOwnLesson(client, userId, lessonId) {
  const lesson = await client.learningLesson.findUnique({
    where: { id: lessonId },
    include: {
      content: { select: { id: true, status: true, title: true } },
    },
  });
  if (!lesson || (lesson.content.status !== 'PUBLISHED' && lesson.content.status !== 'ARCHIVED')) {
    throw new LearningError(404, 'Not found');
  }
  const enrollment = await client.learningEnrollment.findUnique({
    where: { userId_contentId: { userId, contentId: lesson.contentId } },
  });
  if (!enrollment) {
    throw new LearningError(403, LEARNING_NOT_ENROLLED);
  }
  const progress = await client.learningLessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });
  return {
    lesson: {
      id: lesson.id,
      contentId: lesson.contentId,
      title: lesson.title,
      body: lesson.body,
      sortOrder: lesson.sortOrder,
      estimatedMinutes: lesson.estimatedMinutes,
      completed: Boolean(progress),
      completedAt: iso(progress?.completedAt),
      courseTitle: lesson.content.title,
    },
  };
}

async function loadCompletionState(tx, userId, contentId) {
  const [lessons, assessments, completed, enrollment] = await Promise.all([
    tx.learningLesson.findMany({ where: { contentId }, select: { id: true } }),
    tx.learningAssessment.findMany({
      where: { contentId },
      select: { id: true },
    }),
    tx.learningLessonProgress.findMany({
      where: { userId, contentId },
      select: { lessonId: true },
    }),
    tx.learningEnrollment.findUnique({
      where: { userId_contentId: { userId, contentId } },
    }),
  ]);
  const completedIds = new Set(completed.map((item) => item.lessonId));
  const allLessonsDone = lessons.length > 0 && lessons.every((lesson) => completedIds.has(lesson.id));
  let assessmentsPassed = true;
  if (assessments.length) {
    const attempts = await tx.learningAttempt.findMany({
      where: {
        userId,
        assessmentId: { in: assessments.map((item) => item.id) },
        passed: true,
      },
      select: { assessmentId: true },
    });
    const passedIds = new Set(attempts.map((item) => item.assessmentId));
    assessmentsPassed = assessments.every((item) => passedIds.has(item.id));
  }
  return {
    enrollment,
    allLessonsDone,
    assessmentsPassed,
    ready: allLessonsDone && assessmentsPassed,
  };
}

function nextProficiency(existing, target) {
  if (!existing) {
    return target === 'Advanced' ? 'Intermediate' : target;
  }
  const existingRank = PROFICIENCY_RANK[existing] ?? 0;
  const awarded = target === 'Advanced' ? 'Intermediate' : target;
  const awardedRank = PROFICIENCY_RANK[awarded] ?? 0;
  return awardedRank > existingRank ? awarded : existing;
}

async function maybeCompleteEnrollment(tx, userId, contentId) {
  const state = await loadCompletionState(tx, userId, contentId);
  if (!state.enrollment) {
    throw new LearningError(403, LEARNING_NOT_ENROLLED);
  }
  if (!state.ready) {
    if (state.enrollment.status === 'ENROLLED') {
      const completedCount = await tx.learningLessonProgress.count({ where: { userId, contentId } });
      if (completedCount > 0 && state.enrollment.status === 'ENROLLED') {
        await tx.learningEnrollment.update({
          where: { id: state.enrollment.id },
          data: { status: 'IN_PROGRESS' },
        });
      }
    }
    return { completed: false, skillsAwarded: false };
  }

  const now = new Date();
  if (state.enrollment.status !== 'COMPLETED') {
    await tx.learningEnrollment.update({
      where: { id: state.enrollment.id },
      data: { status: 'COMPLETED', completedAt: state.enrollment.completedAt ?? now },
    });
  }

  if (state.enrollment.skillsAwardedAt) {
    return { completed: true, skillsAwarded: false };
  }

  const links = await tx.learningContentSkill.findMany({
    where: { contentId },
  });
  for (const link of links) {
    const existing = await tx.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId: link.skillId } },
    });
    const proficiency = nextProficiency(existing?.proficiencyLevel, link.targetProficiency);
    if (!existing) {
      await tx.userSkill.create({
        data: {
          userId,
          skillId: link.skillId,
          proficiencyLevel: proficiency,
        },
      });
    } else if (proficiency !== existing.proficiencyLevel) {
      await tx.userSkill.update({
        where: { id: existing.id },
        data: { proficiencyLevel: proficiency },
      });
    }
  }

  await tx.learningEnrollment.update({
    where: { id: state.enrollment.id },
    data: { skillsAwardedAt: now, status: 'COMPLETED', completedAt: state.enrollment.completedAt ?? now },
  });
  await notifyLearningCourseCompleted(tx, {
    enrollmentId: state.enrollment.id,
    userId,
    contentId,
  });
  return { completed: true, skillsAwarded: true };
}

export async function completeOwnLesson(client, userId, lessonId) {
  return client.$transaction(async (tx) => {
    const lesson = await tx.learningLesson.findUnique({
      where: { id: lessonId },
      include: { content: { select: { id: true, status: true } } },
    });
    if (!lesson || lesson.content.status === 'DRAFT') {
      throw new LearningError(404, 'Not found');
    }
    const enrollment = await tx.learningEnrollment.findUnique({
      where: { userId_contentId: { userId, contentId: lesson.contentId } },
    });
    if (!enrollment) {
      throw new LearningError(403, LEARNING_NOT_ENROLLED);
    }

    await tx.learningLessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        contentId: lesson.contentId,
        lessonId,
      },
      update: {},
    });

    const completion = await maybeCompleteEnrollment(tx, userId, lesson.contentId);
    const progress = await tx.learningLessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
    return {
      completed: true,
      completedAt: iso(progress.completedAt),
      courseCompleted: completion.completed,
      skillsAwarded: completion.skillsAwarded,
    };
  });
}

export async function findOwnAssessment(client, userId, assessmentId) {
  const assessment = await client.learningAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      questions: { orderBy: { sortOrder: 'asc' } },
      content: { select: { id: true, status: true, title: true } },
    },
  });
  if (!assessment || assessment.content.status === 'DRAFT') {
    throw new LearningError(404, 'Not found');
  }
  const enrollment = await client.learningEnrollment.findUnique({
    where: { userId_contentId: { userId, contentId: assessment.contentId } },
  });
  if (!enrollment) {
    throw new LearningError(403, LEARNING_NOT_ENROLLED);
  }
  const attempts = await client.learningAttempt.findMany({
    where: { userId, assessmentId },
    orderBy: { createdAt: 'desc' },
  });
  return {
    assessment: {
      id: assessment.id,
      contentId: assessment.contentId,
      title: assessment.title,
      passingScore: assessment.passingScore,
      courseTitle: assessment.content.title,
      questions: assessment.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        sortOrder: question.sortOrder,
        options: publicQuestionOptions(question.options),
      })),
    },
    results: serializeAssessmentPublic(assessment, attempts),
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      score: attempt.score,
      passed: attempt.passed,
      createdAt: iso(attempt.createdAt),
    })),
  };
}

export async function submitOwnAttempt(client, userId, assessmentId, answers) {
  return client.$transaction(async (tx) => {
    const assessment = await tx.learningAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        content: { select: { id: true, status: true } },
      },
    });
    if (!assessment || assessment.content.status === 'DRAFT') {
      throw new LearningError(404, 'Not found');
    }
    const enrollment = await tx.learningEnrollment.findUnique({
      where: { userId_contentId: { userId, contentId: assessment.contentId } },
    });
    if (!enrollment) {
      throw new LearningError(403, LEARNING_NOT_ENROLLED);
    }
    if (answers.length !== assessment.questions.length) {
      throw new LearningError(400, LEARNING_ASSESSMENT_INCOMPLETE);
    }
    const byQuestion = new Map(answers.map((item) => [item.questionId, item.optionId]));
    if (byQuestion.size !== assessment.questions.length) {
      throw new LearningError(400, LEARNING_ASSESSMENT_INCOMPLETE);
    }
    let correct = 0;
    const graded = [];
    for (const question of assessment.questions) {
      const selected = byQuestion.get(question.id);
      if (!selected) {
        throw new LearningError(400, LEARNING_ASSESSMENT_INCOMPLETE);
      }
      const isCorrect = selected === question.correctOptionId;
      if (isCorrect) {
        correct += 1;
      }
      graded.push({
        questionId: question.id,
        optionId: selected,
        correct: isCorrect,
        explanation: explanationForOption(question.options, selected),
      });
    }
    const score = Math.round((correct / assessment.questions.length) * 100);
    const passed = score >= assessment.passingScore;
    const attempt = await tx.learningAttempt.create({
      data: {
        userId,
        assessmentId,
        enrollmentId: enrollment.id,
        score,
        passed,
        answers: graded,
      },
    });
    const completion = await maybeCompleteEnrollment(tx, userId, assessment.contentId);
    return {
      attempt: {
        id: attempt.id,
        score: attempt.score,
        passed: attempt.passed,
        createdAt: iso(attempt.createdAt),
        answers: graded,
      },
      courseCompleted: completion.completed,
      skillsAwarded: completion.skillsAwarded,
    };
  });
}

export async function listOwnHistory(client, userId) {
  const enrollments = await listOwnEnrollments(client, userId);
  const attempts = await client.learningAttempt.findMany({
    where: { userId },
    include: {
      assessment: { select: { id: true, title: true, contentId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return {
    enrollments: enrollments.enrollments,
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      assessmentId: attempt.assessmentId,
      contentId: attempt.assessment.contentId,
      title: attempt.assessment.title,
      score: attempt.score,
      passed: attempt.passed,
      createdAt: iso(attempt.createdAt),
    })),
  };
}

export async function recommendCourses(client, userId) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      targetOccupationId: true,
      targetOccupation: { select: skillGapOccupationSelect },
    },
  });
  if (!user?.targetOccupation || user.targetOccupation.sourceSystem !== 'ESCO') {
    return { status: 'empty-target', occupation: null, courses: [] };
  }

  const [relations, userSkills] = await Promise.all([
    client.occupationSkillRelation.findMany({
      where: { occupationId: user.targetOccupation.id },
      select: skillGapRelationSelect,
      orderBy: skillGapRelationOrder,
      take: SKILL_GAP_RELATION_LIMIT,
    }),
    client.userSkill.findMany({
      where: { userId },
      select: skillGapUserSkillSelect,
    }),
  ]);
  const gap = serializeSkillGap(user.targetOccupation, relations, userSkills);
  const missingIds = gap.items.filter((item) => !item.recorded).map((item) => item.skill.id);
  if (missingIds.length === 0) {
    return {
      status: 'all-recorded',
      occupation: gap.occupation,
      courses: [],
    };
  }

  const missingSet = new Set(missingIds);
  const missingMeta = new Map(gap.items.filter((item) => !item.recorded).map((item) => [item.skill.id, item]));
  const matches = await client.learningContent.findMany({
    where: {
      status: 'PUBLISHED',
      skills: { some: { skillId: { in: missingIds } } },
    },
    include: courseListInclude,
  });

  const ranked = matches.map((course) => {
    const matched = course.skills.filter((link) => missingSet.has(link.skillId));
    const essentialCount = matched.filter((link) => missingMeta.get(link.skillId)?.relationType === 'essential').length;
    return {
      course,
      matched,
      score: essentialCount * 10 + matched.length,
    };
  }).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.course.title.localeCompare(right.course.title, 'en');
  });

  const seen = new Set();
  const courses = [];
  for (const item of ranked) {
    if (seen.has(item.course.id)) {
      continue;
    }
    seen.add(item.course.id);
    courses.push({
      ...serializeCourseSummary(item.course),
      matchedSkillCount: item.matched.length,
      matchedSkills: item.matched.map(serializeLinkedSkill),
      rationale: `This PeaceOne demonstration course covers ${item.matched.length} skill${item.matched.length === 1 ? '' : 's'} linked to ${gap.occupation.preferredLabel} that are not yet in your recorded list.`,
    });
  }

  return {
    status: courses.length ? 'ready' : 'no-matching-courses',
    occupation: gap.occupation,
    courses,
  };
}

export async function listAdminCourses(client, query) {
  const search = normalizeLabelSearch(query.q);
  const where = {
    ...(query.category ? { category: query.category } : {}),
    ...(query.difficulty ? { difficulty: query.difficulty } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(search
      ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      }
      : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [total, records] = await Promise.all([
    client.learningContent.count({ where }),
    client.learningContent.findMany({
      where,
      include: courseListInclude,
      orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
      skip,
      take: query.limit,
    }),
  ]);
  return {
    courses: records.map((record) => serializeCourseSummary(record, {
      enrollmentCount: record._count.enrollments,
    })),
    ...paginationMeta(query.page, query.limit, total),
  };
}

export async function findAdminCourse(client, contentId) {
  const record = await client.learningContent.findUnique({
    where: { id: contentId },
    include: courseDetailInclude,
  });
  if (!record) {
    throw new LearningError(404, 'Not found');
  }
  return {
    course: serializeCourseSummary(record, { enrollmentCount: record._count.enrollments }),
    lessons: record.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      body: lesson.body,
      sortOrder: lesson.sortOrder,
      estimatedMinutes: lesson.estimatedMinutes,
    })),
    assessments: record.assessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      passingScore: assessment.passingScore,
      lessonId: assessment.lessonId,
      questions: assessment.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: question.options,
        correctOptionId: question.correctOptionId,
        sortOrder: question.sortOrder,
      })),
    })),
  };
}

export async function createAdminCourse(client, body) {
  await assertEscoSkills(client, body.skills);
  try {
    const created = await client.learningContent.create({
      data: {
        slug: body.slug,
        title: body.title,
        description: body.description,
        objectives: body.objectives,
        category: body.category,
        difficulty: body.difficulty,
        estimatedMinutes: body.estimatedMinutes,
        thumbnailUrl: body.thumbnailUrl ?? null,
        skills: {
          create: body.skills.map((item) => ({
            skillId: item.skillId,
            targetProficiency: item.targetProficiency,
          })),
        },
      },
      include: courseListInclude,
    });
    return serializeCourseSummary(created, { enrollmentCount: 0 });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new LearningError(409, 'Slug already exists');
    }
    throw error;
  }
}

export async function updateAdminCourse(client, contentId, body) {
  return client.$transaction(async (tx) => {
    const existing = await tx.learningContent.findUnique({ where: { id: contentId } });
    if (!existing) {
      throw new LearningError(404, 'Not found');
    }
    const data = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.objectives !== undefined) data.objectives = body.objectives;
    if (body.category !== undefined) data.category = body.category;
    if (body.difficulty !== undefined) data.difficulty = body.difficulty;
    if (body.estimatedMinutes !== undefined) data.estimatedMinutes = body.estimatedMinutes;
    if (body.thumbnailUrl !== undefined) data.thumbnailUrl = body.thumbnailUrl;
    if (Object.keys(data).length) {
      await tx.learningContent.update({ where: { id: existing.id }, data });
    }
    if (body.skills) {
      await replaceCourseSkills(tx, existing.id, body.skills);
    }
    const record = await tx.learningContent.findUnique({
      where: { id: existing.id },
      include: courseListInclude,
    });
    return serializeCourseSummary(record, { enrollmentCount: record._count.enrollments });
  });
}

export async function publishAdminCourse(client, contentId) {
  const existing = await client.learningContent.findUnique({
    where: { id: contentId },
    include: { lessons: true, skills: true },
  });
  if (!existing) {
    throw new LearningError(404, 'Not found');
  }
  if (existing.status === 'ARCHIVED') {
    throw new LearningError(409, 'Archived courses cannot be published');
  }
  if (!existing.lessons.length) {
    throw new LearningError(400, 'Add at least one lesson before publishing');
  }
  const updated = await client.learningContent.update({
    where: { id: contentId },
    data: {
      status: 'PUBLISHED',
      publishedAt: existing.publishedAt ?? new Date(),
    },
    include: courseListInclude,
  });
  return serializeCourseSummary(updated, { enrollmentCount: updated._count.enrollments });
}

export async function unpublishAdminCourse(client, contentId) {
  const existing = await client.learningContent.findUnique({ where: { id: contentId } });
  if (!existing) {
    throw new LearningError(404, 'Not found');
  }
  if (existing.status !== 'PUBLISHED') {
    throw new LearningError(409, 'Only published courses can be unpublished');
  }
  const updated = await client.learningContent.update({
    where: { id: contentId },
    data: { status: 'DRAFT' },
    include: courseListInclude,
  });
  return serializeCourseSummary(updated, { enrollmentCount: updated._count.enrollments });
}

export async function archiveAdminCourse(client, contentId) {
  const existing = await client.learningContent.findUnique({ where: { id: contentId } });
  if (!existing) {
    throw new LearningError(404, 'Not found');
  }
  const updated = await client.learningContent.update({
    where: { id: contentId },
    data: { status: 'ARCHIVED' },
    include: courseListInclude,
  });
  return serializeCourseSummary(updated, { enrollmentCount: updated._count.enrollments });
}

export async function deleteAdminCourse(client, contentId) {
  const existing = await client.learningContent.findUnique({
    where: { id: contentId },
    include: { _count: { select: { enrollments: true } } },
  });
  if (!existing) {
    throw new LearningError(404, 'Not found');
  }
  if (existing._count.enrollments > 0) {
    throw new LearningError(409, LEARNING_CANNOT_BE_DELETED);
  }
  await client.learningContent.delete({ where: { id: contentId } });
  return { ok: true };
}

export async function createAdminLesson(client, contentId, body) {
  const course = await client.learningContent.findUnique({ where: { id: contentId } });
  if (!course) {
    throw new LearningError(404, 'Not found');
  }
  try {
    const lesson = await client.learningLesson.create({
      data: {
        contentId,
        title: body.title,
        body: body.body,
        sortOrder: body.sortOrder,
        estimatedMinutes: body.estimatedMinutes,
      },
    });
    return lesson;
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new LearningError(409, 'Lesson order already exists');
    }
    throw error;
  }
}

export async function updateAdminLesson(client, lessonId, body) {
  const existing = await client.learningLesson.findUnique({ where: { id: lessonId } });
  if (!existing) {
    throw new LearningError(404, 'Not found');
  }
  try {
    return await client.learningLesson.update({
      where: { id: lessonId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.estimatedMinutes !== undefined ? { estimatedMinutes: body.estimatedMinutes } : {}),
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new LearningError(409, 'Lesson order already exists');
    }
    throw error;
  }
}

export async function createAdminAssessment(client, contentId, body) {
  const course = await client.learningContent.findUnique({ where: { id: contentId } });
  if (!course) {
    throw new LearningError(404, 'Not found');
  }
  if (body.lessonId) {
    const lesson = await client.learningLesson.findFirst({
      where: { id: body.lessonId, contentId },
    });
    if (!lesson) {
      throw new LearningError(400, 'Invalid request');
    }
  }
  return client.learningAssessment.create({
    data: {
      contentId,
      lessonId: body.lessonId ?? null,
      title: body.title,
      passingScore: body.passingScore,
      questions: {
        create: body.questions.map((question) => ({
          prompt: question.prompt,
          options: question.options,
          correctOptionId: question.correctOptionId,
          sortOrder: question.sortOrder,
        })),
      },
    },
    include: { questions: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function updateAdminAssessment(client, assessmentId, body) {
  const existing = await client.learningAssessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, contentId: true },
  });
  if (!existing) {
    throw new LearningError(404, 'Not found');
  }
  if (body.lessonId) {
    const lesson = await client.learningLesson.findFirst({
      where: { id: body.lessonId, contentId: existing.contentId },
    });
    if (!lesson) {
      throw new LearningError(400, 'Invalid request');
    }
  }
  return client.$transaction(async (tx) => {
    await tx.learningQuestion.deleteMany({ where: { assessmentId } });
    await tx.learningAssessment.update({
      where: { id: assessmentId },
      data: {
        title: body.title,
        passingScore: body.passingScore,
        lessonId: body.lessonId ?? null,
        questions: {
          create: body.questions.map((question) => ({
            prompt: question.prompt,
            options: question.options,
            correctOptionId: question.correctOptionId,
            sortOrder: question.sortOrder,
          })),
        },
      },
    });
    return tx.learningAssessment.findUnique({
      where: { id: assessmentId },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });
  });
}

export async function listAdminCourseEnrollments(client, contentId) {
  const course = await client.learningContent.findUnique({
    where: { id: contentId },
    include: { _count: { select: { lessons: true } } },
  });
  if (!course) {
    throw new LearningError(404, 'Not found');
  }
  const enrollments = await client.learningEnrollment.findMany({
    where: { contentId },
    include: {
      user: { select: { id: true, email: true, fullName: true, role: true } },
    },
    orderBy: { enrolledAt: 'desc' },
  });
  const progressRows = await client.learningLessonProgress.groupBy({
    by: ['userId'],
    where: { contentId },
    _count: { _all: true },
  });
  const completedByUser = new Map(progressRows.map((row) => [row.userId, row._count._all]));
  return {
    enrollments: enrollments.map((record) => serializeEnrollment(record, {
      user: record.user,
      progressPercent: progressPercent(completedByUser.get(record.userId) ?? 0, course._count.lessons),
      completedLessonCount: completedByUser.get(record.userId) ?? 0,
      lessonCount: course._count.lessons,
    })),
  };
}

export async function listAdminLearningStats(client) {
  const [courses, published, enrollments, completed, attempts] = await Promise.all([
    client.learningContent.count(),
    client.learningContent.count({ where: { status: 'PUBLISHED' } }),
    client.learningEnrollment.count(),
    client.learningEnrollment.count({ where: { status: 'COMPLETED' } }),
    client.learningAttempt.count(),
  ]);
  return { courses, published, enrollments, completed, attempts };
}

export async function findAdminUserProgress(client, userId) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, role: true },
  });
  if (!user) {
    throw new LearningError(404, 'Not found');
  }
  const history = await listOwnHistory(client, userId);
  return { user, ...history };
}
