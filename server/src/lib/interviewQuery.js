import { z } from 'zod';
import { paginationMeta } from './escoQuery.js';
import { COMPANY_PROFILE_REQUIRED } from './jobQuery.js';
import { notifyInterviewEvent } from './notificationQuery.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const INTERVIEW_STATUSES = [
  'PROPOSED',
  'RESCHEDULE_REQUESTED',
  'CONFIRMED',
  'DECLINED',
  'COMPLETED',
  'CANCELLED',
];

export const INTERVIEW_TYPES = ['ONLINE', 'ONSITE', 'PHONE'];
export const INTERVIEW_ATTENDANCES = ['ATTENDED', 'NO_SHOW'];
export const INTERVIEW_OUTCOMES = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];
export const ACTIVE_INTERVIEW_STATUSES = ['PROPOSED', 'RESCHEDULE_REQUESTED', 'CONFIRMED'];
export const CREATE_ELIGIBLE_APPLICATION_STATUSES = ['SHORTLISTED', 'INTERVIEW'];

export const DEFAULT_INTERVIEW_TIMEZONE = 'Asia/Kuala_Lumpur';
export const INTERVIEW_CANNOT_BE_UPDATED = 'Interview cannot be updated';
export const INTERVIEW_CANNOT_BE_CREATED = 'Interview cannot be created';

const INTERVIEW_STATUS_ENUM = /** @type {[string, ...string[]]} */ (INTERVIEW_STATUSES);
const INTERVIEW_TYPE_ENUM = /** @type {[string, ...string[]]} */ (INTERVIEW_TYPES);
const INTERVIEW_ATTENDANCE_ENUM = /** @type {[string, ...string[]]} */ (INTERVIEW_ATTENDANCES);
const INTERVIEW_OUTCOME_ENUM = /** @type {[string, ...string[]]} */ (INTERVIEW_OUTCOMES);

const TITLE_MAX = 200;
const INSTRUCTIONS_MAX = 2000;
const NOTES_MAX = 2000;
const RESPONSE_NOTE_MAX = 500;
const VENUE_MAX = 500;
const MEETING_LINK_MAX = 2000;
const TIMEZONE_MAX = 64;
const DURATION_MIN = 15;
const DURATION_MAX = 240;

const CANDIDATE_LOCATION_STATUSES = new Set([
  'PROPOSED',
  'RESCHEDULE_REQUESTED',
  'CONFIRMED',
  'COMPLETED',
]);

const PRIVATE_EVENT_DETAIL_KEYS = new Set(['attendance', 'outcome', 'employerNotes']);

export class InterviewError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'InterviewError';
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

const optionalNote = (max) => z.preprocess(
  emptyToNull,
  z.union([z.string().max(max), z.null()]).optional(),
);

function isParseableDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isFutureDateString(value) {
  if (!isParseableDate(value)) {
    return false;
  }
  return Date.parse(value) > Date.now();
}

const requiredFutureDateTime = z.string().refine(isFutureDateString);
const optionalFutureDateTime = z.preprocess(
  emptyToNull,
  z.union([z.string().refine(isFutureDateString), z.null()]).optional(),
);

const durationSchema = z.number().int().min(DURATION_MIN).max(DURATION_MAX);
const optionalDuration = z.preprocess(
  (value) => (value === null ? undefined : value),
  durationSchema.optional(),
);

const timezoneSchema = z.string().trim().min(1).max(TIMEZONE_MAX).regex(/^[A-Za-z0-9_+\-/]+$/);
function isHttpsMeetingLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && Boolean(url.hostname);
  } catch {
    return false;
  }
}

const meetingLinkSchema = z
  .string()
  .trim()
  .min(8)
  .max(MEETING_LINK_MAX)
  .refine((value) => isHttpsMeetingLink(value));
const optionalMeetingLink = z.preprocess(emptyToNull, z.union([meetingLinkSchema, z.null()]).optional());
const optionalVenue = z.preprocess(emptyToNull, z.union([z.string().trim().min(1).max(VENUE_MAX), z.null()]).optional());

function locationRefine(body, ctx) {
  const type = body.interviewType;
  if (type === 'ONLINE' && !body.meetingLink) {
    ctx.addIssue({ code: 'custom', path: ['meetingLink'], message: 'required' });
  }
  if (type === 'ONSITE' && !body.venue) {
    ctx.addIssue({ code: 'custom', path: ['venue'], message: 'required' });
  }
}

export const interviewIdParamsSchema = z.object({
  id: z.string().regex(UUID_RE),
});

export const interviewListQuerySchema = z.object({
  status: z.preprocess(singleQueryValue, z.enum(INTERVIEW_STATUS_ENUM).optional()),
  jobId: z.preprocess(singleQueryValue, z.string().regex(UUID_RE).optional()),
  applicationId: z.preprocess(singleQueryValue, z.string().regex(UUID_RE).optional()),
  page: pageQuery,
  limit: limitQuery,
});

export const emptyInterviewBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z.object({}).strict(),
);

export const createInterviewBodySchema = z
  .object({
    applicationId: z.string().regex(UUID_RE),
    title: z.preprocess(emptyToNull, z.union([z.string().trim().min(1).max(TITLE_MAX), z.null()]).optional()),
    interviewType: z.enum(INTERVIEW_TYPE_ENUM),
    scheduledStartAt: requiredFutureDateTime,
    durationMinutes: durationSchema,
    timezone: timezoneSchema.optional(),
    meetingLink: optionalMeetingLink,
    venue: optionalVenue,
    instructions: optionalNote(INSTRUCTIONS_MAX),
    employerNotes: optionalNote(NOTES_MAX),
  })
  .strict()
  .superRefine(locationRefine);

export const updateScheduleBodySchema = z
  .object({
    interviewType: z.enum(INTERVIEW_TYPE_ENUM).optional(),
    scheduledStartAt: requiredFutureDateTime,
    durationMinutes: optionalDuration,
    timezone: timezoneSchema.optional(),
    meetingLink: optionalMeetingLink,
    venue: optionalVenue,
    instructions: optionalNote(INSTRUCTIONS_MAX),
  })
  .strict();

export const declineInterviewBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z
    .object({
      candidateResponseNote: optionalNote(RESPONSE_NOTE_MAX),
    })
    .strict(),
);

export const rescheduleInterviewBodySchema = z
  .object({
    requestedStartAt: requiredFutureDateTime,
    requestedDurationMinutes: optionalDuration,
    candidateResponseNote: optionalNote(RESPONSE_NOTE_MAX),
  })
  .strict();

export const completeInterviewBodySchema = z
  .object({
    attendance: z.enum(INTERVIEW_ATTENDANCE_ENUM),
    outcome: z.preprocess(
      emptyToNull,
      z.union([z.enum(INTERVIEW_OUTCOME_ENUM), z.null()]).optional(),
    ),
    employerNotes: optionalNote(NOTES_MAX),
  })
  .strict();

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

async function requireStaffCompany(client, userId) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, companyId: true },
  });
  if (!user) {
    throw new InterviewError(401, 'Unauthenticated');
  }
  if (!user.companyId) {
    throw new InterviewError(403, COMPANY_PROFILE_REQUIRED);
  }
  return user;
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function snapshotSchedule(record) {
  return {
    scheduledStartAt: iso(record.scheduledStartAt),
    durationMinutes: record.durationMinutes,
    timezone: record.timezone,
    requestedStartAt: iso(record.requestedStartAt),
    requestedDurationMinutes: record.requestedDurationMinutes ?? null,
    interviewType: record.interviewType,
  };
}

function filterEventDetails(details, audience) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return details ?? null;
  }
  if (audience !== 'candidate') {
    return details;
  }
  const filtered = { ...details };
  for (const key of PRIVATE_EVENT_DETAIL_KEYS) {
    delete filtered[key];
  }
  return filtered;
}

function serializeEvent(event, { audience = 'employer' } = {}) {
  return {
    id: event.id,
    eventType: event.eventType,
    previousStatus: event.previousStatus ?? null,
    newStatus: event.newStatus,
    eventDetails: filterEventDetails(event.eventDetails, audience),
    createdAt: event.createdAt.toISOString(),
    actor: event.actor ? { id: event.actor.id, fullName: event.actor.fullName } : null,
  };
}

function serializeJobSummary(job) {
  if (!job) {
    return null;
  }
  return {
    id: job.id,
    title: job.title,
    status: job.status,
    company: job.company
      ? {
        id: job.company.id,
        companyName: job.company.companyName,
        location: job.company.location ?? null,
      }
      : null,
  };
}

function canShowLocation(status, audience) {
  if (audience !== 'candidate') {
    return true;
  }
  return CANDIDATE_LOCATION_STATUSES.has(status);
}

export function serializeInterview(record, { audience = 'employer', includeEvents = false } = {}) {
  const showLocation = canShowLocation(record.status, audience);
  const interview = {
    id: record.id,
    applicationId: record.applicationId,
    jobId: record.jobId,
    candidateUserId: record.candidateUserId,
    roundNumber: record.roundNumber,
    title: record.title,
    interviewType: record.interviewType,
    status: record.status,
    scheduledStartAt: iso(record.scheduledStartAt),
    durationMinutes: record.durationMinutes,
    timezone: record.timezone,
    meetingLink: showLocation ? record.meetingLink ?? null : null,
    venue: showLocation ? record.venue ?? null : null,
    instructions: record.instructions ?? null,
    candidateResponseNote: record.candidateResponseNote ?? null,
    requestedStartAt: iso(record.requestedStartAt),
    requestedDurationMinutes: record.requestedDurationMinutes ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    application: record.application
      ? { id: record.application.id, status: record.application.status }
      : null,
    job: serializeJobSummary(record.job),
  };

  if (audience === 'employer') {
    interview.companyId = record.companyId;
    interview.createdByUserId = record.createdByUserId;
    interview.employerNotes = record.employerNotes ?? null;
    interview.attendance = record.attendance ?? null;
    interview.outcome = record.outcome ?? null;
    interview.candidate = record.candidate
      ? {
        id: record.candidate.id,
        fullName: record.candidate.fullName,
        email: record.candidate.email,
      }
      : null;
    interview.createdBy = record.createdBy
      ? { id: record.createdBy.id, fullName: record.createdBy.fullName }
      : null;
  }

  if (includeEvents) {
    interview.events = (record.events ?? []).map((event) => serializeEvent(event, { audience }));
  }

  return interview;
}

const interviewActorSelect = {
  id: true,
  fullName: true,
};

const interviewListInclude = {
  job: {
    select: {
      id: true,
      title: true,
      status: true,
      company: { select: { id: true, companyName: true, location: true } },
    },
  },
  application: { select: { id: true, status: true } },
  candidate: { select: { id: true, fullName: true, email: true } },
  createdBy: { select: interviewActorSelect },
};

const interviewDetailInclude = {
  ...interviewListInclude,
  events: {
    include: { actor: { select: interviewActorSelect } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
};

function listWhere(scope, query) {
  const where = { ...scope };
  if (query.status) {
    where.status = query.status;
  }
  if (query.jobId) {
    where.jobId = query.jobId;
  }
  if (query.applicationId) {
    where.applicationId = query.applicationId;
  }
  return where;
}

async function listInterviews(client, where, query, audience) {
  const skip = (query.page - 1) * query.limit;
  const [total, records] = await Promise.all([
    client.interview.count({ where }),
    client.interview.findMany({
      where,
      include: interviewListInclude,
      orderBy: [{ scheduledStartAt: 'asc' }, { id: 'asc' }],
      skip,
      take: query.limit,
    }),
  ]);
  return {
    interviews: records.map((record) => serializeInterview(record, { audience })),
    ...paginationMeta(query.page, query.limit, total),
  };
}

async function loadInterview(client, where) {
  return client.interview.findFirst({
    where,
    include: interviewDetailInclude,
  });
}

function emptyStatusCounts() {
  return Object.fromEntries(INTERVIEW_STATUSES.map((status) => [status, 0]));
}

function statusCountsFromGroup(rows) {
  const byStatus = emptyStatusCounts();
  for (const row of rows) {
    byStatus[row.status] = row._count._all;
  }
  return byStatus;
}

function assertTypeLocation(type, meetingLink, venue) {
  if (type === 'ONLINE' && !meetingLink) {
    throw new InterviewError(400, 'Invalid request');
  }
  if (type === 'ONSITE' && !venue) {
    throw new InterviewError(400, 'Invalid request');
  }
}

async function maybePromoteApplicationToInterview(tx, { applicationId, companyId, actorUserId }) {
  const application = await tx.application.findFirst({
    where: { id: applicationId, job: { companyId } },
    select: { id: true, status: true },
  });
  if (!application) {
    throw new InterviewError(404, 'Not found');
  }
  if (application.status !== 'SHORTLISTED') {
    return;
  }
  const updated = await tx.application.updateMany({
    where: {
      id: application.id,
      status: 'SHORTLISTED',
      job: { companyId },
    },
    data: { status: 'INTERVIEW' },
  });
  if (updated.count !== 1) {
    return;
  }
  await tx.applicationStatusEvent.create({
    data: {
      applicationId: application.id,
      fromStatus: 'SHORTLISTED',
      toStatus: 'INTERVIEW',
      actorUserId,
    },
  });
}

async function writeTransition(tx, {
  interview,
  actorUserId,
  fromStatuses,
  toStatus,
  eventType,
  data = {},
  eventDetails = {},
  promoteApplication = false,
}) {
  const updated = await tx.interview.updateMany({
    where: {
      id: interview.id,
      status: { in: fromStatuses },
    },
    data: {
      status: toStatus,
      ...data,
    },
  });
  if (updated.count !== 1) {
    throw new InterviewError(409, INTERVIEW_CANNOT_BE_UPDATED);
  }
  const event = await tx.interviewEvent.create({
    data: {
      interviewId: interview.id,
      actorUserId,
      eventType,
      previousStatus: interview.status,
      newStatus: toStatus,
      eventDetails: {
        ...snapshotSchedule(interview),
        ...eventDetails,
      },
    },
  });
  if (promoteApplication && toStatus === 'CONFIRMED') {
    await maybePromoteApplicationToInterview(tx, {
      applicationId: interview.applicationId,
      companyId: interview.companyId,
      actorUserId,
    });
  }
  await notifyInterviewEvent(tx, {
    event,
    interview,
    actorUserId,
  });
  return loadInterview(tx, { id: interview.id });
}

export async function createCompanyInterview(client, userId, body) {
  const user = await requireStaffCompany(client, userId);
  const scheduledStartAt = new Date(body.scheduledStartAt);
  const meetingLink = body.meetingLink ?? null;
  const venue = body.venue ?? null;
  assertTypeLocation(body.interviewType, meetingLink, venue);

  try {
    return await client.$transaction(async (tx) => {
      const application = await tx.application.findFirst({
        where: {
          id: body.applicationId,
          job: { companyId: user.companyId },
        },
        include: {
          job: { select: { id: true, title: true, companyId: true } },
        },
      });
      if (!application) {
        throw new InterviewError(404, 'Not found');
      }
      if (!CREATE_ELIGIBLE_APPLICATION_STATUSES.includes(application.status)) {
        throw new InterviewError(409, INTERVIEW_CANNOT_BE_CREATED);
      }

      const active = await tx.interview.findFirst({
        where: {
          applicationId: application.id,
          status: { in: ACTIVE_INTERVIEW_STATUSES },
        },
        select: { id: true },
      });
      if (active) {
        throw new InterviewError(409, INTERVIEW_CANNOT_BE_CREATED);
      }

      const aggregate = await tx.interview.aggregate({
        where: { applicationId: application.id },
        _max: { roundNumber: true },
      });
      const roundNumber = (aggregate._max.roundNumber || 0) + 1;
      const title = body.title || `${application.job.title} interview`;

      const created = await tx.interview.create({
        data: {
          applicationId: application.id,
          jobId: application.jobId,
          companyId: application.job.companyId,
          candidateUserId: application.applicantUserId,
          createdByUserId: user.id,
          roundNumber,
          title,
          interviewType: body.interviewType,
          status: 'PROPOSED',
          scheduledStartAt,
          durationMinutes: body.durationMinutes,
          timezone: body.timezone || DEFAULT_INTERVIEW_TIMEZONE,
          meetingLink,
          venue,
          instructions: body.instructions ?? null,
          employerNotes: body.employerNotes ?? null,
        },
      });

      const event = await tx.interviewEvent.create({
        data: {
          interviewId: created.id,
          actorUserId: user.id,
          eventType: 'CREATED',
          previousStatus: null,
          newStatus: 'PROPOSED',
          eventDetails: snapshotSchedule(created),
        },
      });
      await notifyInterviewEvent(tx, {
        event,
        interview: created,
        actorUserId: user.id,
      });

      return serializeInterview(await loadInterview(tx, { id: created.id }), {
        audience: 'employer',
        includeEvents: true,
      });
    });
  } catch (error) {
    if (error instanceof InterviewError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new InterviewError(409, INTERVIEW_CANNOT_BE_CREATED);
    }
    throw error;
  }
}

export async function listCompanyInterviews(client, userId, query) {
  const user = await requireStaffCompany(client, userId);
  return listInterviews(client, listWhere({ companyId: user.companyId }, query), query, 'employer');
}

export async function findCompanyInterview(client, userId, interviewId) {
  const user = await requireStaffCompany(client, userId);
  const record = await loadInterview(client, { id: interviewId, companyId: user.companyId });
  if (!record) {
    throw new InterviewError(404, 'Not found');
  }
  return serializeInterview(record, { audience: 'employer', includeEvents: true });
}

export async function listCompanyInterviewStats(client, userId) {
  const user = await requireStaffCompany(client, userId);
  const where = { companyId: user.companyId };
  const now = new Date();
  const [total, grouped, upcomingConfirmed] = await Promise.all([
    client.interview.count({ where }),
    client.interview.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    client.interview.count({
      where: {
        ...where,
        status: 'CONFIRMED',
        scheduledStartAt: { gte: now },
      },
    }),
  ]);
  return {
    total,
    byStatus: statusCountsFromGroup(grouped),
    upcomingConfirmed,
  };
}

export async function updateCompanyInterviewSchedule(client, userId, interviewId, body) {
  const user = await requireStaffCompany(client, userId);
  const scheduledStartAt = new Date(body.scheduledStartAt);

  return client.$transaction(async (tx) => {
    const interview = await tx.interview.findFirst({
      where: { id: interviewId, companyId: user.companyId },
    });
    if (!interview) {
      throw new InterviewError(404, 'Not found');
    }
    if (!['PROPOSED', 'RESCHEDULE_REQUESTED'].includes(interview.status)) {
      throw new InterviewError(409, INTERVIEW_CANNOT_BE_UPDATED);
    }

    const interviewType = body.interviewType || interview.interviewType;
    const durationMinutes = body.durationMinutes ?? interview.durationMinutes;
    const timezone = body.timezone || interview.timezone;
    const meetingLink = body.meetingLink !== undefined ? body.meetingLink : interview.meetingLink;
    const venue = body.venue !== undefined ? body.venue : interview.venue;
    const instructions = body.instructions !== undefined ? body.instructions : interview.instructions;
    assertTypeLocation(interviewType, meetingLink, venue);

    const record = await writeTransition(tx, {
      interview,
      actorUserId: user.id,
      fromStatuses: ['PROPOSED', 'RESCHEDULE_REQUESTED'],
      toStatus: 'PROPOSED',
      eventType: 'SCHEDULE_UPDATED',
      data: {
        interviewType,
        scheduledStartAt,
        durationMinutes,
        timezone,
        meetingLink,
        venue,
        instructions,
        requestedStartAt: null,
        requestedDurationMinutes: null,
      },
    });
    return serializeInterview(record, { audience: 'employer', includeEvents: true });
  });
}

export async function confirmCompanyInterviewReschedule(client, userId, interviewId) {
  const user = await requireStaffCompany(client, userId);
  return client.$transaction(async (tx) => {
    const interview = await tx.interview.findFirst({
      where: { id: interviewId, companyId: user.companyId },
    });
    if (!interview) {
      throw new InterviewError(404, 'Not found');
    }
    if (interview.status !== 'RESCHEDULE_REQUESTED' || !interview.requestedStartAt) {
      throw new InterviewError(409, INTERVIEW_CANNOT_BE_UPDATED);
    }

    const record = await writeTransition(tx, {
      interview,
      actorUserId: user.id,
      fromStatuses: ['RESCHEDULE_REQUESTED'],
      toStatus: 'CONFIRMED',
      eventType: 'RESCHEDULE_CONFIRMED',
      data: {
        scheduledStartAt: interview.requestedStartAt,
        durationMinutes: interview.requestedDurationMinutes ?? interview.durationMinutes,
        requestedStartAt: null,
        requestedDurationMinutes: null,
      },
      promoteApplication: true,
    });
    return serializeInterview(record, { audience: 'employer', includeEvents: true });
  });
}

export async function cancelCompanyInterview(client, userId, interviewId) {
  const user = await requireStaffCompany(client, userId);
  return client.$transaction(async (tx) => {
    const interview = await tx.interview.findFirst({
      where: { id: interviewId, companyId: user.companyId },
    });
    if (!interview) {
      throw new InterviewError(404, 'Not found');
    }
    if (!ACTIVE_INTERVIEW_STATUSES.includes(interview.status)) {
      throw new InterviewError(409, INTERVIEW_CANNOT_BE_UPDATED);
    }

    const record = await writeTransition(tx, {
      interview,
      actorUserId: user.id,
      fromStatuses: ACTIVE_INTERVIEW_STATUSES,
      toStatus: 'CANCELLED',
      eventType: 'CANCELLED',
    });
    return serializeInterview(record, { audience: 'employer', includeEvents: true });
  });
}

export async function completeCompanyInterview(client, userId, interviewId, body) {
  const user = await requireStaffCompany(client, userId);
  return client.$transaction(async (tx) => {
    const interview = await tx.interview.findFirst({
      where: { id: interviewId, companyId: user.companyId },
    });
    if (!interview) {
      throw new InterviewError(404, 'Not found');
    }
    if (interview.status !== 'CONFIRMED') {
      throw new InterviewError(409, INTERVIEW_CANNOT_BE_UPDATED);
    }

    const record = await writeTransition(tx, {
      interview,
      actorUserId: user.id,
      fromStatuses: ['CONFIRMED'],
      toStatus: 'COMPLETED',
      eventType: 'COMPLETED',
      data: {
        attendance: body.attendance,
        outcome: body.outcome === undefined ? interview.outcome : body.outcome,
        employerNotes: body.employerNotes === undefined ? interview.employerNotes : body.employerNotes,
      },
      eventDetails: {
        attendance: body.attendance,
        outcome: body.outcome ?? null,
      },
    });
    return serializeInterview(record, { audience: 'employer', includeEvents: true });
  });
}

export async function listOwnedInterviews(client, userId, query) {
  return listInterviews(client, listWhere({ candidateUserId: userId }, query), query, 'candidate');
}

export async function findOwnedInterview(client, userId, interviewId) {
  const record = await loadInterview(client, { id: interviewId, candidateUserId: userId });
  if (!record) {
    throw new InterviewError(404, 'Not found');
  }
  return serializeInterview(record, { audience: 'candidate', includeEvents: true });
}

export async function acceptOwnedInterview(client, userId, interviewId) {
  return client.$transaction(async (tx) => {
    const interview = await tx.interview.findFirst({
      where: { id: interviewId, candidateUserId: userId },
    });
    if (!interview) {
      throw new InterviewError(404, 'Not found');
    }
    if (interview.status !== 'PROPOSED') {
      throw new InterviewError(409, INTERVIEW_CANNOT_BE_UPDATED);
    }

    const record = await writeTransition(tx, {
      interview,
      actorUserId: userId,
      fromStatuses: ['PROPOSED'],
      toStatus: 'CONFIRMED',
      eventType: 'ACCEPTED',
      promoteApplication: true,
    });
    return serializeInterview(record, { audience: 'candidate', includeEvents: true });
  });
}

export async function declineOwnedInterview(client, userId, interviewId, body = {}) {
  const candidateResponseNote = body.candidateResponseNote === undefined
    ? undefined
    : body.candidateResponseNote;
  return client.$transaction(async (tx) => {
    const interview = await tx.interview.findFirst({
      where: { id: interviewId, candidateUserId: userId },
    });
    if (!interview) {
      throw new InterviewError(404, 'Not found');
    }
    if (!['PROPOSED', 'RESCHEDULE_REQUESTED'].includes(interview.status)) {
      throw new InterviewError(409, INTERVIEW_CANNOT_BE_UPDATED);
    }

    const record = await writeTransition(tx, {
      interview,
      actorUserId: userId,
      fromStatuses: ['PROPOSED', 'RESCHEDULE_REQUESTED'],
      toStatus: 'DECLINED',
      eventType: 'DECLINED',
      data: {
        candidateResponseNote: candidateResponseNote === undefined
          ? interview.candidateResponseNote
          : candidateResponseNote,
      },
      eventDetails: {
        reason: candidateResponseNote ?? null,
      },
    });
    return serializeInterview(record, { audience: 'candidate', includeEvents: true });
  });
}

export async function rescheduleOwnedInterview(client, userId, interviewId, body) {
  const requestedStartAt = new Date(body.requestedStartAt);
  return client.$transaction(async (tx) => {
    const interview = await tx.interview.findFirst({
      where: { id: interviewId, candidateUserId: userId },
    });
    if (!interview) {
      throw new InterviewError(404, 'Not found');
    }
    if (!['PROPOSED', 'CONFIRMED'].includes(interview.status)) {
      throw new InterviewError(409, INTERVIEW_CANNOT_BE_UPDATED);
    }

    const record = await writeTransition(tx, {
      interview,
      actorUserId: userId,
      fromStatuses: ['PROPOSED', 'CONFIRMED'],
      toStatus: 'RESCHEDULE_REQUESTED',
      eventType: 'RESCHEDULE_REQUESTED',
      data: {
        requestedStartAt,
        requestedDurationMinutes: body.requestedDurationMinutes ?? interview.durationMinutes,
        candidateResponseNote: body.candidateResponseNote === undefined
          ? interview.candidateResponseNote
          : body.candidateResponseNote,
      },
      eventDetails: {
        requestedStartAt: requestedStartAt.toISOString(),
        requestedDurationMinutes: body.requestedDurationMinutes ?? interview.durationMinutes,
        reason: body.candidateResponseNote ?? null,
      },
    });
    return serializeInterview(record, { audience: 'candidate', includeEvents: true });
  });
}

export async function listAdminInterviewStats(client) {
  const [total, grouped, companiesWithInterviews] = await Promise.all([
    client.interview.count(),
    client.interview.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    client.company.count({
      where: {
        interviews: { some: {} },
      },
    }),
  ]);
  return {
    total,
    byStatus: statusCountsFromGroup(grouped),
    companiesWithInterviews,
  };
}

export { optionalQueryString };
