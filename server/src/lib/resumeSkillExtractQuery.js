import { z } from 'zod';
import { ResumeError } from './resumeQuery.js';
import { serializeResumeFile } from './resumeFileQuery.js';
import { readStoredResumeFile } from './resumeStorage.js';
import { extractResumeText } from './resumeTextExtraction.js';
import { matchResumeSkills } from './resumeSkillMatch.js';
import {
  EXTRACTION_DEFAULT_PROFICIENCY,
  assertSelectedSubset,
  confirmResumeSkillsBodySchema,
  createReviewToken,
  verifyReviewToken,
} from './resumeExtractionReview.js';
import { serializeUserSkill } from './userSkillQuery.js';

export const extractResumeSkillsBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z.object({}).strict(),
);

export { confirmResumeSkillsBodySchema };

const skillSelect = {
  id: true,
  sourceUri: true,
  preferredLabel: true,
  skillType: true,
  sourceSystem: true,
};

async function loadOwnedResumeWithFile(client, userId, resumeId) {
  return client.resume.findFirst({
    where: { id: resumeId, userId },
    include: { file: true },
  });
}

function publicSuggestion(suggestion) {
  return {
    skillId: suggestion.skillId,
    preferredLabel: suggestion.preferredLabel,
    skillType: suggestion.skillType,
    sourceUri: suggestion.sourceUri,
    matchedLabel: suggestion.matchedLabel,
    matchType: suggestion.matchType,
    matchingMethod: suggestion.matchingMethod,
    evidence: suggestion.evidence,
    alreadySaved: suggestion.alreadySaved,
    existingProficiency: suggestion.existingProficiency,
    reviewStatus: suggestion.reviewStatus,
  };
}

async function loadSavedProficiency(client, userId) {
  const rows = await client.userSkill.findMany({
    where: { userId },
    select: { skillId: true, proficiencyLevel: true },
  });
  return new Map(rows.map((row) => [row.skillId, row.proficiencyLevel]));
}

export async function extractOwnedResumeSkills(client, userId, resumeId, env = process.env) {
  const resume = await loadOwnedResumeWithFile(client, userId, resumeId);
  if (!resume) {
    throw new ResumeError(404, 'Not found');
  }
  if (!resume.file) {
    throw new ResumeError(400, 'No resume file uploaded');
  }

  const buffer = await readStoredResumeFile(userId, resumeId, resume.file.storedFilename, env);
  if (!buffer) {
    throw new ResumeError(404, 'File is unavailable');
  }

  const extracted = await extractResumeText(buffer, resume.file.contentType);
  if (!extracted.readable) {
    return {
      extraction: {
        resumeId,
        file: serializeResumeFile(resume.file),
        readable: false,
        unreadable: true,
        truncated: false,
        textLength: 0,
        reason: 'unreadable',
        reviewToken: null,
        suggestions: [],
      },
    };
  }

  const [catalog, savedBySkillId] = await Promise.all([
    client.skill.findMany({
      where: { sourceSystem: 'ESCO' },
      select: {
        id: true,
        preferredLabel: true,
        skillType: true,
        sourceUri: true,
        sourceMetadata: true,
      },
    }),
    loadSavedProficiency(client, userId),
  ]);

  const suggestions = matchResumeSkills(extracted.text, catalog, { savedBySkillId });
  const reviewToken = createReviewToken({
    userId,
    resumeId,
    sha256: resume.file.sha256,
    skillIds: suggestions.map((item) => item.skillId),
  });

  return {
    extraction: {
      resumeId,
      file: serializeResumeFile(resume.file),
      readable: true,
      unreadable: false,
      truncated: extracted.truncated,
      textLength: extracted.characterCount,
      reason: suggestions.length === 0 ? 'no-match' : null,
      reviewToken,
      suggestions: suggestions.map(publicSuggestion),
    },
  };
}

export async function confirmOwnedResumeSkills(client, userId, resumeId, body, env = process.env) {
  const resume = await loadOwnedResumeWithFile(client, userId, resumeId);
  if (!resume) {
    throw new ResumeError(404, 'Not found');
  }
  if (!resume.file) {
    throw new ResumeError(400, 'No resume file uploaded');
  }

  const payload = verifyReviewToken(body.reviewToken, {
    userId,
    resumeId,
    sha256: resume.file.sha256,
  });
  const selectedIds = assertSelectedSubset(body.skillIds, payload.skillIds);

  return client.$transaction(async (tx) => {
    const latest = await tx.resume.findFirst({
      where: { id: resumeId, userId },
      include: { file: true },
    });
    if (!latest?.file || latest.file.sha256 !== resume.file.sha256) {
      throw new ResumeError(400, 'Invalid request');
    }

    const existing = await tx.userSkill.findMany({
      where: { userId, skillId: { in: selectedIds } },
      include: { skill: { select: skillSelect } },
    });
    const existingBySkillId = new Map(existing.map((row) => [row.skillId, row]));
    const toCreate = selectedIds.filter((skillId) => !existingBySkillId.has(skillId));

    if (toCreate.length > 0) {
      const catalog = await tx.skill.findMany({
        where: { id: { in: toCreate }, sourceSystem: 'ESCO' },
        select: { id: true },
      });
      if (catalog.length !== toCreate.length) {
        throw new ResumeError(400, 'Invalid request');
      }

      await tx.userSkill.createMany({
        data: toCreate.map((skillId) => ({
          userId,
          skillId,
          proficiencyLevel: EXTRACTION_DEFAULT_PROFICIENCY,
        })),
        skipDuplicates: true,
      });
    }

    const savedRows =
      toCreate.length === 0
        ? []
        : await tx.userSkill.findMany({
            where: { userId, skillId: { in: toCreate } },
            include: { skill: { select: skillSelect } },
            orderBy: [{ skill: { preferredLabel: 'asc' } }, { skill: { sourceUri: 'asc' } }],
          });

    return {
      saved: savedRows.map(serializeUserSkill),
      skipped: existing.map(serializeUserSkill),
    };
  });
}
