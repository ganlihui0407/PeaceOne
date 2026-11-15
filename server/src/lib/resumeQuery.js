import { z } from 'zod';
import {
  cleanupOwnedResumeDir,
  publicResumeFileMetadata,
  removeEmptyResumeDirs,
  removeStoredResumeFile,
} from './resumeStorage.js';

import { DEFAULT_RESUME_TEMPLATE, RESUME_TEMPLATE_KEYS } from './resumeTemplates.js';

export const MAX_RESUMES_PER_USER = 5;
export const RESUME_LIMIT_REACHED = 'Resume limit reached';
export { RESUME_TEMPLATE_KEYS };
export const RESUME_SKILL_PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export const RESUME_FIELD_LIMITS = {
  title: 150,
  summary: 4000,
  fullName: 100,
  email: 254,
  phone: 30,
  location: 100,
  institution: 150,
  qualification: 150,
  fieldOfStudy: 100,
  notes: 2000,
  jobTitle: 100,
  organization: 150,
  description: 4000,
  skillLabel: 150,
  certificationName: 150,
  issuer: 150,
  credentialId: 100,
};

export const RESUME_SECTION_LIMITS = {
  education: 20,
  experience: 30,
  skills: 50,
  certifications: 20,
};

export const RESUME_YEAR_MIN = 1950;
export const RESUME_YEAR_MAX = 2100;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TEMPLATE_ENUM = /** @type {[string, ...string[]]} */ (RESUME_TEMPLATE_KEYS);
const PROFICIENCY_ENUM = /** @type {[string, ...string[]]} */ (RESUME_SKILL_PROFICIENCY_LEVELS);

export class ResumeError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ResumeError';
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

const optionalLimitedString = (max) =>
  z.preprocess(emptyToNull, z.union([z.string().trim().max(max), z.null()]).optional());

const optionalYear = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  return value;
}, z.union([z.number().int().min(RESUME_YEAR_MIN).max(RESUME_YEAR_MAX), z.null()]).optional());

const optionalIsoDate = z.preprocess(emptyToNull, z.union([z.string().regex(ISO_DATE_RE), z.null()]).optional());

function optionalEmail() {
  return z.preprocess(
    emptyToNull,
    z.union([z.email().max(RESUME_FIELD_LIMITS.email), z.null()]).optional(),
  );
}

export const resumeIdParamsSchema = z.object({
  id: z.string().regex(UUID_RE),
});

export const emptyResumeBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z.object({}).strict(),
);

export const createResumeBodySchema = z
  .object({
    title: z.string().trim().min(1).max(RESUME_FIELD_LIMITS.title),
    summary: optionalLimitedString(RESUME_FIELD_LIMITS.summary),
    templateKey: z.enum(TEMPLATE_ENUM).optional(),
    fullName: z.string().trim().min(1).max(RESUME_FIELD_LIMITS.fullName).optional(),
    email: optionalEmail(),
    phone: optionalLimitedString(RESUME_FIELD_LIMITS.phone),
    location: optionalLimitedString(RESUME_FIELD_LIMITS.location),
  })
  .strict();

const educationItemSchema = z
  .object({
    institution: z.string().trim().min(1).max(RESUME_FIELD_LIMITS.institution),
    qualification: optionalLimitedString(RESUME_FIELD_LIMITS.qualification),
    fieldOfStudy: optionalLimitedString(RESUME_FIELD_LIMITS.fieldOfStudy),
    startYear: optionalYear,
    endYear: optionalYear,
    notes: optionalLimitedString(RESUME_FIELD_LIMITS.notes),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.startYear != null && item.endYear != null && item.endYear < item.startYear) {
      ctx.addIssue({ code: 'custom', message: 'Invalid request' });
    }
  });

const experienceItemSchema = z
  .object({
    jobTitle: z.string().trim().min(1).max(RESUME_FIELD_LIMITS.jobTitle),
    organization: z.string().trim().min(1).max(RESUME_FIELD_LIMITS.organization),
    location: optionalLimitedString(RESUME_FIELD_LIMITS.location),
    startDate: optionalIsoDate,
    endDate: optionalIsoDate,
    isCurrent: z.boolean().optional(),
    description: optionalLimitedString(RESUME_FIELD_LIMITS.description),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.isCurrent && item.endDate) {
      ctx.addIssue({ code: 'custom', message: 'Invalid request' });
    }
    if (item.startDate && item.endDate && item.endDate < item.startDate) {
      ctx.addIssue({ code: 'custom', message: 'Invalid request' });
    }
  });

const skillItemSchema = z
  .object({
    skillId: z.preprocess(emptyToNull, z.union([z.string().regex(UUID_RE), z.null()]).optional()),
    label: optionalLimitedString(RESUME_FIELD_LIMITS.skillLabel),
    proficiencyLevel: z.preprocess(
      emptyToNull,
      z.union([z.enum(PROFICIENCY_ENUM), z.null()]).optional(),
    ),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (!item.skillId && !item.label) {
      ctx.addIssue({ code: 'custom', message: 'Invalid request' });
    }
  });

const certificationItemSchema = z
  .object({
    name: z.string().trim().min(1).max(RESUME_FIELD_LIMITS.certificationName),
    issuer: optionalLimitedString(RESUME_FIELD_LIMITS.issuer),
    year: optionalYear,
    credentialId: optionalLimitedString(RESUME_FIELD_LIMITS.credentialId),
  })
  .strict();

export const updateResumeBodySchema = z
  .object({
    title: z.string().trim().min(1).max(RESUME_FIELD_LIMITS.title).optional(),
    summary: optionalLimitedString(RESUME_FIELD_LIMITS.summary),
    templateKey: z.enum(TEMPLATE_ENUM).optional(),
    fullName: z.string().trim().min(1).max(RESUME_FIELD_LIMITS.fullName).optional(),
    email: optionalEmail(),
    phone: optionalLimitedString(RESUME_FIELD_LIMITS.phone),
    location: optionalLimitedString(RESUME_FIELD_LIMITS.location),
    education: z.array(educationItemSchema).max(RESUME_SECTION_LIMITS.education).optional(),
    experience: z.array(experienceItemSchema).max(RESUME_SECTION_LIMITS.experience).optional(),
    skills: z.array(skillItemSchema).max(RESUME_SECTION_LIMITS.skills).optional(),
    certifications: z
      .array(certificationItemSchema)
      .max(RESUME_SECTION_LIMITS.certifications)
      .optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    const skillIds = (body.skills ?? []).map((item) => item.skillId).filter(Boolean);
    if (new Set(skillIds).size !== skillIds.length) {
      ctx.addIssue({ code: 'custom', path: ['skills'], message: 'Invalid request' });
    }
  });

const skillSelect = {
  id: true,
  sourceUri: true,
  preferredLabel: true,
  skillType: true,
  sourceSystem: true,
};

const resumeInclude = {
  education: { orderBy: { sortOrder: 'asc' } },
  experience: { orderBy: { sortOrder: 'asc' } },
  skills: { orderBy: { sortOrder: 'asc' }, include: { skill: { select: skillSelect } } },
  certifications: { orderBy: { sortOrder: 'asc' } },
  file: true,
};

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

function formatDate(value) {
  if (!value) {
    return null;
  }
  return value.toISOString().slice(0, 10);
}

function parseIsoDate(value) {
  if (value == null) {
    return null;
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function serializeSkillRef(skill) {
  if (!skill) {
    return null;
  }
  return {
    id: skill.id,
    sourceUri: skill.sourceUri,
    preferredLabel: skill.preferredLabel,
    skillType: skill.skillType ?? null,
    sourceSystem: skill.sourceSystem,
  };
}

export function serializeResumeSummary(record) {
  return {
    id: record.id,
    title: record.title,
    templateKey: record.templateKey,
    isPrimary: record.isPrimary,
    fullName: record.fullName,
    educationCount: record._count?.education ?? record.education?.length ?? 0,
    experienceCount: record._count?.experience ?? record.experience?.length ?? 0,
    skillCount: record._count?.skills ?? record.skills?.length ?? 0,
    certificationCount: record._count?.certifications ?? record.certifications?.length ?? 0,
    file: publicResumeFileMetadata(record.file),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function serializeResume(record) {
  return {
    id: record.id,
    title: record.title,
    summary: record.summary ?? null,
    templateKey: record.templateKey,
    isPrimary: record.isPrimary,
    fullName: record.fullName,
    email: record.email,
    phone: record.phone ?? null,
    location: record.location ?? null,
    education: (record.education ?? []).map((item) => ({
      id: item.id,
      institution: item.institution,
      qualification: item.qualification ?? null,
      fieldOfStudy: item.fieldOfStudy ?? null,
      startYear: item.startYear ?? null,
      endYear: item.endYear ?? null,
      notes: item.notes ?? null,
      sortOrder: item.sortOrder,
    })),
    experience: (record.experience ?? []).map((item) => ({
      id: item.id,
      jobTitle: item.jobTitle,
      organization: item.organization,
      location: item.location ?? null,
      startDate: formatDate(item.startDate),
      endDate: formatDate(item.endDate),
      isCurrent: item.isCurrent,
      description: item.description ?? null,
      sortOrder: item.sortOrder,
    })),
    skills: (record.skills ?? []).map((item) => ({
      id: item.id,
      skillId: item.skillId ?? null,
      label: item.label,
      proficiencyLevel: item.proficiencyLevel ?? null,
      skill: serializeSkillRef(item.skill),
      sortOrder: item.sortOrder,
    })),
    certifications: (record.certifications ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      issuer: item.issuer ?? null,
      year: item.year ?? null,
      credentialId: item.credentialId ?? null,
      sortOrder: item.sortOrder,
    })),
    file: publicResumeFileMetadata(record.file),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function lockUserRow(tx, userId) {
  const rows = await tx.$queryRaw`
    SELECT id, email, full_name AS "fullName", phone, location
    FROM users
    WHERE id = ${userId}::uuid
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

async function loadOwnedResume(tx, userId, resumeId) {
  return tx.resume.findFirst({
    where: { id: resumeId, userId },
    include: resumeInclude,
  });
}

async function replaceEducation(tx, resumeId, items) {
  await tx.resumeEducation.deleteMany({ where: { resumeId } });
  if (!items.length) {
    return;
  }
  await tx.resumeEducation.createMany({
    data: items.map((item, index) => ({
      resumeId,
      sortOrder: index,
      institution: item.institution,
      qualification: item.qualification ?? null,
      fieldOfStudy: item.fieldOfStudy ?? null,
      startYear: item.startYear ?? null,
      endYear: item.endYear ?? null,
      notes: item.notes ?? null,
    })),
  });
}

async function replaceExperience(tx, resumeId, items) {
  await tx.resumeExperience.deleteMany({ where: { resumeId } });
  if (!items.length) {
    return;
  }
  await tx.resumeExperience.createMany({
    data: items.map((item, index) => ({
      resumeId,
      sortOrder: index,
      jobTitle: item.jobTitle,
      organization: item.organization,
      location: item.location ?? null,
      startDate: parseIsoDate(item.startDate),
      endDate: parseIsoDate(item.endDate),
      isCurrent: item.isCurrent === true,
      description: item.description ?? null,
    })),
  });
}

async function replaceCertifications(tx, resumeId, items) {
  await tx.resumeCertification.deleteMany({ where: { resumeId } });
  if (!items.length) {
    return;
  }
  await tx.resumeCertification.createMany({
    data: items.map((item, index) => ({
      resumeId,
      sortOrder: index,
      name: item.name,
      issuer: item.issuer ?? null,
      year: item.year ?? null,
      credentialId: item.credentialId ?? null,
    })),
  });
}

async function replaceSkills(tx, resumeId, items) {
  const skillIds = [...new Set(items.map((item) => item.skillId).filter(Boolean))];
  const skills = skillIds.length
    ? await tx.skill.findMany({
        where: { id: { in: skillIds }, sourceSystem: 'ESCO' },
        select: skillSelect,
      })
    : [];
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  for (const skillId of skillIds) {
    if (!skillById.has(skillId)) {
      throw new ResumeError(404, 'Not found');
    }
  }

  await tx.resumeSkill.deleteMany({ where: { resumeId } });
  if (!items.length) {
    return;
  }

  await tx.resumeSkill.createMany({
    data: items.map((item, index) => {
      const catalog = item.skillId ? skillById.get(item.skillId) : null;
      const label = item.label ?? catalog?.preferredLabel ?? null;
      if (!label) {
        throw new ResumeError(400, 'Invalid request');
      }
      return {
        resumeId,
        sortOrder: index,
        skillId: item.skillId ?? null,
        label,
        proficiencyLevel: item.proficiencyLevel ?? null,
      };
    }),
  });
}

export async function listOwnedResumes(client, userId) {
  const rows = await client.resume.findMany({
    where: { userId },
    include: {
      file: true,
      _count: {
        select: {
          education: true,
          experience: true,
          skills: true,
          certifications: true,
        },
      },
    },
    orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(serializeResumeSummary);
}

export async function findOwnedResume(client, userId, resumeId) {
  const record = await client.resume.findFirst({
    where: { id: resumeId, userId },
    include: resumeInclude,
  });
  return record ? serializeResume(record) : null;
}

export async function createOwnedResume(client, userId, body) {
  try {
    return await client.$transaction(async (tx) => {
      const user = await lockUserRow(tx, userId);
      if (!user) {
        throw new ResumeError(401, 'Unauthenticated');
      }

      const count = await tx.resume.count({ where: { userId } });
      if (count >= MAX_RESUMES_PER_USER) {
        throw new ResumeError(409, RESUME_LIMIT_REACHED);
      }

      const created = await tx.resume.create({
        data: {
          userId,
          title: body.title,
          summary: body.summary === undefined ? null : body.summary,
          templateKey: body.templateKey ?? DEFAULT_RESUME_TEMPLATE,
          isPrimary: count === 0,
          fullName: body.fullName ?? user.fullName,
          email: body.email ?? user.email,
          phone: body.phone === undefined ? user.phone : body.phone,
          location: body.location === undefined ? user.location : body.location,
        },
        include: resumeInclude,
      });
      return serializeResume(created);
    });
  } catch (error) {
    if (error instanceof ResumeError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new ResumeError(409, RESUME_LIMIT_REACHED);
    }
    throw error;
  }
}

function resumeUpdateData(body) {
  const data = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.summary !== undefined) data.summary = body.summary;
  if (body.templateKey !== undefined) data.templateKey = body.templateKey;
  if (body.fullName !== undefined) data.fullName = body.fullName;
  if (body.email !== undefined) data.email = body.email;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.location !== undefined) data.location = body.location;
  return data;
}

export async function updateOwnedResume(client, userId, resumeId, body) {
  try {
    return await client.$transaction(async (tx) => {
      const user = await lockUserRow(tx, userId);
      if (!user) {
        throw new ResumeError(401, 'Unauthenticated');
      }

      const existing = await loadOwnedResume(tx, userId, resumeId);
      if (!existing) {
        throw new ResumeError(404, 'Not found');
      }

      const metadata = resumeUpdateData(body);
      if (Object.keys(metadata).length > 0) {
        await tx.resume.update({
          where: { id: existing.id },
          data: metadata,
        });
      }

      if (body.education !== undefined) {
        await replaceEducation(tx, existing.id, body.education);
      }
      if (body.experience !== undefined) {
        await replaceExperience(tx, existing.id, body.experience);
      }
      if (body.certifications !== undefined) {
        await replaceCertifications(tx, existing.id, body.certifications);
      }
      if (body.skills !== undefined) {
        await replaceSkills(tx, existing.id, body.skills);
      }

      const updated = await loadOwnedResume(tx, userId, resumeId);
      return serializeResume(updated);
    });
  } catch (error) {
    if (error instanceof ResumeError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new ResumeError(409, 'Already recorded');
    }
    throw error;
  }
}

export async function deleteOwnedResume(client, userId, resumeId, env = process.env) {
  const storedFile = await client.$transaction(async (tx) => {
    const user = await lockUserRow(tx, userId);
    if (!user) {
      throw new ResumeError(401, 'Unauthenticated');
    }

    const existing = await tx.resume.findFirst({
      where: { id: resumeId, userId },
      include: { file: true },
    });
    if (!existing) {
      throw new ResumeError(404, 'Not found');
    }

    await tx.resume.delete({ where: { id: existing.id } });
    return existing.file;
  });

  if (storedFile?.storedFilename) {
    try {
      await removeStoredResumeFile(userId, resumeId, storedFile.storedFilename, env);
      await cleanupOwnedResumeDir(userId, resumeId, null, env);
      await removeEmptyResumeDirs(userId, resumeId, env);
    } catch {
      // Database rows are already gone. Leftover owned files are not served
      // and can be removed by later cleanup of that resume directory.
    }
  }

  return { ok: true };
}

export async function setOwnedPrimaryResume(client, userId, resumeId) {
  try {
    return await client.$transaction(async (tx) => {
      const user = await lockUserRow(tx, userId);
      if (!user) {
        throw new ResumeError(401, 'Unauthenticated');
      }

      const existing = await loadOwnedResume(tx, userId, resumeId);
      if (!existing) {
        throw new ResumeError(404, 'Not found');
      }

      await tx.resume.updateMany({
        where: { userId, isPrimary: true, NOT: { id: existing.id } },
        data: { isPrimary: false },
      });
      if (!existing.isPrimary) {
        await tx.resume.update({
          where: { id: existing.id },
          data: { isPrimary: true },
        });
      }

      const updated = await loadOwnedResume(tx, userId, resumeId);
      return serializeResume(updated);
    });
  } catch (error) {
    if (error instanceof ResumeError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new ResumeError(409, 'Invalid request');
    }
    throw error;
  }
}
