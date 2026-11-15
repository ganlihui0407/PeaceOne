import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateQuery } from '../middleware/validate.js';
import {
  listMascoCrosswalks,
  mascoCrosswalkListQuerySchema,
  mascoCrosswalkListWhere,
} from '../lib/mascoCrosswalkQuery.js';

export const mascoCrosswalksRouter = Router();

mascoCrosswalksRouter.use(requireAuth, requireRole('ADMIN'));

mascoCrosswalksRouter.get(
  '/',
  validateQuery(mascoCrosswalkListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery;
    const payload = await listMascoCrosswalks(
      mascoCrosswalkListWhere(query),
      query.page,
      query.limit,
    );
    res.status(200).json(payload);
  }),
);
