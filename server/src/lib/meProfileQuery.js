import { z } from 'zod';

export const EDUCATION_LEVELS = ['Diploma', "Bachelor's Degree", "Master's Degree", 'Other'];
const EDUCATION_LEVEL_ENUM = /** @type {[string, ...string[]]} */ (EDUCATION_LEVELS);

export const GRADUATION_YEAR_MIN = 1950;
export const GRADUATION_YEAR_MAX = 2100;

const COMMON_PATCH_FIELDS = ['fullName', 'phone'];
const CANDIDATE_PATCH_FIELDS = [
  'educationLevel',
  'fieldOfStudy',
  'institution',
  'graduationYear',
  'location',
  'experienceSummary',
];
const STAFF_PATCH_FIELDS = ['location', 'department'];

export const meProfileSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  accountStatus: true,
  educationLevel: true,
  fieldOfStudy: true,
  institution: true,
  graduationYear: true,
  location: true,
  experienceSummary: true,
  jobTitle: true,
  department: true,
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

function normalizeGraduationYear(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  return value;
}

const optionalLimitedString = (max) => z.preprocess(
  emptyToNull,
  z.union([z.string().trim().max(max), z.null()]).optional(),
);

export const updateMeProfileBodySchema = z
  .object({
    fullName: z.string().trim().min(1).max(100).optional(),
    phone: z.preprocess(
      emptyToNull,
      z.union([z.string().trim().max(30), z.null()]).optional(),
    ),
    educationLevel: z.preprocess(
      emptyToNull,
      z.union([z.enum(EDUCATION_LEVEL_ENUM), z.null()]).optional(),
    ),
    fieldOfStudy: optionalLimitedString(100),
    institution: optionalLimitedString(150),
    graduationYear: z.preprocess(
      normalizeGraduationYear,
      z.union([
        z.number().int().min(GRADUATION_YEAR_MIN).max(GRADUATION_YEAR_MAX),
        z.null(),
      ]).optional(),
    ),
    location: optionalLimitedString(100),
    experienceSummary: optionalLimitedString(2000),
    jobTitle: optionalLimitedString(100),
    department: optionalLimitedString(100),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined));

export function allowedMeProfilePatchFields(role) {
  if (role === 'STUDENT' || role === 'JOB_SEEKER') {
    return [...COMMON_PATCH_FIELDS, ...CANDIDATE_PATCH_FIELDS];
  }
  if (role === 'COMPANY_STAFF') {
    return [...COMMON_PATCH_FIELDS, ...STAFF_PATCH_FIELDS];
  }
  return [...COMMON_PATCH_FIELDS];
}

export function hasDisallowedMeProfileFields(role, body) {
  const allowed = new Set(allowedMeProfilePatchFields(role));
  return Object.keys(body).some((key) => body[key] !== undefined && !allowed.has(key));
}

export function serializeMeProfile(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone ?? null,
    role: user.role,
    accountStatus: user.accountStatus,
    educationLevel: user.educationLevel ?? null,
    fieldOfStudy: user.fieldOfStudy ?? null,
    institution: user.institution ?? null,
    graduationYear: user.graduationYear ?? null,
    location: user.location ?? null,
    experienceSummary: user.experienceSummary ?? null,
    jobTitle: user.jobTitle ?? null,
    department: user.department ?? null,
  };
}

export function meProfileUpdateData(body) {
  const data = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) {
      data[key] = value;
    }
  }
  return data;
}
