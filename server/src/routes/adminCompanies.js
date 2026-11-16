import { Router } from 'express';
import { prisma } from '../db.js';
import {
  adminCompanyListQuerySchema,
  companyIdParamsSchema,
  findAdminCompany,
  listAdminCompanies,
} from '../lib/companyQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateParams, validateQuery } from '../middleware/validate.js';

export const adminCompaniesRouter = Router();

adminCompaniesRouter.use(requireAuth, requireRole('ADMIN'));

adminCompaniesRouter.get(
  '/',
  validateQuery(adminCompanyListQuerySchema),
  asyncHandler(async (req, res) => {
    const payload = await listAdminCompanies(prisma, req.validatedQuery);
    res.status(200).json(payload);
  }),
);

adminCompaniesRouter.get(
  '/:id',
  validateParams(companyIdParamsSchema),
  asyncHandler(async (req, res) => {
    const payload = await findAdminCompany(prisma, req.validatedParams.id);
    if (!payload) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json(payload);
  }),
);
