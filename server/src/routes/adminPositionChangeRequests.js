import { Router } from 'express';
import { prisma } from '../db.js';
import {
  PositionChangeRequestError,
  adminPositionChangeRequestListQuerySchema,
  adminPositionChangeRequestListWhere,
  approvePositionChangeRequest,
  findPositionChangeRequestById,
  listAdminPositionChangeRequests,
  positionChangeRequestIdParamsSchema,
  rejectPositionChangeRequest,
  reviewPositionChangeRequestBodySchema,
  serializePositionChangeRequest,
} from '../lib/positionChangeRequestQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

export const adminPositionChangeRequestsRouter = Router();

adminPositionChangeRequestsRouter.use(requireAuth, requireRole('ADMIN'));

function sendPositionChangeError(res, error) {
  if (error instanceof PositionChangeRequestError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

adminPositionChangeRequestsRouter.get(
  '/',
  validateQuery(adminPositionChangeRequestListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery;
    const payload = await listAdminPositionChangeRequests(
      prisma,
      adminPositionChangeRequestListWhere(query),
      query.page,
      query.limit,
    );
    res.status(200).json(payload);
  }),
);

adminPositionChangeRequestsRouter.get(
  '/:id',
  validateParams(positionChangeRequestIdParamsSchema),
  asyncHandler(async (req, res) => {
    const record = await findPositionChangeRequestById(prisma, req.validatedParams.id);
    if (!record) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json({ request: serializePositionChangeRequest(record) });
  }),
);

adminPositionChangeRequestsRouter.post(
  '/:id/approve',
  validateParams(positionChangeRequestIdParamsSchema),
  validateBody(reviewPositionChangeRequestBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const request = await approvePositionChangeRequest(prisma, {
        requestId: req.validatedParams.id,
        reviewerId: req.user.id,
        reviewNote: req.validatedBody.reviewNote ?? null,
      });
      res.status(200).json({ request });
    } catch (error) {
      if (sendPositionChangeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);

adminPositionChangeRequestsRouter.post(
  '/:id/reject',
  validateParams(positionChangeRequestIdParamsSchema),
  validateBody(reviewPositionChangeRequestBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const request = await rejectPositionChangeRequest(prisma, {
        requestId: req.validatedParams.id,
        reviewerId: req.user.id,
        reviewNote: req.validatedBody.reviewNote ?? null,
      });
      res.status(200).json({ request });
    } catch (error) {
      if (sendPositionChangeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
