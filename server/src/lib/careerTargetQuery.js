import { z } from 'zod';
import { serializeOccupationSummary } from './escoQuery.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const careerTargetOccupationSelect = {
  id: true,
  sourceUri: true,
  preferredLabel: true,
  sourceSystem: true,
  sourceMetadata: true,
};

export const updateCareerTargetBodySchema = z
  .object({
    occupationId: z.string().regex(UUID_RE),
  })
  .strict();

export function serializeCareerTarget(occupation) {
  if (!occupation || occupation.sourceSystem !== 'ESCO') {
    return { occupation: null };
  }
  return {
    occupation: serializeOccupationSummary(occupation),
  };
}
