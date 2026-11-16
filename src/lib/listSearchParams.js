export function parsePositivePage(value) {
  const page = Number.parseInt(String(value || '1'), 10)
  return Number.isInteger(page) && page > 0 ? page : 1
}

export function compactSearchParams(values) {
  const next = {}
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') {
      continue
    }
    if (key === 'page' && Number(value) === 1) {
      continue
    }
    next[key] = String(value)
  }
  return next
}
