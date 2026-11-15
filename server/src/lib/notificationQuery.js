import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { paginationMeta } from './escoQuery.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const NOTIFICATION_TYPES = [
  'APPLICATION_SUBMITTED',
  'APPLICATION_SHORTLISTED',
  'APPLICATION_REJECTED',
  'INTERVIEW_INVITED',
  'INTERVIEW_ACCEPTED',
  'INTERVIEW_RESCHEDULE_REQUESTED',
  'INTERVIEW_RESCHEDULE_CONFIRMED',
  'INTERVIEW_CANCELLED',
  'INTERVIEW_COMPLETED',
];

export const NOTIFICATION_RELATED_ENTITY_TYPES = ['APPLICATION', 'INTERVIEW'];

export class NotificationError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'NotificationError';
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

const pageQuery = z.preprocess((value) => {
  const normalized = singleQueryValue(value);
  return normalized === undefined ? '1' : normalized;
}, z.string().regex(/^[1-9]\d{0,6}$/).transform((value) => Number.parseInt(value, 10)));

const limitQuery = z.preprocess((value) => {
  const normalized = singleQueryValue(value);
  return normalized === undefined ? '20' : normalized;
}, z.string().regex(/^[1-9]\d{0,2}$/).transform((value) => Number.parseInt(value, 10)).refine((value) => value <= 50));

export const notificationListQuerySchema = z.object({
  unread: z.preprocess(singleQueryValue, z.enum(['true', 'false']).optional()),
  page: pageQuery,
  limit: limitQuery,
});

export const notificationIdParamsSchema = z.object({
  id: z.string().regex(UUID_RE),
});

export const emptyNotificationBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z.object({}).strict(),
);

function displayLabel(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function copyFor(type, audience, ctx) {
  const jobTitle = displayLabel(ctx.jobTitle, 'a job');
  const companyName = displayLabel(ctx.companyName, 'a company');
  switch (type) {
    case 'APPLICATION_SUBMITTED':
      return audience === 'staff'
        ? {
          title: 'New application received',
          message: `A new application was received for ${jobTitle}.`,
        }
        : {
          title: 'Application submitted',
          message: `Your application for ${jobTitle} at ${companyName} has been submitted.`,
        };
    case 'APPLICATION_SHORTLISTED':
      return {
        title: 'Application shortlisted',
        message: `You were shortlisted for ${jobTitle} at ${companyName}.`,
      };
    case 'APPLICATION_REJECTED':
      return {
        title: 'Application update',
        message: `Your application for ${jobTitle} at ${companyName} was not selected.`,
      };
    case 'INTERVIEW_INVITED':
      return {
        title: 'Interview invitation',
        message: `You have been invited to an interview for ${jobTitle} at ${companyName}.`,
      };
    case 'INTERVIEW_ACCEPTED':
      return {
        title: 'Interview accepted',
        message: `A candidate accepted the interview for ${jobTitle}.`,
      };
    case 'INTERVIEW_RESCHEDULE_REQUESTED':
      return {
        title: 'Interview reschedule requested',
        message: `A candidate requested a new interview time for ${jobTitle}.`,
      };
    case 'INTERVIEW_RESCHEDULE_CONFIRMED':
      return {
        title: 'Interview time confirmed',
        message: `A new interview time for ${jobTitle} at ${companyName} has been confirmed.`,
      };
    case 'INTERVIEW_CANCELLED':
      return audience === 'staff'
        ? {
          title: 'Interview cancelled',
          message: `The interview for ${jobTitle} was cancelled.`,
        }
        : {
          title: 'Interview cancelled',
          message: `Your interview for ${jobTitle} at ${companyName} was cancelled.`,
        };
    case 'INTERVIEW_COMPLETED':
      return audience === 'staff'
        ? {
          title: 'Interview completed',
          message: `The interview for ${jobTitle} was marked complete.`,
        }
        : {
          title: 'Interview completed',
          message: `Your interview for ${jobTitle} at ${companyName} was marked complete.`,
        };
    default:
      return null;
  }
}

function serializeNotification(record) {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    message: record.message,
    relatedEntityType: record.relatedEntityType,
    relatedEntityId: record.relatedEntityId,
    readAt: record.readAt ? record.readAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
  };
}

async function loadJobContext(tx, jobId) {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      companyId: true,
      company: {
        select: {
          id: true,
          companyName: true,
        },
      },
    },
  });
  if (!job) {
    return null;
  }
  return {
    jobId: job.id,
    jobTitle: job.title,
    companyId: job.companyId,
    companyName: job.company?.companyName ?? '',
  };
}

async function findEligibleCompanyStaffIds(tx, companyId) {
  const staff = await tx.user.findMany({
    where: {
      companyId,
      role: 'COMPANY_STAFF',
      accountStatus: 'ACTIVE',
    },
    select: { id: true },
  });
  return staff.map((user) => user.id);
}

async function filterEligibleRecipientIds(tx, userIds) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }
  const users = await tx.user.findMany({
    where: {
      id: { in: uniqueIds },
      accountStatus: 'ACTIVE',
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

function deduplicationKey(type, sourceEventId, recipientUserId) {
  return `${type}:${sourceEventId}:${recipientUserId}`;
}

export async function writeNotifications(tx, records) {
  if (!records.length) {
    return 0;
  }
  const result = await tx.notification.createMany({
    data: records.map((record) => ({
      ...record,
      id: record.id ?? randomUUID(),
    })),
    skipDuplicates: true,
  });
  return result.count;
}

function notificationRow({
  type,
  audience,
  recipientUserId,
  actorUserId,
  sourceEventId,
  relatedEntityType,
  relatedEntityId,
  ctx,
}) {
  const copy = copyFor(type, audience, ctx);
  if (!copy) {
    return null;
  }
  return {
    recipientUserId,
    actorUserId: actorUserId || null,
    type,
    title: copy.title,
    message: copy.message,
    relatedEntityType,
    relatedEntityId,
    deduplicationKey: deduplicationKey(type, sourceEventId, recipientUserId),
  };
}

export async function notifyApplicationEvent(tx, {
  event,
  application,
  actorUserId,
}) {
  const type = event.toStatus === 'SUBMITTED'
    ? 'APPLICATION_SUBMITTED'
    : event.toStatus === 'SHORTLISTED'
      ? 'APPLICATION_SHORTLISTED'
      : event.toStatus === 'REJECTED'
        ? 'APPLICATION_REJECTED'
        : null;
  if (!type) {
    return 0;
  }

  const ctx = await loadJobContext(tx, application.jobId);
  if (!ctx) {
    return 0;
  }

  const recipientPlans = [];
  if (type === 'APPLICATION_SUBMITTED') {
    recipientPlans.push({ userId: application.applicantUserId, audience: 'candidate' });
    const staffIds = await findEligibleCompanyStaffIds(tx, ctx.companyId);
    for (const staffId of staffIds) {
      recipientPlans.push({ userId: staffId, audience: 'staff' });
    }
  } else {
    recipientPlans.push({ userId: application.applicantUserId, audience: 'candidate' });
  }

  const eligibleIds = new Set(await filterEligibleRecipientIds(
    tx,
    recipientPlans.map((plan) => plan.userId),
  ));
  const rows = recipientPlans
    .filter((plan) => eligibleIds.has(plan.userId))
    .map((plan) => notificationRow({
      type,
      audience: plan.audience,
      recipientUserId: plan.userId,
      actorUserId,
      sourceEventId: event.id,
      relatedEntityType: 'APPLICATION',
      relatedEntityId: application.id,
      ctx,
    }))
    .filter(Boolean);

  return writeNotifications(tx, rows);
}

const INTERVIEW_EVENT_NOTIFICATIONS = {
  CREATED: { type: 'INTERVIEW_INVITED', audiences: ['candidate'] },
  ACCEPTED: { type: 'INTERVIEW_ACCEPTED', audiences: ['staff'] },
  RESCHEDULE_REQUESTED: { type: 'INTERVIEW_RESCHEDULE_REQUESTED', audiences: ['staff'] },
  RESCHEDULE_CONFIRMED: { type: 'INTERVIEW_RESCHEDULE_CONFIRMED', audiences: ['candidate'] },
  CANCELLED: { type: 'INTERVIEW_CANCELLED', audiences: ['candidate', 'staff'] },
  COMPLETED: { type: 'INTERVIEW_COMPLETED', audiences: ['candidate', 'staff'] },
};

export async function notifyInterviewEvent(tx, {
  event,
  interview,
  actorUserId,
}) {
  const spec = INTERVIEW_EVENT_NOTIFICATIONS[event.eventType];
  if (!spec) {
    return 0;
  }

  const ctx = await loadJobContext(tx, interview.jobId);
  if (!ctx || ctx.companyId !== interview.companyId) {
    return 0;
  }

  const recipientPlans = [];
  if (spec.audiences.includes('candidate')) {
    recipientPlans.push({ userId: interview.candidateUserId, audience: 'candidate' });
  }
  if (spec.audiences.includes('staff')) {
    const staffIds = await findEligibleCompanyStaffIds(tx, interview.companyId);
    for (const staffId of staffIds) {
      recipientPlans.push({ userId: staffId, audience: 'staff' });
    }
  }

  const eligibleIds = new Set(await filterEligibleRecipientIds(
    tx,
    recipientPlans.map((plan) => plan.userId),
  ));
  const rows = recipientPlans
    .filter((plan) => eligibleIds.has(plan.userId))
    .map((plan) => notificationRow({
      type: spec.type,
      audience: plan.audience,
      recipientUserId: plan.userId,
      actorUserId,
      sourceEventId: event.id,
      relatedEntityType: 'INTERVIEW',
      relatedEntityId: interview.id,
      ctx,
    }))
    .filter(Boolean);

  return writeNotifications(tx, rows);
}

export async function listOwnedNotifications(client, userId, query) {
  const where = { recipientUserId: userId };
  if (query.unread === 'true') {
    where.readAt = null;
  }
  const skip = (query.page - 1) * query.limit;
  const [total, records] = await Promise.all([
    client.notification.count({ where }),
    client.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: query.limit,
    }),
  ]);
  return {
    notifications: records.map(serializeNotification),
    ...paginationMeta(query.page, query.limit, total),
  };
}

export async function countOwnedUnreadNotifications(client, userId) {
  const unreadCount = await client.notification.count({
    where: {
      recipientUserId: userId,
      readAt: null,
    },
  });
  return { unreadCount };
}

export async function markOwnedNotificationRead(client, userId, notificationId) {
  const existing = await client.notification.findFirst({
    where: {
      id: notificationId,
      recipientUserId: userId,
    },
  });
  if (!existing) {
    throw new NotificationError(404, 'Not found');
  }
  if (existing.readAt) {
    return serializeNotification(existing);
  }
  const updated = await client.notification.updateMany({
    where: {
      id: existing.id,
      recipientUserId: userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  if (updated.count !== 1 && !existing.readAt) {
    const current = await client.notification.findFirst({
      where: { id: existing.id, recipientUserId: userId },
    });
    if (!current) {
      throw new NotificationError(404, 'Not found');
    }
    return serializeNotification(current);
  }
  const record = await client.notification.findFirst({
    where: { id: existing.id, recipientUserId: userId },
  });
  return serializeNotification(record);
}

export async function markAllOwnedNotificationsRead(client, userId) {
  const result = await client.notification.updateMany({
    where: {
      recipientUserId: userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return { updatedCount: result.count };
}

export async function deleteNotificationsForApplication(client, applicationId) {
  await client.notification.deleteMany({
    where: {
      relatedEntityType: 'APPLICATION',
      relatedEntityId: applicationId,
    },
  });
}
