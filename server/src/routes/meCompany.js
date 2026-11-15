import { Router } from 'express';
import { prisma } from '../db.js';
import {
  findOwnedCompany,
  serializeCompany,
  upsertCompanyBodySchema,
  upsertOwnedCompany,
} from '../lib/companyQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validate.js';

export const meCompanyRouter = Router();

meCompanyRouter.use(requireAuth, requireRole('COMPANY_STAFF'));

meCompanyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const owned = await findOwnedCompany(prisma, req.user.id);
    if (!owned) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    res.status(200).json({ company: serializeCompany(owned.company) });
  }),
);

meCompanyRouter.put(
  '/',
  validateBody(upsertCompanyBodySchema),
  asyncHandler(async (req, res) => {
    const result = await upsertOwnedCompany(prisma, req.user.id, req.validatedBody);
    if (result.error === 'unauthenticated') {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    res.status(result.created ? 201 : 200).json({ company: serializeCompany(result.company) });
  }),
);
