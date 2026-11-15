export const MAX_SKILL_SUGGESTIONS = 50;
export const EVIDENCE_RADIUS = 40;

function metadataString(metadata, key) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return '';
  }
  const value = metadata[key];
  return typeof value === 'string' ? value : '';
}

export function normalizeMatchText(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeMatchText(value) {
  const normalized = normalizeMatchText(value);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(' ')
    .map((token) => token.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
}

export function splitAltLabels(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }
  return value
    .split(/\r?\n|\|/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function skillCatalogLabels(skill) {
  const preferredLabel = typeof skill?.preferredLabel === 'string' ? skill.preferredLabel : '';
  const altSource =
    typeof skill?.altLabels === 'string' ? skill.altLabels : metadataString(skill?.sourceMetadata, 'altLabels');
  const labels = [];
  if (preferredLabel) {
    labels.push({ text: preferredLabel, matchType: 'preferred' });
  }
  for (const alt of splitAltLabels(altSource)) {
    if (alt !== preferredLabel) {
      labels.push({ text: alt, matchType: 'altLabel' });
    }
  }
  return labels;
}

export function evidenceSnippet(text, matchedLabel) {
  if (typeof text !== 'string' || text.length === 0 || typeof matchedLabel !== 'string') {
    return '';
  }
  const haystack = text;
  const lower = haystack.toLowerCase();
  let index = lower.indexOf(matchedLabel.toLowerCase());
  if (index < 0) {
    const normalisedNeedle = normalizeMatchText(matchedLabel);
    const normalisedHay = normalizeMatchText(haystack);
    const normalisedIndex = normalisedHay.indexOf(normalisedNeedle);
    if (normalisedIndex < 0) {
      return haystack.slice(0, EVIDENCE_RADIUS * 2).trim();
    }
    index = Math.min(haystack.length - 1, normalisedIndex);
  }
  const start = Math.max(0, index - EVIDENCE_RADIUS);
  const end = Math.min(haystack.length, index + matchedLabel.length + EVIDENCE_RADIUS);
  const snippet = haystack.slice(start, end).trim();
  return `${start > 0 ? '…' : ''}${snippet}${end < haystack.length ? '…' : ''}`;
}

function buildPhraseIndex(skills) {
  const byFirst = new Map();
  for (const skill of skills) {
    if (!skill?.id) {
      continue;
    }
    for (const label of skillCatalogLabels(skill)) {
      const tokens = tokenizeMatchText(label.text);
      if (tokens.length === 0) {
        continue;
      }
      const first = tokens[0];
      if (!byFirst.has(first)) {
        byFirst.set(first, []);
      }
      byFirst.get(first).push({
        tokens,
        skillId: skill.id,
        preferredLabel: skill.preferredLabel,
        skillType: skill.skillType ?? null,
        sourceUri: skill.sourceUri,
        matchedLabel: label.text,
        matchType: label.matchType,
      });
    }
  }
  for (const entries of byFirst.values()) {
    entries.sort((left, right) => {
      if (right.tokens.length !== left.tokens.length) {
        return right.tokens.length - left.tokens.length;
      }
      return right.matchedLabel.length - left.matchedLabel.length;
    });
  }
  return byFirst;
}

function tokensMatch(expected, actual) {
  if (expected.length !== actual.length) {
    return false;
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index] !== actual[index]) {
      return false;
    }
  }
  return true;
}

export function matchResumeSkills(text, skills, { savedBySkillId = new Map() } = {}) {
  const source = typeof text === 'string' ? text : '';
  const tokens = tokenizeMatchText(source);
  if (tokens.length === 0 || !Array.isArray(skills) || skills.length === 0) {
    return [];
  }

  const index = buildPhraseIndex(skills);
  const matched = new Map();

  for (let start = 0; start < tokens.length; start += 1) {
    const candidates = index.get(tokens[start]);
    if (!candidates) {
      continue;
    }
    for (const candidate of candidates) {
      if (matched.has(candidate.skillId)) {
        continue;
      }
      const window = tokens.slice(start, start + candidate.tokens.length);
      if (!tokensMatch(candidate.tokens, window)) {
        continue;
      }
      const saved = savedBySkillId.get(candidate.skillId);
      matched.set(candidate.skillId, {
        skillId: candidate.skillId,
        preferredLabel: candidate.preferredLabel,
        skillType: candidate.skillType,
        sourceUri: candidate.sourceUri,
        matchedLabel: candidate.matchedLabel,
        matchType: candidate.matchType,
        matchingMethod: candidate.matchType === 'altLabel' ? 'alternative-label' : 'preferred-label',
        evidence: evidenceSnippet(source, candidate.matchedLabel),
        alreadySaved: saved !== undefined,
        existingProficiency: saved ?? null,
        reviewStatus: 'suggested',
        tokenCount: candidate.tokens.length,
      });
    }
  }

  return [...matched.values()]
    .sort((left, right) => {
      if (right.tokenCount !== left.tokenCount) {
        return right.tokenCount - left.tokenCount;
      }
      return left.preferredLabel.localeCompare(right.preferredLabel);
    })
    .slice(0, MAX_SKILL_SUGGESTIONS)
    .map(({ tokenCount: _tokenCount, ...suggestion }) => suggestion);
}
