import { z } from 'zod';
import { prisma } from '../db.js';
import { normalizeLabelSearch, paginationMeta } from './escoQuery.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POSITION_CHANGE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
export const REQUESTED_POSITION_MAX = 100;
export const REASON_MAX = 1000;
export const REVIEW_NOTE_MAX = 1000;
export const PENDING_EXISTS = 'Pending request already exists';
export const ALREADY_REVIEWED = 'Request already reviewed';

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

const optionalQueryString = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().max(200).optional(),
);

export class PositionChangeRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'PositionChangeRequestError';
    this.status = status;
  }
}

export const positionChangeRequestIdParamsSchema = z.object({
  id: z.string().regex(UUID_RE),
});

export const createPositionChangeRequestBodySchema = z
  .object({
    requestedPosition: z.string().trim().min(1).max(REQUESTED_POSITION_MAX),
    reason: z.string().trim().min(1).max(REASON_MAX),
  })
  .strict();

export const reviewPositionChangeRequestBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z
    .object({
      reviewNote: z.preprocess(
        emptyToNull,
        z.union([z.string().trim().max(REVIEW_NOTE_MAX), z.null()]).optional(),
      ),
    })
    .strict(),
);

export const adminPositionChangeRequestListQuerySchema = z.object({
  q: optionalQueryString,
  status: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  ),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const requestUserSelect = {
  id: true,
  fullName: true,
  email: true,
  jobTitle: true,
};

const reviewerSelect = {
  id: true,
  fullName: true,
  email: true,
};

const requestInclude = {
  user: { select: requestUserSelect },
  reviewer: { select: reviewerSelect },
};

export function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

function serializePerson(person) {
  if (!person) {
    return null;
  }
  return {
    id: person.id,
    fullName: person.fullName,
    email: person.email,
    ...(person.jobTitle !== undefined ? { jobTitle: person.jobTitle ?? null } : {}),
  };
}

export function serializePositionChangeRequest(record) {
  return {
    id: record.id,
    currentPosition: record.currentPosition ?? null,
    requestedPosition: record.requestedPosition,
    reason: record.reason,
    status: record.status,
    reviewNote: record.reviewNote ?? null,
    reviewedAt: record.reviewedAt ? record.reviewedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    user: serializePerson(record.user),
    reviewer: serializePerson(record.reviewer),
  };
}

export function adminPositionChangeRequestListWhere(query) {
  const where = {};
  if (query.status) {
    where.status = query.status;
  }

  const search = normalizeLabelSearch(query.q);
  if (search) {
    where.user = {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  return where;
}

export async function findOwnedPositionChangeRequest(client, userId, id) {
  return client.positionChangeRequest.findFirst({
    where: { id, userId },
    include: requestInclude,
  });
}

export async function findPositionChangeRequestById(client, id) {
  return client.positionChangeRequest.findUnique({
    where: { id },
    include: requestInclude,
  });
}

export async function listOwnedPositionChangeRequests(client, userId) {
  const records = await client.positionChangeRequest.findMany({
    where: { userId },
    include: requestInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return records.map(serializePositionChangeRequest);
}

export async function listAdminPositionChangeRequests(client, where, page, limit) {
  const skip = (page - 1) * limit;
  const [total, records] = await Promise.all([
    client.positionChangeRequest.count({ where }),
    client.positionChangeRequest.findMany({
      where,
      include: requestInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
  ]);

  return {
    items: records.map(serializePositionChangeRequest),
    ...paginationMeta(page, limit, total),
  };
}

export async function findPendingRequestForUser(client, userId) {
  return client.positionChangeRequest.findFirst({
    where: { userId, status: 'PENDING' },
    select: { id: true },
  });
}

export async function createOwnedPositionChangeRequest(client, { userId, requestedPosition, reason }) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, jobTitle: true },
  });
  if (!user) {
    throw new PositionChangeRequestError(401, 'Unauthenticated');
  }

  const currentPosition = user.jobTitle ?? null;
  if (currentPosition && requestedPosition === currentPosition) {
    throw new PositionChangeRequestError(400, 'Invalid request');
  }

  const pending = await findPendingRequestForUser(client, userId);
  if (pending) {
    throw new PositionChangeRequestError(409, PENDING_EXISTS);
  }

  try {
    const created = await client.positionChangeRequest.create({
      data: {
        userId,
        currentPosition,
        requestedPosition,
        reason,
      },
      include: requestInclude,
    });
    return serializePositionChangeRequest(created);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new PositionChangeRequestError(409, PENDING_EXISTS);
    }
    throw error;
  }
}

async function reviewPendingRequest(client, { requestId, reviewerId, status, reviewNote }) {
  return client.$transaction(async (tx) => {
    const existing = await tx.positionChangeRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        userId: true,
        requestedPosition: true,
        status: true,
      },
    });
    if (!existing) {
      throw new PositionChangeRequestError(404, 'Not found');
    }
    if (existing.status !== 'PENDING') {
      throw new PositionChangeRequestError(409, ALREADY_REVIEWED);
    }

    const updated = await tx.positionChangeRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: {
        status,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: reviewNote === undefined ? null : reviewNote,
      },
    });
    if (updated.count !== 1) {
      throw new PositionChangeRequestError(409, ALREADY_REVIEWED);
    }

    if (status === 'APPROVED') {
      await tx.user.update({
        where: { id: existing.userId },
        data: { jobTitle: existing.requestedPosition },
      });
    }

    const reviewed = await tx.positionChangeRequest.findUnique({
      where: { id: requestId },
      include: requestInclude,
    });
    return serializePositionChangeRequest(reviewed);
  });
}

export async function approvePositionChangeRequest(client, input) {
  return reviewPendingRequest(client, { ...input, status: 'APPROVED' });
}

export async function rejectPositionChangeRequest(client, input) {
  return reviewPendingRequest(client, { ...input, status: 'REJECTED' });
}

export { prisma };
