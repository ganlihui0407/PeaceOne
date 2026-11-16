import { z } from 'zod';
import { normalizeLabelSearch, paginationMeta } from './escoQuery.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const COMPANY_FIELD_LIMITS = {
  companyName: 150,
  registrationNumber: 50,
  industry: 100,
  companySize: 50,
  website: 200,
  email: 254,
  phone: 30,
  location: 100,
  address: 200,
  description: 2000,
};

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

const optionalLimitedString = (max) => z.preprocess(
  emptyToNull,
  z.union([z.string().trim().max(max), z.null()]).optional(),
);

export const companyIdParamsSchema = z.object({
  id: z.string().regex(UUID_RE),
});

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

export const adminCompanyListQuerySchema = z.object({
  q: optionalQueryString,
  page: pageQuery,
  limit: limitQuery,
});

export const upsertCompanyBodySchema = z
  .object({
    companyName: z.string().trim().min(1).max(COMPANY_FIELD_LIMITS.companyName),
    registrationNumber: optionalLimitedString(COMPANY_FIELD_LIMITS.registrationNumber),
    industry: optionalLimitedString(COMPANY_FIELD_LIMITS.industry),
    companySize: optionalLimitedString(COMPANY_FIELD_LIMITS.companySize),
    website: optionalLimitedString(COMPANY_FIELD_LIMITS.website),
    email: z.preprocess(
      emptyToNull,
      z.union([z.email().max(COMPANY_FIELD_LIMITS.email), z.null()]).optional(),
    ),
    phone: optionalLimitedString(COMPANY_FIELD_LIMITS.phone),
    location: optionalLimitedString(COMPANY_FIELD_LIMITS.location),
    address: optionalLimitedString(COMPANY_FIELD_LIMITS.address),
    description: optionalLimitedString(COMPANY_FIELD_LIMITS.description),
  })
  .strict();

export const companySelect = {
  id: true,
  companyName: true,
  registrationNumber: true,
  industry: true,
  companySize: true,
  website: true,
  email: true,
  phone: true,
  location: true,
  address: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

export function serializeCompany(company) {
  if (!company) {
    return null;
  }
  return {
    id: company.id,
    companyName: company.companyName,
    registrationNumber: company.registrationNumber ?? null,
    industry: company.industry ?? null,
    companySize: company.companySize ?? null,
    website: company.website ?? null,
    email: company.email ?? null,
    phone: company.phone ?? null,
    location: company.location ?? null,
    address: company.address ?? null,
    description: company.description ?? null,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

export function companyUpdateData(body) {
  return {
    companyName: body.companyName,
    registrationNumber: body.registrationNumber === undefined ? undefined : body.registrationNumber,
    industry: body.industry === undefined ? undefined : body.industry,
    companySize: body.companySize === undefined ? undefined : body.companySize,
    website: body.website === undefined ? undefined : body.website,
    email: body.email === undefined ? undefined : body.email,
    phone: body.phone === undefined ? undefined : body.phone,
    location: body.location === undefined ? undefined : body.location,
    address: body.address === undefined ? undefined : body.address,
    description: body.description === undefined ? undefined : body.description,
  };
}

export async function findOwnedCompany(client, userId) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      companyId: true,
      company: { select: companySelect },
    },
  });
  if (!user) {
    return null;
  }
  return user;
}

export async function upsertOwnedCompany(client, userId, body) {
  const data = companyUpdateData(body);
  return client.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, companyId: true },
    });
    if (!user) {
      return { error: 'unauthenticated' };
    }

    if (user.companyId) {
      const company = await tx.company.update({
        where: { id: user.companyId },
        data,
        select: companySelect,
      });
      return { company };
    }

    const company = await tx.company.create({
      data,
      select: companySelect,
    });
    await tx.user.update({
      where: { id: userId },
      data: { companyId: company.id },
    });
    return { company, created: true };
  });
}

export async function findCompanyById(client, id) {
  return client.company.findUnique({
    where: { id },
    select: companySelect,
  });
}

function jobCountsFromRows(rows) {
  const counts = {
    jobCount: 0,
    publishedJobCount: 0,
    draftJobCount: 0,
    closedJobCount: 0,
    suspendedJobCount: 0,
  };
  for (const row of rows) {
    counts.jobCount += row._count._all;
    if (row.status === 'PUBLISHED') counts.publishedJobCount = row._count._all;
    if (row.status === 'DRAFT') counts.draftJobCount = row._count._all;
    if (row.status === 'CLOSED') counts.closedJobCount = row._count._all;
    if (row.status === 'SUSPENDED') counts.suspendedJobCount = row._count._all;
  }
  return counts;
}

export function serializeAdminCompany(company, extras = {}) {
  return {
    ...serializeCompany(company),
    staffCount: extras.staffCount ?? 0,
    jobCount: extras.jobCount ?? 0,
    publishedJobCount: extras.publishedJobCount ?? 0,
    draftJobCount: extras.draftJobCount ?? 0,
    closedJobCount: extras.closedJobCount ?? 0,
    suspendedJobCount: extras.suspendedJobCount ?? 0,
  };
}

export async function listAdminCompanies(client, query) {
  const search = normalizeLabelSearch(query.q);
  const where = search
    ? { companyName: { contains: search, mode: 'insensitive' } }
    : {};
  const skip = (query.page - 1) * query.limit;
  const [total, records] = await Promise.all([
    client.company.count({ where }),
    client.company.findMany({
      where,
      select: {
        ...companySelect,
        _count: { select: { staff: true, jobs: true } },
      },
      orderBy: [{ companyName: 'asc' }],
      skip,
      take: query.limit,
    }),
  ]);
  const ids = records.map((company) => company.id);
  const jobRows = ids.length
    ? await client.job.groupBy({
      by: ['companyId', 'status'],
      where: { companyId: { in: ids } },
      _count: { _all: true },
    })
    : [];
  const jobsByCompany = new Map();
  for (const row of jobRows) {
    const current = jobsByCompany.get(row.companyId) || [];
    current.push(row);
    jobsByCompany.set(row.companyId, current);
  }
  return {
    companies: records.map((company) => serializeAdminCompany(company, {
      staffCount: company._count.staff,
      ...jobCountsFromRows(jobsByCompany.get(company.id) || []),
    })),
    ...paginationMeta(query.page, query.limit, total),
  };
}

export async function findAdminCompany(client, id) {
  const company = await client.company.findUnique({
    where: { id },
    select: {
      ...companySelect,
      staff: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          accountStatus: true,
          jobTitle: true,
        },
        orderBy: { fullName: 'asc' },
      },
      _count: { select: { staff: true, jobs: true } },
    },
  });
  if (!company) {
    return null;
  }
  const jobRows = await client.job.groupBy({
    by: ['status'],
    where: { companyId: id },
    _count: { _all: true },
  });
  return {
    company: serializeAdminCompany(company, {
      staffCount: company._count.staff,
      ...jobCountsFromRows(jobRows.map((row) => ({ ...row, companyId: id }))),
    }),
    staff: company.staff.map((member) => ({
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      role: member.role,
      accountStatus: member.accountStatus,
      jobTitle: member.jobTitle ?? null,
    })),
  };
}
