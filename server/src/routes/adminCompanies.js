import { Router } from 'express';
import { prisma } from '../db.js';
import {
  companyIdParamsSchema,
  findCompanyById,
  serializeCompany,
} from '../lib/companyQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateParams } from '../middleware/validate.js';

export const adminCompaniesRouter = Router();

adminCompaniesRouter.use(requireAuth, requireRole('ADMIN'));

adminCompaniesRouter.get(
  '/:id',
  validateParams(companyIdParamsSchema),
  asyncHandler(async (req, res) => {
    const company = await findCompanyById(prisma, req.validatedParams.id);
    if (!company) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json({ company: serializeCompany(company) });
  }),
);
