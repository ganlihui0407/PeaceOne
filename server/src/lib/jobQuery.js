import { z } from 'zod';
import { normalizeLabelSearch, paginationMeta, serializeSkillSummary } from './escoQuery.js';
import { USER_SKILL_PROFICIENCY_LEVELS } from './userSkillQuery.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const JOB_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'SUSPENDED'];
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'];
export const JOB_REQUIRED_LEVELS = USER_SKILL_PROFICIENCY_LEVELS;
export const COMPANY_PROFILE_REQUIRED = 'Company profile required';
export const JOB_CANNOT_BE_PUBLISHED = 'Job cannot be published';
export const JOB_CANNOT_BE_CLOSED = 'Job cannot be closed';
export const JOB_CANNOT_BE_SUSPENDED = 'Job cannot be suspended';
export const JOB_CANNOT_BE_DELETED = 'Job cannot be deleted';
export const JOB_CANNOT_BE_UPDATED = 'Job cannot be updated';
export const SUSPEND_REASON_REQUIRED = 'Suspension reason is required';

export const JOB_FIELD_LIMITS = {
  title: 150,
  description: 5000,
  qualificationRequired: 2000,
  experienceRequired: 2000,
  location: 100,
  requiredSkills: 50,
  note: 1000,
  salaryMax: 10_000_000,
};

const JOB_STATUS_ENUM = /** @type {[string, ...string[]]} */ (JOB_STATUSES);
const EMPLOYMENT_TYPE_ENUM = /** @type {[string, ...string[]]} */ (EMPLOYMENT_TYPES);
const REQUIRED_LEVEL_ENUM = /** @type {[string, ...string[]]} */ (JOB_REQUIRED_LEVELS);

export class JobError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'JobError';
    this.status = status;
  }
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

function singleQueryValue(value) {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  }
  return String(value);
}

const optionalQueryString = z.preprocess(singleQueryValue, z.string().max(200).optional());

const pageQuery = z.preprocess((value) => {
  const normalized = singleQueryValue(value);
  return normalized === undefined ? '1' : normalized;
}, z.string().regex(/^[1-9]\d{0,6}$/).transform((value) => Number.parseInt(value, 10)));

const limitQuery = z.preprocess((value) => {
  const normalized = singleQueryValue(value);
  return normalized === undefined ? '20' : normalized;
}, z.string().regex(/^[1-9]\d{0,2}$/).transform((value) => Number.parseInt(value, 10)).refine((value) => value <= 50));

const optionalSalary = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  return value;
}, z.union([z.number().int().min(0).max(JOB_FIELD_LIMITS.salaryMax), z.null()]).optional());

const optionalDateTime = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }
  const normalized = emptyToNull(value);
  if (normalized === null) {
    return null;
  }
  return normalized;
}, z.union([
  z.string().refine((value) => {
    const parsed = Date.parse(value);
    return !Number.isNaN(parsed);
  }),
  z.null(),
]).optional());

const requiredSkillSchema = z
  .object({
    skillId: z.string().regex(UUID_RE),
    requiredLevel: z.enum(REQUIRED_LEVEL_ENUM),
  })
  .strict();

const requiredSkillsSchema = z
  .array(requiredSkillSchema)
  .max(JOB_FIELD_LIMITS.requiredSkills)
  .refine((skills) => new Set(skills.map((skill) => skill.skillId)).size === skills.length, {
    message: 'duplicate',
  });

function salaryRangeRefine(body, ctx) {
  if (
    typeof body.salaryMin === 'number'
    && typeof body.salaryMax === 'number'
    && body.salaryMin > body.salaryMax
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'salaryMin cannot exceed salaryMax',
      path: ['salaryMin'],
    });
  }
}

export const jobIdParamsSchema = z.object({
  id: z.string().regex(UUID_RE),
});

export const createJobBodySchema = z
  .object({
    title: z.string().trim().min(1).max(JOB_FIELD_LIMITS.title),
    description: z.string().trim().min(1).max(JOB_FIELD_LIMITS.description),
    qualificationRequired: z.string().trim().min(1).max(JOB_FIELD_LIMITS.qualificationRequired),
    experienceRequired: z.string().trim().min(1).max(JOB_FIELD_LIMITS.experienceRequired),
    employmentType: z.enum(EMPLOYMENT_TYPE_ENUM),
    location: z.string().trim().min(1).max(JOB_FIELD_LIMITS.location),
    salaryMin: optionalSalary,
    salaryMax: optionalSalary,
    closesAt: optionalDateTime,
    requiredSkills: requiredSkillsSchema.optional().default([]),
  })
  .strict()
  .superRefine(salaryRangeRefine);

export const updateJobBodySchema = z
  .object({
    title: z.string().trim().min(1).max(JOB_FIELD_LIMITS.title).optional(),
    description: z.string().trim().min(1).max(JOB_FIELD_LIMITS.description).optional(),
    qualificationRequired: z.string().trim().min(1).max(JOB_FIELD_LIMITS.qualificationRequired).optional(),
    experienceRequired: z.string().trim().min(1).max(JOB_FIELD_LIMITS.experienceRequired).optional(),
    employmentType: z.enum(EMPLOYMENT_TYPE_ENUM).optional(),
    location: z.string().trim().min(1).max(JOB_FIELD_LIMITS.location).optional(),
    salaryMin: optionalSalary,
    salaryMax: optionalSalary,
    closesAt: optionalDateTime,
    requiredSkills: requiredSkillsSchema.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    const keys = Object.keys(body);
    if (keys.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'empty' });
    }
    salaryRangeRefine(body, ctx);
  });

export const emptyJobBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z.object({}).strict(),
);

export const adminSuspendJobBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(JOB_FIELD_LIMITS.note),
  })
  .strict();

export const adminCloseJobBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z
    .object({
      reason: z.preprocess(
        emptyToNull,
        z.union([z.string().trim().max(JOB_FIELD_LIMITS.note), z.null()]).optional(),
      ),
    })
    .strict(),
);

export const staffJobListQuerySchema = z.object({
  q: optionalQueryString,
  status: z.preprocess(singleQueryValue, z.enum(JOB_STATUS_ENUM).optional()),
  page: pageQuery,
  limit: limitQuery,
});

export const adminJobListQuerySchema = z.object({
  q: optionalQueryString,
  status: z.preprocess(singleQueryValue, z.enum(JOB_STATUS_ENUM).optional()),
  companyId: z.preprocess(singleQueryValue, z.string().regex(UUID_RE).optional()),
  page: pageQuery,
  limit: limitQuery,
});

export const candidateJobListQuerySchema = z.object({
  q: optionalQueryString,
  company: optionalQueryString,
  location: optionalQueryString,
  employmentType: z.preprocess(singleQueryValue, z.enum(EMPLOYMENT_TYPE_ENUM).optional()),
  industry: optionalQueryString,
  page: pageQuery,
  limit: limitQuery,
});

const publicCompanySelect = {
  id: true,
  companyName: true,
  industry: true,
  location: true,
  website: true,
  description: true,
};

const createdBySelect = {
  id: true,
  fullName: true,
};

const skillSelect = {
  id: true,
  sourceUri: true,
  preferredLabel: true,
  skillType: true,
  sourceSystem: true,
};

const jobSkillInclude = {
  skill: { select: skillSelect },
};

const statusEventInclude = {
  actor: { select: createdBySelect },
};

export const jobDetailInclude = {
  company: { select: publicCompanySelect },
  createdBy: { select: createdBySelect },
  skills: {
    include: jobSkillInclude,
    orderBy: { skill: { preferredLabel: 'asc' } },
  },
  statusEvents: {
    include: statusEventInclude,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
};

export const jobListInclude = {
  company: { select: publicCompanySelect },
  createdBy: { select: createdBySelect },
  skills: {
    include: jobSkillInclude,
    orderBy: { skill: { preferredLabel: 'asc' } },
  },
};

function parseClosesAt(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return new Date(value);
}

function iso(value) {
  return value ? value.toISOString() : null;
}

function serializePublicCompany(company) {
  if (!company) {
    return null;
  }
  return {
    id: company.id,
    companyName: company.companyName,
    industry: company.industry ?? null,
    location: company.location ?? null,
    website: company.website ?? null,
    description: company.description ?? null,
  };
}

function serializeJobSkill(record) {
  return {
    id: record.id,
    requiredLevel: record.requiredLevel,
    skill: serializeSkillSummary(record.skill),
  };
}

function serializeStatusEvent(event) {
  return {
    id: event.id,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus,
    note: event.note ?? null,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor
      ? { id: event.actor.id, fullName: event.actor.fullName }
      : null,
  };
}

export function serializeJob(record, { includeEvents = false, audience = 'staff' } = {}) {
  const job = {
    id: record.id,
    title: record.title,
    description: record.description,
    qualificationRequired: record.qualificationRequired,
    experienceRequired: record.experienceRequired,
    employmentType: record.employmentType,
    location: record.location,
    salaryMin: record.salaryMin ?? null,
    salaryMax: record.salaryMax ?? null,
    closesAt: iso(record.closesAt),
    status: record.status,
    publishedAt: iso(record.publishedAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    company: serializePublicCompany(record.company),
    requiredSkills: (record.skills ?? []).map(serializeJobSkill),
  };

  if (audience !== 'candidate') {
    job.companyId = record.companyId;
    job.createdByUserId = record.createdByUserId;
    job.createdBy = record.createdBy
      ? { id: record.createdBy.id, fullName: record.createdBy.fullName }
      : null;
  }

  if (includeEvents) {
    job.statusEvents = (record.statusEvents ?? []).map(serializeStatusEvent);
  }

  return job;
}

export function candidateJobListWhere(query, now = new Date()) {
  const where = {
    status: 'PUBLISHED',
    AND: [
      {
        OR: [{ closesAt: null }, { closesAt: { gt: now } }],
      },
    ],
  };

  const titleSearch = normalizeLabelSearch(query.q);
  if (titleSearch) {
    where.AND.push({
      OR: [
        { title: { contains: titleSearch, mode: 'insensitive' } },
        { company: { companyName: { contains: titleSearch, mode: 'insensitive' } } },
      ],
    });
  }

  const location = normalizeLabelSearch(query.location);
  if (location) {
    where.location = { contains: location, mode: 'insensitive' };
  }

  if (query.employmentType) {
    where.employmentType = query.employmentType;
  }

  const industry = normalizeLabelSearch(query.industry);
  const companyName = normalizeLabelSearch(query.company);
  if (industry || companyName) {
    where.company = {
      ...(where.company ?? {}),
      ...(companyName ? { companyName: { contains: companyName, mode: 'insensitive' } } : {}),
      ...(industry ? { industry: { contains: industry, mode: 'insensitive' } } : {}),
    };
  }

  return where;
}

export function ownedJobListWhere(companyId, query) {
  const where = { companyId };
  if (query.status) {
    where.status = query.status;
  }
  const search = normalizeLabelSearch(query.q);
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
}

export function adminJobListWhere(query) {
  const where = {};
  if (query.status) {
    where.status = query.status;
  }
  if (query.companyId) {
    where.companyId = query.companyId;
  }
  const search = normalizeLabelSearch(query.q);
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { company: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }
  return where;
}

async function requireStaffCompany(client, userId) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, companyId: true },
  });
  if (!user) {
    throw new JobError(401, 'Unauthenticated');
  }
  if (!user.companyId) {
    throw new JobError(403, COMPANY_PROFILE_REQUIRED);
  }
  return user;
}

async function assertEscoSkills(client, requiredSkills) {
  if (!requiredSkills || requiredSkills.length === 0) {
    return;
  }
  const ids = requiredSkills.map((skill) => skill.skillId);
  const found = await client.skill.findMany({
    where: { id: { in: ids }, sourceSystem: 'ESCO' },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw new JobError(400, 'Invalid request');
  }
}

function jobSkillCreateData(requiredSkills) {
  return requiredSkills.map((skill) => ({
    skillId: skill.skillId,
    requiredLevel: skill.requiredLevel,
  }));
}

async function replaceJobSkills(tx, jobId, requiredSkills) {
  await assertEscoSkills(tx, requiredSkills);
  await tx.jobSkill.deleteMany({ where: { jobId } });
  if (requiredSkills.length === 0) {
    return;
  }
  await tx.jobSkill.createMany({
    data: requiredSkills.map((skill) => ({
      jobId,
      skillId: skill.skillId,
      requiredLevel: skill.requiredLevel,
    })),
  });
}

function recordStatusEvent(tx, { jobId, fromStatus, toStatus, actorUserId, note = null }) {
  return tx.jobStatusEvent.create({
    data: {
      jobId,
      fromStatus,
      toStatus,
      actorUserId,
      note,
    },
  });
}

function mergedSalary(existing, body) {
  const salaryMin = body.salaryMin !== undefined ? body.salaryMin : existing.salaryMin;
  const salaryMax = body.salaryMax !== undefined ? body.salaryMax : existing.salaryMax;
  if (
    typeof salaryMin === 'number'
    && typeof salaryMax === 'number'
    && salaryMin > salaryMax
  ) {
    throw new JobError(400, 'Invalid request');
  }
  return { salaryMin, salaryMax };
}

function isJobListableForCandidates(job, now = new Date()) {
  if (!job || job.status !== 'PUBLISHED') {
    return false;
  }
  if (job.closesAt && job.closesAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

export async function listOwnedJobs(client, userId, query) {
  const user = await requireStaffCompany(client, userId);
  const where = ownedJobListWhere(user.companyId, query);
  const skip = (query.page - 1) * query.limit;
  const [total, records] = await Promise.all([
    client.job.count({ where }),
    client.job.findMany({
      where,
      include: jobListInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip,
      take: query.limit,
    }),
  ]);
  return {
    jobs: records.map((record) => serializeJob(record, { audience: 'staff' })),
    ...paginationMeta(query.page, query.limit, total),
  };
}

export async function findOwnedJob(client, userId, jobId) {
  const user = await requireStaffCompany(client, userId);
  const record = await client.job.findFirst({
    where: { id: jobId, companyId: user.companyId },
    include: jobDetailInclude,
  });
  if (!record) {
    throw new JobError(404, 'Not found');
  }
  return serializeJob(record, { includeEvents: true, audience: 'staff' });
}

export async function createOwnedJob(client, userId, body) {
  const user = await requireStaffCompany(client, userId);
  await assertEscoSkills(client, body.requiredSkills);

  const created = await client.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        companyId: user.companyId,
        createdByUserId: user.id,
        title: body.title,
        description: body.description,
        qualificationRequired: body.qualificationRequired,
        experienceRequired: body.experienceRequired,
        employmentType: body.employmentType,
        location: body.location,
        salaryMin: body.salaryMin ?? null,
        salaryMax: body.salaryMax ?? null,
        closesAt: parseClosesAt(body.closesAt) ?? null,
        status: 'DRAFT',
        skills: {
          create: jobSkillCreateData(body.requiredSkills),
        },
        statusEvents: {
          create: {
            fromStatus: null,
            toStatus: 'DRAFT',
            actorUserId: user.id,
          },
        },
      },
      include: jobDetailInclude,
    });
    return job;
  });

  return serializeJob(created, { includeEvents: true, audience: 'staff' });
}

export async function updateOwnedJob(client, userId, jobId, body) {
  const user = await requireStaffCompany(client, userId);

  return client.$transaction(async (tx) => {
    const existing = await tx.job.findFirst({
      where: { id: jobId, companyId: user.companyId },
    });
    if (!existing) {
      throw new JobError(404, 'Not found');
    }
    if (existing.status === 'CLOSED' || existing.status === 'SUSPENDED') {
      throw new JobError(409, JOB_CANNOT_BE_UPDATED);
    }

    const salary = mergedSalary(existing, body);
    const data = {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.qualificationRequired !== undefined
        ? { qualificationRequired: body.qualificationRequired }
        : {}),
      ...(body.experienceRequired !== undefined
        ? { experienceRequired: body.experienceRequired }
        : {}),
      ...(body.employmentType !== undefined ? { employmentType: body.employmentType } : {}),
      ...(body.location !== undefined ? { location: body.location } : {}),
      ...(body.salaryMin !== undefined ? { salaryMin: salary.salaryMin } : {}),
      ...(body.salaryMax !== undefined ? { salaryMax: salary.salaryMax } : {}),
      ...(body.closesAt !== undefined ? { closesAt: parseClosesAt(body.closesAt) } : {}),
    };

    if (body.requiredSkills) {
      await replaceJobSkills(tx, existing.id, body.requiredSkills);
    }

    await tx.job.update({
      where: { id: existing.id },
      data,
    });

    const record = await tx.job.findUnique({
      where: { id: existing.id },
      include: jobDetailInclude,
    });
    return serializeJob(record, { includeEvents: true, audience: 'staff' });
  });
}

function assertPublishable(job) {
  if (job.status !== 'DRAFT') {
    throw new JobError(409, JOB_CANNOT_BE_PUBLISHED);
  }
  if (!job.skills || job.skills.length === 0) {
    throw new JobError(400, JOB_CANNOT_BE_PUBLISHED);
  }
  if (job.closesAt && job.closesAt.getTime() <= Date.now()) {
    throw new JobError(400, JOB_CANNOT_BE_PUBLISHED);
  }
}

export async function publishOwnedJob(client, userId, jobId) {
  const user = await requireStaffCompany(client, userId);

  return client.$transaction(async (tx) => {
    const existing = await tx.job.findFirst({
      where: { id: jobId, companyId: user.companyId },
      include: { skills: true },
    });
    if (!existing) {
      throw new JobError(404, 'Not found');
    }

    assertPublishable(existing);

    const publishedAt = new Date();
    const updated = await tx.job.updateMany({
      where: { id: existing.id, status: 'DRAFT' },
      data: {
        status: 'PUBLISHED',
        publishedAt,
      },
    });
    if (updated.count !== 1) {
      throw new JobError(409, JOB_CANNOT_BE_PUBLISHED);
    }

    await recordStatusEvent(tx, {
      jobId: existing.id,
      fromStatus: 'DRAFT',
      toStatus: 'PUBLISHED',
      actorUserId: user.id,
    });

    const record = await tx.job.findUnique({
      where: { id: existing.id },
      include: jobDetailInclude,
    });
    return serializeJob(record, { includeEvents: true, audience: 'staff' });
  });
}

export async function closeOwnedJob(client, userId, jobId) {
  const user = await requireStaffCompany(client, userId);

  return client.$transaction(async (tx) => {
    const existing = await tx.job.findFirst({
      where: { id: jobId, companyId: user.companyId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new JobError(404, 'Not found');
    }
    if (existing.status !== 'PUBLISHED') {
      throw new JobError(409, JOB_CANNOT_BE_CLOSED);
    }

    const updated = await tx.job.updateMany({
      where: { id: existing.id, status: 'PUBLISHED' },
      data: { status: 'CLOSED' },
    });
    if (updated.count !== 1) {
      throw new JobError(409, JOB_CANNOT_BE_CLOSED);
    }

    await recordStatusEvent(tx, {
      jobId: existing.id,
      fromStatus: 'PUBLISHED',
      toStatus: 'CLOSED',
      actorUserId: user.id,
    });

    const record = await tx.job.findUnique({
      where: { id: existing.id },
      include: jobDetailInclude,
    });
    return serializeJob(record, { includeEvents: true, audience: 'staff' });
  });
}

export async function deleteOwnedJob(client, userId, jobId) {
  const user = await requireStaffCompany(client, userId);
  const existing = await client.job.findFirst({
    where: { id: jobId, companyId: user.companyId },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new JobError(404, 'Not found');
  }
  if (existing.status !== 'DRAFT') {
    throw new JobError(409, JOB_CANNOT_BE_DELETED);
  }
  await client.job.delete({ where: { id: existing.id } });
  return { ok: true };
}

export async function listAdminJobs(client, query) {
  const where = adminJobListWhere(query);
  const skip = (query.page - 1) * query.limit;
  const [total, records] = await Promise.all([
    client.job.count({ where }),
    client.job.findMany({
      where,
      include: jobListInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip,
      take: query.limit,
    }),
  ]);
  return {
    jobs: records.map((record) => serializeJob(record, { audience: 'admin' })),
    ...paginationMeta(query.page, query.limit, total),
  };
}

export async function findAdminJob(client, jobId) {
  const record = await client.job.findUnique({
    where: { id: jobId },
    include: jobDetailInclude,
  });
  if (!record) {
    throw new JobError(404, 'Not found');
  }
  return serializeJob(record, { includeEvents: true, audience: 'admin' });
}

export async function suspendAdminJob(client, { jobId, actorUserId, reason }) {
  if (!reason || reason.trim().length === 0) {
    throw new JobError(400, SUSPEND_REASON_REQUIRED);
  }

  return client.$transaction(async (tx) => {
    const existing = await tx.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new JobError(404, 'Not found');
    }
    if (existing.status !== 'PUBLISHED') {
      throw new JobError(409, JOB_CANNOT_BE_SUSPENDED);
    }

    const updated = await tx.job.updateMany({
      where: { id: existing.id, status: 'PUBLISHED' },
      data: { status: 'SUSPENDED' },
    });
    if (updated.count !== 1) {
      throw new JobError(409, JOB_CANNOT_BE_SUSPENDED);
    }

    await recordStatusEvent(tx, {
      jobId: existing.id,
      fromStatus: 'PUBLISHED',
      toStatus: 'SUSPENDED',
      actorUserId,
      note: reason.trim(),
    });

    const record = await tx.job.findUnique({
      where: { id: existing.id },
      include: jobDetailInclude,
    });
    return serializeJob(record, { includeEvents: true, audience: 'admin' });
  });
}

export async function closeAdminJob(client, { jobId, actorUserId, reason = null }) {
  return client.$transaction(async (tx) => {
    const existing = await tx.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new JobError(404, 'Not found');
    }
    if (existing.status !== 'PUBLISHED' && existing.status !== 'SUSPENDED') {
      throw new JobError(409, JOB_CANNOT_BE_CLOSED);
    }

    const updated = await tx.job.updateMany({
      where: {
        id: existing.id,
        status: { in: ['PUBLISHED', 'SUSPENDED'] },
      },
      data: { status: 'CLOSED' },
    });
    if (updated.count !== 1) {
      throw new JobError(409, JOB_CANNOT_BE_CLOSED);
    }

    await recordStatusEvent(tx, {
      jobId: existing.id,
      fromStatus: existing.status,
      toStatus: 'CLOSED',
      actorUserId,
      note: reason ?? null,
    });

    const record = await tx.job.findUnique({
      where: { id: existing.id },
      include: jobDetailInclude,
    });
    return serializeJob(record, { includeEvents: true, audience: 'admin' });
  });
}

export async function listCandidateJobs(client, query) {
  const where = candidateJobListWhere(query);
  const skip = (query.page - 1) * query.limit;
  const [total, records] = await Promise.all([
    client.job.count({ where }),
    client.job.findMany({
      where,
      include: jobListInclude,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      skip,
      take: query.limit,
    }),
  ]);
  return {
    jobs: records.map((record) => serializeJob(record, { audience: 'candidate' })),
    ...paginationMeta(query.page, query.limit, total),
  };
}

export async function findCandidateJob(client, jobId) {
  const record = await client.job.findUnique({
    where: { id: jobId },
    include: jobListInclude,
  });
  if (!isJobListableForCandidates(record)) {
    throw new JobError(404, 'Not found');
  }
  return serializeJob(record, { audience: 'candidate' });
}
