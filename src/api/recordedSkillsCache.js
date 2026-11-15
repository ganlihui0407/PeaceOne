let snapshot = null

export function readRecordedSkillsCache() {
  return snapshot
}

export function writeRecordedSkillsCache(items) {
  snapshot = Array.isArray(items) ? items : null
}

export function clearRecordedSkillsCache() {
  snapshot = null
}
