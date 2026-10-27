import { prisma } from '../db.js';
import { asyncHandler } from './asyncHandler.js';

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    accountStatus: user.accountStatus,
  };
}

export const requireAuth = asyncHandler(async (req, res, next) => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      accountStatus: true,
    },
  });

  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }

  if (user.accountStatus === 'SUSPENDED') {
    res.status(403).json({ error: 'Account is unavailable' });
    return;
  }

  req.user = user;
  next();
});

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
}
