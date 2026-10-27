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

  req.user = user;
  next();
});
