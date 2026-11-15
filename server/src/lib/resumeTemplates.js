export const RESUME_TEMPLATE_KEYS = Object.freeze(['classic', 'modern', 'compact']);

export const DEFAULT_RESUME_TEMPLATE = 'classic';

export const RESUME_TEMPLATES = Object.freeze([
  {
    key: 'classic',
    name: 'Classic Professional',
    description: 'A clean single-column layout with clear headings. Suitable for students, graduates and general applications.',
  },
  {
    key: 'modern',
    name: 'Modern Professional',
    description: 'A contemporary header with a subtle accent colour. Suitable for business, technology and corporate applications.',
  },
  {
    key: 'compact',
    name: 'Compact Professional',
    description: 'A space-efficient layout for longer education, experience and certification histories.',
  },
]);

export function isResumeTemplateKey(value) {
  return RESUME_TEMPLATE_KEYS.includes(value);
}

export function resolveResumeTemplateKey(value) {
  return isResumeTemplateKey(value) ? value : DEFAULT_RESUME_TEMPLATE;
}

export function resumeTemplateByKey(value) {
  const key = resolveResumeTemplateKey(value);
  return RESUME_TEMPLATES.find((item) => item.key === key) ?? RESUME_TEMPLATES[0];
}
