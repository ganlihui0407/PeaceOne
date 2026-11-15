import { Router } from 'express';
import { prisma } from '../db.js';
import {
  PositionChangeRequestError,
  createOwnedPositionChangeRequest,
  createPositionChangeRequestBodySchema,
  findOwnedPositionChangeRequest,
  listOwnedPositionChangeRequests,
  positionChangeRequestIdParamsSchema,
  serializePositionChangeRequest,
} from '../lib/positionChangeRequestQuery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams } from '../middleware/validate.js';

export const mePositionChangeRequestsRouter = Router();

mePositionChangeRequestsRouter.use(requireAuth, requireRole('COMPANY_STAFF'));

function sendPositionChangeError(res, error) {
  if (error instanceof PositionChangeRequestError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

mePositionChangeRequestsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await listOwnedPositionChangeRequests(prisma, req.user.id);
    res.status(200).json({ items });
  }),
);

mePositionChangeRequestsRouter.get(
  '/:id',
  validateParams(positionChangeRequestIdParamsSchema),
  asyncHandler(async (req, res) => {
    const record = await findOwnedPositionChangeRequest(prisma, req.user.id, req.validatedParams.id);
    if (!record) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json({ request: serializePositionChangeRequest(record) });
  }),
);

mePositionChangeRequestsRouter.post(
  '/',
  validateBody(createPositionChangeRequestBodySchema),
  asyncHandler(async (req, res) => {
    try {
      const request = await createOwnedPositionChangeRequest(prisma, {
        userId: req.user.id,
        requestedPosition: req.validatedBody.requestedPosition,
        reason: req.validatedBody.reason,
      });
      res.status(201).json({ request });
    } catch (error) {
      if (sendPositionChangeError(res, error)) {
        return;
      }
      throw error;
    }
  }),
);
