import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { ResumeError } from './resumeQuery.js';

export const REVIEW_TTL_MS = 15 * 60 * 1000;
export const EXTRACTION_DEFAULT_PROFICIENCY = 'Beginner';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const confirmResumeSkillsBodySchema = z
  .object({
    reviewToken: z.string().min(1).max(16_384),
    skillIds: z.array(z.string().regex(UUID_RE)).max(50),
  })
  .strict();

function signingSecret(secret) {
  return secret || config.sessionSecret;
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function signBody(body, secret) {
  return createHmac('sha256', signingSecret(secret)).update(body).digest('base64url');
}

function signaturesMatch(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function createReviewToken(
  { userId, resumeId, sha256, skillIds },
  { secret, ttlMs = REVIEW_TTL_MS, now = Date.now() } = {},
) {
  const payload = {
    v: 1,
    userId,
    resumeId,
    sha256,
    skillIds: [...new Set(skillIds)].sort(),
    exp: now + ttlMs,
    n: randomBytes(8).toString('hex'),
  };
  const body = encodePayload(payload);
  return `${body}.${signBody(body, secret)}`;
}

export function verifyReviewToken(
  token,
  { userId, resumeId, sha256, now = Date.now() } = {},
  { secret } = {},
) {
  if (typeof token !== 'string' || !token.includes('.')) {
    throw new ResumeError(400, 'Invalid request');
  }
  const split = token.lastIndexOf('.');
  const body = token.slice(0, split);
  const signature = token.slice(split + 1);
  if (!body || !signature || !signaturesMatch(signBody(body, secret), signature)) {
    throw new ResumeError(400, 'Invalid request');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new ResumeError(400, 'Invalid request');
  }

  if (
    payload?.v !== 1 ||
    payload.userId !== userId ||
    payload.resumeId !== resumeId ||
    payload.sha256 !== sha256 ||
    !Array.isArray(payload.skillIds)
  ) {
    throw new ResumeError(400, 'Invalid request');
  }
  if (!Number.isInteger(payload.exp) || payload.exp <= now) {
    throw new ResumeError(400, 'Review has expired');
  }
  return payload;
}

export function assertSelectedSubset(selectedIds, allowedIds) {
  const allowed = new Set(allowedIds);
  const unique = [...new Set(selectedIds)];
  for (const skillId of unique) {
    if (!allowed.has(skillId)) {
      throw new ResumeError(400, 'Invalid request');
    }
  }
  return unique;
}
