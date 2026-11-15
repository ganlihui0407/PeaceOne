import { z } from 'zod';

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
