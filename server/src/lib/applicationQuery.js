import { z } from 'zod';
import { normalizeLabelSearch, paginationMeta } from './escoQuery.js';
import { findCandidateJob, JobError, serializeJob } from './jobQuery.js';
import { generateResumePdf } from './resumePdf.js';
import { serializeResume } from './resumeQuery.js';
import { serializeUserSkill } from './userSkillQuery.js';
import { readStoredResumeFile } from './resumeStorage.js';
import { contentDispositionFor } from './resumeFileQuery.js';
import { pdfFilenameFromTitle } from './resumeViewModel.js';
import {
  APPLICATION_STORAGE_ENV,
  GENERATED_PDF_STORED_FILENAME,
  finalizeApplicationStorage,
  originalStoredFilenameFor,
  readApplicationFile,
  removeApplicationStaging,
  removeApplicationStorage,
  sha256Hex,
  writeApplicationStagingFiles,
} from './applicationStorage.js';
import {
  deleteNotificationsForApplication,
  notifyApplicationEvent,
} from './notificationQuery.js';

export { APPLICATION_STORAGE_ENV };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const APPLICATION_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'OFFERED',
  'REJECTED',
  'WITHDRAWN',
];

export const APPLICATION_ALREADY_EXISTS = 'You have already applied for this job';
export const APPLICATION_CANNOT_BE_WITHDRAWN = 'Application cannot be withdrawn';
export const APPLICATION_CANNOT_BE_UPDATED = 'Application cannot be updated';
export const APPLICATION_SUBMIT_FAILED = 'The application could not be submitted.';
export const COMPANY_PROFILE_REQUIRED = 'Company profile required';

export const EMPLOYER_APPLICATION_ACTIONS = {
  review: {
    toStatus: 'UNDER_REVIEW',
    fromStatuses: ['SUBMITTED'],
  },
  shortlist: {
    toStatus: 'SHORTLISTED',
    fromStatuses: ['SUBMITTED', 'UNDER_REVIEW'],
  },
  reject: {
    toStatus: 'REJECTED',
    fromStatuses: ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW'],
  },
  offer: {
    toStatus: 'OFFERED',
    fromStatuses: ['SHORTLISTED', 'INTERVIEW'],
  },
};

const APPLICATION_STATUS_ENUM = /** @type {[string, ...string[]]} */ (APPLICATION_STATUSES);

export class ApplicationError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApplicationError';
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

const optionalQueryString = z.preprocess(singleQueryValue, z.string().max(200).optional());

const pageQuery = z.preprocess((value) => {
  const normalized = singleQueryValue(value);
  return normalized === undefined ? '1' : normalized;
}, z.string().regex(/^[1-9]\d{0,6}$/).transform((value) => Number.parseInt(value, 10)));

const limitQuery = z.preprocess((value) => {
  const normalized = singleQueryValue(value);
  return normalized === undefined ? '20' : normalized;
}, z.string().regex(/^[1-9]\d{0,2}$/).transform((value) => Number.parseInt(value, 10)).refine((value) => value <= 50));

export const jobIdParamsSchema = z.object({
  jobId: z.string().regex(UUID_RE),
});

export const applicationIdParamsSchema = z.object({
  id: z.string().regex(UUID_RE),
});

export const submitApplicationBodySchema = z
  .object({
    resumeId: z.string().regex(UUID_RE),
  })
  .strict();

export const emptyApplicationBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z.object({}).strict(),
);

function emptyToNullNote(value) {
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

export const employerApplicationActionBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z
    .object({
      reviewNote: z.preprocess(
        emptyToNullNote,
        z.union([z.string().max(500), z.null()]).optional(),
      ),
    })
    .strict(),
);

export const candidateApplicationListQuerySchema = z.object({
  q: optionalQueryString,
  status: z.preprocess(singleQueryValue, z.enum(APPLICATION_STATUS_ENUM).optional()),
  jobId: z.preprocess(singleQueryValue, z.string().regex(UUID_RE).optional()),
  page: pageQuery,
  limit: limitQuery,
});

export const employerApplicationListQuerySchema = z.object({
  q: optionalQueryString,
  status: z.preprocess(singleQueryValue, z.enum(APPLICATION_STATUS_ENUM).optional()),
  jobId: z.preprocess(singleQueryValue, z.string().regex(UUID_RE).optional()),
  page: pageQuery,
  limit: limitQuery,
});

const resumeInclude = {
  education: { orderBy: { sortOrder: 'asc' } },
  experience: { orderBy: { sortOrder: 'asc' } },
  skills: {
    orderBy: { sortOrder: 'asc' },
    include: {
      skill: {
        select: {
          id: true,
          sourceUri: true,
          preferredLabel: true,
          skillType: true,
          sourceSystem: true,
        },
      },
    },
  },
  certifications: { orderBy: { sortOrder: 'asc' } },
  file: true,
};

const applicationJobInclude = {
  company: {
    select: {
      id: true,
      companyName: true,
      industry: true,
      location: true,
      website: true,
      description: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
  skills: {
    include: {
      skill: {
        select: {
          id: true,
          sourceUri: true,
          preferredLabel: true,
          skillType: true,
          sourceSystem: true,
        },
      },
    },
    orderBy: { skill: { preferredLabel: 'asc' } },
  },
};

const statusEventInclude = {
  actor: {
    select: {
      id: true,
      fullName: true,
    },
  },
};

const snapshotSelect = {
  id: true,
  resumeTitle: true,
  templateKey: true,
  generatedPdfFilename: true,
  generatedPdfContentType: true,
  generatedPdfSize: true,
  generatedPdfSha256: true,
  originalFileFilename: true,
  originalFileContentType: true,
  originalFileSize: true,
  originalFileSha256: true,
  originalFileStoredFilename: true,
  createdAt: true,
};

const applicationDetailInclude = {
  job: { include: applicationJobInclude },
  snapshot: { select: snapshotSelect },
  statusEvents: {
    include: statusEventInclude,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
  applicant: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      location: true,
      educationLevel: true,
      fieldOfStudy: true,
      institution: true,
      graduationYear: true,
      experienceSummary: true,
      skills: {
        include: {
          skill: {
            select: {
              id: true,
              sourceUri: true,
              preferredLabel: true,
              skillType: true,
              sourceSystem: true,
            },
          },
        },
        orderBy: { skill: { preferredLabel: 'asc' } },
      },
    },
  },
};

const applicationListInclude = {
  job: { include: applicationJobInclude },
  snapshot: { select: snapshotSelect },
  applicant: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      location: true,
      educationLevel: true,
      fieldOfStudy: true,
      institution: true,
      graduationYear: true,
      experienceSummary: true,
    },
  },
};

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

function wrapJobError(error) {
  if (error instanceof JobError) {
    throw new ApplicationError(error.status, error.message);
  }
  throw error;
}

async function requireStaffCompany(client, userId) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, companyId: true },
  });
  if (!user) {
    throw new ApplicationError(401, 'Unauthenticated');
  }
  if (!user.companyId) {
    throw new ApplicationError(403, COMPANY_PROFILE_REQUIRED);
  }
  return user;
}

function serializeSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }
  return {
    resumeTitle: snapshot.resumeTitle,
    templateKey: snapshot.templateKey,
    generatedPdfFilename: snapshot.generatedPdfFilename,
    generatedPdfContentType: snapshot.generatedPdfContentType,
    generatedPdfSize: snapshot.generatedPdfSize,
    generatedPdfSha256: snapshot.generatedPdfSha256,
    hasOriginalFile: Boolean(snapshot.originalFileStoredFilename),
    originalFileFilename: snapshot.originalFileFilename ?? null,
    originalFileContentType: snapshot.originalFileContentType ?? null,
    originalFileSize: snapshot.originalFileSize ?? null,
    originalFileSha256: snapshot.originalFileSha256 ?? null,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

function serializeStatusEvent(event, { includeReviewNote = false } = {}) {
  const serialized = {
    id: event.id,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor
      ? { id: event.actor.id, fullName: event.actor.fullName }
      : null,
  };
  if (includeReviewNote) {
    serialized.reviewNote = event.reviewNote ?? null;
  }
  return serialized;
}

function serializeApplicant(applicant) {
  if (!applicant) {
    return null;
  }
  return {
    id: applicant.id,
    fullName: applicant.fullName,
    email: applicant.email,
    phone: applicant.phone ?? null,
    location: applicant.location ?? null,
    educationLevel: applicant.educationLevel ?? null,
    fieldOfStudy: applicant.fieldOfStudy ?? null,
    institution: applicant.institution ?? null,
    graduationYear: applicant.graduationYear ?? null,
    experienceSummary: applicant.experienceSummary ?? null,
    skills: Array.isArray(applicant.skills)
      ? applicant.skills.map((skill) => serializeUserSkill(skill))
      : [],
  };
}

export function serializeApplication(record, { audience = 'candidate', includeEvents = false } = {}) {
  const application = {
    id: record.id,
    jobId: record.jobId,
    status: record.status,
    appliedAt: record.appliedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    selectedResumeId: record.selectedResumeId ?? null,
    job: record.job
      ? serializeJob(record.job, {
        audience: audience === 'employer' ? 'staff' : 'candidate',
      })
      : null,
    snapshot: serializeSnapshot(record.snapshot),
  };

  if (audience === 'employer') {
    application.applicant = serializeApplicant(record.applicant);
  }

  if (includeEvents) {
    application.statusEvents = (record.statusEvents ?? []).map((event) =>
      serializeStatusEvent(event, { includeReviewNote: audience === 'employer' }),
    );
  }

  return application;
}

function candidateListWhere(userId, query) {
  const where = { applicantUserId: userId };
  if (query.status) {
    where.status = query.status;
  }
  if (query.jobId) {
    where.jobId = query.jobId;
  }
  const search = normalizeLabelSearch(query.q);
  if (search) {
    where.job = {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { company: { companyName: { contains: search, mode: 'insensitive' } } },
      ],
    };
  }
  return where;
}

function employerListWhere(companyId, query) {
  const where = {
    job: {
      companyId,
    },
  };
  if (query.status) {
    where.status = query.status;
  }
  if (query.jobId) {
    where.jobId = query.jobId;
    where.job = {
      ...where.job,
      id: query.jobId,
    };
  }
  const search = normalizeLabelSearch(query.q);
  if (search) {
    where.OR = [
      { applicant: { fullName: { contains: search, mode: 'insensitive' } } },
      { applicant: { email: { contains: search, mode: 'insensitive' } } },
      { job: { title: { contains: search, mode: 'insensitive' } } },
    ];
  }
  return where;
}

async function loadOwnedResumeRecord(client, userId, resumeId) {
  return client.resume.findFirst({
    where: { id: resumeId, userId },
    include: resumeInclude,
  });
}

function isPdfBuffer(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 5
    && buffer.subarray(0, 4).toString('latin1') === '%PDF';
}

async function prepareSnapshotFiles(resume) {
  const structuredSnapshot = serializeResume(resume);
  let generatedPdf;
  try {
    generatedPdf = await generateResumePdf(structuredSnapshot);
  } catch {
    throw new ApplicationError(500, APPLICATION_SUBMIT_FAILED);
  }
  if (!isPdfBuffer(generatedPdf)) {
    throw new ApplicationError(500, APPLICATION_SUBMIT_FAILED);
  }

  const generatedPdfSha256 = sha256Hex(generatedPdf);
  const generatedPdfFilename = pdfFilenameFromTitle(resume.title);

  let originalBuffer = null;
  let originalStoredFilename = null;
  let originalMeta = {
    originalFileFilename: null,
    originalFileContentType: null,
    originalFileSize: null,
    originalFileSha256: null,
    originalFileStoredFilename: null,
  };

  if (resume.file) {
    originalBuffer = await readStoredResumeFile(resume.userId, resume.id, resume.file.storedFilename);
    if (!originalBuffer || originalBuffer.length !== resume.file.byteSize) {
      throw new ApplicationError(500, APPLICATION_SUBMIT_FAILED);
    }
    const originalSha256 = sha256Hex(originalBuffer);
    if (originalSha256 !== resume.file.sha256) {
      throw new ApplicationError(500, APPLICATION_SUBMIT_FAILED);
    }
    originalStoredFilename = originalStoredFilenameFor(resume.file.contentType, resume.file.originalFilename);
    originalMeta = {
      originalFileFilename: resume.file.originalFilename,
      originalFileContentType: resume.file.contentType,
      originalFileSize: resume.file.byteSize,
      originalFileSha256: originalSha256,
      originalFileStoredFilename: originalStoredFilename,
    };
  }

  return {
    structuredSnapshot,
    generatedPdf,
    generatedPdfFilename,
    generatedPdfSha256,
    generatedPdfSize: generatedPdf.length,
    originalBuffer,
    originalStoredFilename,
    originalSha256: originalMeta.originalFileSha256,
    originalMeta,
  };
}

async function loadApplicationDetail(client, where) {
  return client.application.findFirst({
    where,
    include: applicationDetailInclude,
  });
}

export async function submitOwnedApplication(client, userId, jobId, resumeId, env = process.env) {
  try {
    await findCandidateJob(client, jobId);
  } catch (error) {
    wrapJobError(error);
  }

  const existing = await client.application.findUnique({
    where: {
      jobId_applicantUserId: {
        jobId,
        applicantUserId: userId,
      },
    },
    select: { id: true },
  });
  if (existing) {
    throw new ApplicationError(409, APPLICATION_ALREADY_EXISTS);
  }

  const resume = await loadOwnedResumeRecord(client, userId, resumeId);
  if (!resume) {
    throw new ApplicationError(404, 'Not found');
  }

  const prepared = await prepareSnapshotFiles(resume);
  const staging = await writeApplicationStagingFiles({
    generatedPdf: prepared.generatedPdf,
    generatedPdfSha256: prepared.generatedPdfSha256,
    originalBuffer: prepared.originalBuffer,
    originalStoredFilename: prepared.originalStoredFilename,
    originalSha256: prepared.originalSha256,
  }, env);

  let createdId = null;
  try {
    const created = await client.$transaction(async (tx) => {
      try {
        await findCandidateJob(tx, jobId);
      } catch (error) {
        wrapJobError(error);
      }

      const ownedResume = await loadOwnedResumeRecord(tx, userId, resumeId);
      if (!ownedResume) {
        throw new ApplicationError(404, 'Not found');
      }

      try {
        const application = await tx.application.create({
          data: {
            jobId,
            applicantUserId: userId,
            selectedResumeId: ownedResume.id,
            status: 'SUBMITTED',
          },
        });
        await tx.applicationResumeSnapshot.create({
          data: {
            applicationId: application.id,
            resumeTitle: ownedResume.title,
            templateKey: ownedResume.templateKey,
            structuredSnapshot: prepared.structuredSnapshot,
            generatedPdfFilename: prepared.generatedPdfFilename,
            generatedPdfContentType: 'application/pdf',
            generatedPdfSize: prepared.generatedPdfSize,
            generatedPdfSha256: prepared.generatedPdfSha256,
            ...prepared.originalMeta,
          },
        });
        const statusEvent = await tx.applicationStatusEvent.create({
          data: {
            applicationId: application.id,
            fromStatus: null,
            toStatus: 'SUBMITTED',
            actorUserId: userId,
          },
        });
        await notifyApplicationEvent(tx, {
          event: statusEvent,
          application,
          actorUserId: userId,
        });
        return application;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ApplicationError(409, APPLICATION_ALREADY_EXISTS);
        }
        throw error;
      }
    });

    createdId = created.id;
    try {
      await finalizeApplicationStorage(staging.stagingId, created.id, env);
    } catch (error) {
      await deleteNotificationsForApplication(client, created.id).catch(() => {});
      await client.application.delete({ where: { id: created.id } }).catch(() => {});
      await removeApplicationStorage(created.id, env).catch(() => {});
      throw error;
    }

    const record = await loadApplicationDetail(client, { id: created.id, applicantUserId: userId });
    return serializeApplication(record, { audience: 'candidate', includeEvents: true });
  } catch (error) {
    await removeApplicationStaging(staging.stagingId, env).catch(() => {});
    if (createdId) {
      await removeApplicationStorage(createdId, env).catch(() => {});
    }
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw new ApplicationError(500, APPLICATION_SUBMIT_FAILED);
  }
}

export async function listOwnedApplications(client, userId, query) {
  const where = candidateListWhere(userId, query);
  const skip = (query.page - 1) * query.limit;
  const [total, records] = await Promise.all([
    client.application.count({ where }),
    client.application.findMany({
      where,
      include: applicationListInclude,
      orderBy: [{ appliedAt: 'desc' }, { id: 'desc' }],
      skip,
      take: query.limit,
    }),
  ]);
  return {
    applications: records.map((record) => serializeApplication(record, { audience: 'candidate' })),
    ...paginationMeta(query.page, query.limit, total),
  };
}

export async function findOwnedApplication(client, userId, applicationId) {
  const record = await loadApplicationDetail(client, {
    id: applicationId,
    applicantUserId: userId,
  });
  if (!record) {
    throw new ApplicationError(404, 'Not found');
  }
  return serializeApplication(record, { audience: 'candidate', includeEvents: true });
}

export async function withdrawOwnedApplication(client, userId, applicationId) {
  return client.$transaction(async (tx) => {
    const existing = await tx.application.findFirst({
      where: { id: applicationId, applicantUserId: userId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new ApplicationError(404, 'Not found');
    }
    if (existing.status !== 'SUBMITTED') {
      throw new ApplicationError(409, APPLICATION_CANNOT_BE_WITHDRAWN);
    }

    const updated = await tx.application.updateMany({
      where: { id: existing.id, applicantUserId: userId, status: 'SUBMITTED' },
      data: { status: 'WITHDRAWN' },
    });
    if (updated.count !== 1) {
      throw new ApplicationError(409, APPLICATION_CANNOT_BE_WITHDRAWN);
    }

    await tx.applicationStatusEvent.create({
      data: {
        applicationId: existing.id,
        fromStatus: 'SUBMITTED',
        toStatus: 'WITHDRAWN',
        actorUserId: userId,
      },
    });

    const record = await tx.application.findFirst({
      where: { id: existing.id, applicantUserId: userId },
      include: applicationDetailInclude,
    });
    return serializeApplication(record, { audience: 'candidate', includeEvents: true });
  });
}

export async function listCompanyApplications(client, userId, query) {
  const user = await requireStaffCompany(client, userId);
  const where = employerListWhere(user.companyId, query);
  const skip = (query.page - 1) * query.limit;
  const [total, records] = await Promise.all([
    client.application.count({ where }),
    client.application.findMany({
      where,
      include: applicationListInclude,
      orderBy: [{ appliedAt: 'desc' }, { id: 'desc' }],
      skip,
      take: query.limit,
    }),
  ]);
  return {
    applications: records.map((record) => serializeApplication(record, { audience: 'employer' })),
    ...paginationMeta(query.page, query.limit, total),
  };
}

export async function findCompanyApplication(client, userId, applicationId) {
  const user = await requireStaffCompany(client, userId);
  const record = await loadApplicationDetail(client, {
    id: applicationId,
    job: { companyId: user.companyId },
  });
  if (!record) {
    throw new ApplicationError(404, 'Not found');
  }
  return serializeApplication(record, { audience: 'employer', includeEvents: true });
}

function emptyStatusCounts() {
  return Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0]));
}

function statusCountsFromGroup(rows) {
  const byStatus = emptyStatusCounts();
  for (const row of rows) {
    byStatus[row.status] = row._count._all;
  }
  return byStatus;
}

export async function transitionCompanyApplication(client, userId, applicationId, action, body = {}) {
  const spec = EMPLOYER_APPLICATION_ACTIONS[action];
  if (!spec) {
    throw new ApplicationError(400, 'Invalid request');
  }

  const user = await requireStaffCompany(client, userId);
  const reviewNote = body.reviewNote === undefined ? null : body.reviewNote;

  return client.$transaction(async (tx) => {
    const existing = await tx.application.findFirst({
      where: {
        id: applicationId,
        job: { companyId: user.companyId },
      },
      select: { id: true, status: true, jobId: true, applicantUserId: true },
    });
    if (!existing) {
      throw new ApplicationError(404, 'Not found');
    }
    if (!spec.fromStatuses.includes(existing.status)) {
      throw new ApplicationError(409, APPLICATION_CANNOT_BE_UPDATED);
    }

    const updated = await tx.application.updateMany({
      where: {
        id: existing.id,
        status: { in: spec.fromStatuses },
        job: { companyId: user.companyId },
      },
      data: { status: spec.toStatus },
    });
    if (updated.count !== 1) {
      throw new ApplicationError(409, APPLICATION_CANNOT_BE_UPDATED);
    }

    const statusEvent = await tx.applicationStatusEvent.create({
      data: {
        applicationId: existing.id,
        fromStatus: existing.status,
        toStatus: spec.toStatus,
        actorUserId: user.id,
        reviewNote,
      },
    });
    await notifyApplicationEvent(tx, {
      event: statusEvent,
      application: existing,
      actorUserId: user.id,
    });

    const record = await tx.application.findFirst({
      where: {
        id: existing.id,
        job: { companyId: user.companyId },
      },
      include: applicationDetailInclude,
    });
    return serializeApplication(record, { audience: 'employer', includeEvents: true });
  });
}

export async function listCompanyApplicationStats(client, userId) {
  const user = await requireStaffCompany(client, userId);
  const where = { job: { companyId: user.companyId } };
  const [total, grouped, jobs] = await Promise.all([
    client.application.count({ where }),
    client.application.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    client.job.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        title: true,
        status: true,
        _count: { select: { applications: true } },
      },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    }),
  ]);

  return {
    total,
    byStatus: statusCountsFromGroup(grouped),
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      applicationCount: job._count.applications,
    })),
  };
}

export async function listAdminApplicationStats(client) {
  const [total, grouped, companiesWithApplications] = await Promise.all([
    client.application.count(),
    client.application.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    client.company.count({
      where: {
        jobs: {
          some: {
            applications: { some: {} },
          },
        },
      },
    }),
  ]);

  return {
    total,
    byStatus: statusCountsFromGroup(grouped),
    companiesWithApplications,
  };
}

async function loadSnapshotForDownload(client, where) {
  const record = await client.application.findFirst({
    where,
    include: {
      snapshot: true,
    },
  });
  if (!record?.snapshot) {
    throw new ApplicationError(404, 'Not found');
  }
  return record;
}

function sendBinary(res, buffer, contentType, filename) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Content-Disposition', contentDispositionFor(filename));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(buffer);
}

async function sendGeneratedPdf(record, res, env) {
  const buffer = await readApplicationFile(record.id, GENERATED_PDF_STORED_FILENAME, env);
  if (!buffer || sha256Hex(buffer) !== record.snapshot.generatedPdfSha256) {
    throw new ApplicationError(500, APPLICATION_SUBMIT_FAILED);
  }
  sendBinary(
    res,
    buffer,
    record.snapshot.generatedPdfContentType || 'application/pdf',
    record.snapshot.generatedPdfFilename,
  );
}

async function sendOriginalFile(record, res, env) {
  if (!record.snapshot.originalFileStoredFilename) {
    throw new ApplicationError(404, 'Not found');
  }
  const buffer = await readApplicationFile(record.id, record.snapshot.originalFileStoredFilename, env);
  if (!buffer || sha256Hex(buffer) !== record.snapshot.originalFileSha256) {
    throw new ApplicationError(500, APPLICATION_SUBMIT_FAILED);
  }
  sendBinary(
    res,
    buffer,
    record.snapshot.originalFileContentType,
    record.snapshot.originalFileFilename || record.snapshot.originalFileStoredFilename,
  );
}

export async function sendOwnedApplicationPdf(client, userId, applicationId, res, env = process.env) {
  const record = await loadSnapshotForDownload(client, {
    id: applicationId,
    applicantUserId: userId,
  });
  await sendGeneratedPdf(record, res, env);
}

export async function sendCompanyApplicationPdf(client, userId, applicationId, res, env = process.env) {
  const user = await requireStaffCompany(client, userId);
  const record = await loadSnapshotForDownload(client, {
    id: applicationId,
    job: { companyId: user.companyId },
  });
  await sendGeneratedPdf(record, res, env);
}

export async function sendCompanyApplicationOriginal(client, userId, applicationId, res, env = process.env) {
  const user = await requireStaffCompany(client, userId);
  const record = await loadSnapshotForDownload(client, {
    id: applicationId,
    job: { companyId: user.companyId },
  });
  await sendOriginalFile(record, res, env);
}
