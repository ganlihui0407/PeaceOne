import { z } from 'zod';

export const USER_SKILL_PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const userSkillIdParamsSchema = z.object({
  id: z.string().regex(UUID_RE),
});

export const createUserSkillBodySchema = z
  .object({
    skillId: z.string().regex(UUID_RE),
    proficiencyLevel: z.enum(USER_SKILL_PROFICIENCY_LEVELS),
  })
  .strict();

export const updateUserSkillBodySchema = z
  .object({
    proficiencyLevel: z.enum(USER_SKILL_PROFICIENCY_LEVELS),
  })
  .strict();

export function serializeUserSkill(record) {
  return {
    id: record.id,
    proficiencyLevel: record.proficiencyLevel,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    skill: {
      id: record.skill.id,
      sourceUri: record.skill.sourceUri,
      preferredLabel: record.skill.preferredLabel,
      skillType: record.skill.skillType ?? null,
      sourceSystem: record.skill.sourceSystem,
    },
  };
}
