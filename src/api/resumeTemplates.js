export const DEFAULT_RESUME_TEMPLATE = 'classic'

export const RESUME_TEMPLATES = [
  {
    key: 'classic',
    name: 'Classic Professional',
    shortLabel: 'Classic',
    description: 'Clean single-column layout for students, graduates and general applications.',
  },
  {
    key: 'modern',
    name: 'Modern Professional',
    shortLabel: 'Modern',
    description: 'Contemporary header with a subtle accent colour for business and technology roles.',
  },
  {
    key: 'compact',
    name: 'Compact Professional',
    shortLabel: 'Compact',
    description: 'Space-efficient layout for longer education, experience and certification histories.',
  },
]

export const RESUME_TEMPLATE_KEYS = RESUME_TEMPLATES.map((item) => item.key)

export function isResumeTemplateKey(value) {
  return RESUME_TEMPLATE_KEYS.includes(value)
}

export function resolveResumeTemplateKey(value) {
  return isResumeTemplateKey(value) ? value : DEFAULT_RESUME_TEMPLATE
}

export function resumeTemplateByKey(value) {
  const key = resolveResumeTemplateKey(value)
  return RESUME_TEMPLATES.find((item) => item.key === key) ?? RESUME_TEMPLATES[0]
}
