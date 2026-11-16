import { z } from 'zod';
import { normalizeLabelSearch, paginationMeta } from './escoQuery.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const USER_ROLES = ['STUDENT', 'JOB_SEEKER', 'COMPANY_STAFF', 'ADMIN'];
export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED'];
const USER_ROLE_ENUM = /** @type {[string, ...string[]]} */ (USER_ROLES);
const ACCOUNT_STATUS_ENUM = /** @type {[string, ...string[]]} */ (ACCOUNT_STATUSES);
export const CANNOT_SUSPEND_SELF = 'You cannot suspend your own account';

export class AdminUserError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AdminUserError';
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

export const adminUserListQuerySchema = z.object({
  q: optionalQueryString,
  role: z.preprocess(singleQueryValue, z.enum(USER_ROLE_ENUM).optional()),
  accountStatus: z.preprocess(singleQueryValue, z.enum(ACCOUNT_STATUS_ENUM).optional()),
  page: pageQuery,
  limit: limitQuery,
});

export const adminUserIdParamsSchema = z.object({
  id: z.string().regex(UUID_RE),
});

export const adminUserStatusBodySchema = z.object({
  accountStatus: z.enum(ACCOUNT_STATUS_ENUM),
}).strict();

const userListSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  accountStatus: true,
  jobTitle: true,
  createdAt: true,
  company: {
    select: { id: true, companyName: true },
  },
};

const userDetailSelect = {
  ...userListSelect,
  educationLevel: true,
  fieldOfStudy: true,
  institution: true,
  graduationYear: true,
  location: true,
  experienceSummary: true,
  department: true,
  companyId: true,
  updatedAt: true,
  _count: {
    select: {
      applications: true,
      candidateInterviews: true,
      skills: true,
      learningEnrollments: true,
      positionChangeRequests: true,
      createdJobs: true,
    },
  },
};

function serializeCompanySummary(company) {
  if (!company) {
    return null;
  }
  return {
    id: company.id,
    companyName: company.companyName,
  };
}

function serializeAdminUser(user, extras = {}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone ?? null,
    role: user.role,
    accountStatus: user.accountStatus,
    jobTitle: user.jobTitle ?? null,
    createdAt: user.createdAt.toISOString(),
    company: serializeCompanySummary(user.company),
    ...extras,
  };
}

export async function listAdminUsers(client, query) {
  const search = normalizeLabelSearch(query.q);
  const where = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.accountStatus ? { accountStatus: query.accountStatus } : {}),
    ...(search
      ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
      : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [total, records] = await Promise.all([
    client.user.count({ where }),
    client.user.findMany({
      where,
      select: userListSelect,
      orderBy: [{ createdAt: 'desc' }, { fullName: 'asc' }],
      skip,
      take: query.limit,
    }),
  ]);
  return {
    users: records.map((user) => serializeAdminUser(user)),
    ...paginationMeta(query.page, query.limit, total),
  };
}

export async function listAdminUserStats(client) {
  const [total, byRoleRows, byStatusRows] = await Promise.all([
    client.user.count(),
    client.user.groupBy({ by: ['role'], _count: { _all: true } }),
    client.user.groupBy({ by: ['accountStatus'], _count: { _all: true } }),
  ]);
  const byRole = Object.fromEntries(USER_ROLES.map((role) => [role, 0]));
  for (const row of byRoleRows) {
    byRole[row.role] = row._count._all;
  }
  const byStatus = Object.fromEntries(ACCOUNT_STATUSES.map((status) => [status, 0]));
  for (const row of byStatusRows) {
    byStatus[row.accountStatus] = row._count._all;
  }
  return { total, byRole, byStatus };
}

export async function findAdminUser(client, id) {
  const user = await client.user.findUnique({
    where: { id },
    select: userDetailSelect,
  });
  if (!user) {
    throw new AdminUserError(404, 'Not found');
  }

  const [completedCourses, pendingRequest] = await Promise.all([
    client.learningEnrollment.count({
      where: { userId: user.id, status: 'COMPLETED' },
    }),
    client.positionChangeRequest.findFirst({
      where: { userId: user.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        currentPosition: true,
        requestedPosition: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return serializeAdminUser(user, {
    educationLevel: user.educationLevel ?? null,
    fieldOfStudy: user.fieldOfStudy ?? null,
    institution: user.institution ?? null,
    graduationYear: user.graduationYear ?? null,
    location: user.location ?? null,
    experienceSummary: user.experienceSummary ?? null,
    department: user.department ?? null,
    companyId: user.companyId ?? null,
    updatedAt: user.updatedAt.toISOString(),
    applicationCount: user._count.applications,
    interviewCount: user._count.candidateInterviews,
    skillCount: user._count.skills,
    enrollmentCount: user._count.learningEnrollments,
    completedCourseCount: completedCourses,
    createdJobCount: user._count.createdJobs,
    pendingPositionChangeRequest: pendingRequest
      ? {
        id: pendingRequest.id,
        currentPosition: pendingRequest.currentPosition,
        requestedPosition: pendingRequest.requestedPosition,
        status: pendingRequest.status,
        createdAt: pendingRequest.createdAt.toISOString(),
      }
      : null,
  });
}

export async function updateAdminUserStatus(client, { actorUserId, userId, accountStatus }) {
  if (actorUserId === userId && accountStatus === 'SUSPENDED') {
    throw new AdminUserError(409, CANNOT_SUSPEND_SELF);
  }
  const existing = await client.user.findUnique({
    where: { id: userId },
    select: userListSelect,
  });
  if (!existing) {
    throw new AdminUserError(404, 'Not found');
  }
  const updated = await client.user.update({
    where: { id: userId },
    data: { accountStatus },
    select: userListSelect,
  });
  return serializeAdminUser(updated);
}
