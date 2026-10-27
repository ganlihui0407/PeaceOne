import { Router } from 'express';
import { prisma } from '../db.js';
import { mapRegistrationRole, normalizeEmail } from '../lib/authRoles.js';
import { loginSchema, registerSchema } from '../lib/authSchemas.js';
import { csrfCookieName, generateCsrfToken } from '../lib/csrf.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import {
  destroySession,
  regenerateSession,
  rememberMeMaxAgeMs,
  sessionCookieName,
  sessionCookieOptions,
} from '../lib/session.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { publicUser, requireAuth } from '../middleware/requireAuth.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';

const LOGIN_ERROR = 'Invalid email or password';
const ACCOUNT_UNAVAILABLE = 'Account is unavailable';
const REGISTER_FORBIDDEN = 'Registration is not allowed for this role';

let dummyHashPromise;

function dummyPasswordHash() {
  dummyHashPromise ??= hashPassword('peaceone-timing-pad');
  return dummyHashPromise;
}

function emptyToNull(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function establishAuthenticatedSession(req, res, user, rememberMe) {
  await regenerateSession(req);
  req.session.userId = user.id;
  req.session.csrfBound = true;
  if (rememberMe) {
    req.session.cookie.maxAge = rememberMeMaxAgeMs();
  }
  const csrfToken = generateCsrfToken(req, res, { overwrite: true });
  return csrfToken;
}

export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimit,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const body = req.validatedBody;
    const mapped = mapRegistrationRole(body.role, body.currentPosition);
    if (mapped.error === 'forbidden') {
      res.status(403).json({ error: REGISTER_FORBIDDEN });
      return;
    }
    if (mapped.error || !mapped.role) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }

    const email = normalizeEmail(body.email);
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await hashPassword(body.password);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: body.fullName,
          phone: emptyToNull(body.phone),
          role: mapped.role,
          termsAcceptedAt: new Date(),
        },
      });
    } catch (err) {
      if (err?.code === 'P2002') {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }
      throw err;
    }

    const csrfToken = await establishAuthenticatedSession(req, res, user, false);
    res.status(201).json({
      user: publicUser(user),
      csrfToken,
    });
  }),
);

authRouter.post(
  '/login',
  authRateLimit,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const body = req.validatedBody;
    const email = normalizeEmail(body.email);
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordHash = user?.passwordHash ?? (await dummyPasswordHash());
    const passwordOk = await verifyPassword(body.password, passwordHash);

    if (!user || !passwordOk) {
      res.status(401).json({ error: LOGIN_ERROR });
      return;
    }

    if (user.accountStatus === 'SUSPENDED') {
      res.status(403).json({ error: ACCOUNT_UNAVAILABLE });
      return;
    }

    const csrfToken = await establishAuthenticatedSession(
      req,
      res,
      user,
      body.rememberMe === true,
    );
    res.status(200).json({
      user: publicUser(user),
      csrfToken,
    });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  (req, res) => {
    res.status(200).json({ user: publicUser(req.user) });
  },
);

authRouter.post(
  '/logout',
  authRateLimit,
  asyncHandler(async (req, res) => {
    await destroySession(req);
    const cookieOptions = sessionCookieOptions();
    res.clearCookie(sessionCookieName, cookieOptions);
    res.clearCookie(csrfCookieName, cookieOptions);
    res.status(200).json({ ok: true });
  }),
);
