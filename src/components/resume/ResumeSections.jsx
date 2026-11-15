import { cn } from '../../utils/cn.js'

export function ResumeSection({ title, accent = false, compact = false, children }) {
  return (
    <section className={compact ? 'mt-3' : 'mt-4'}>
      <h3
        className={cn(
          'font-semibold uppercase tracking-[0.08em]',
          compact ? 'text-[0.62rem]' : 'text-[0.68rem]',
          accent ? 'text-primary' : 'text-ink',
        )}
      >
        {title}
      </h3>
      <div className={cn('mt-1 border-t', accent ? 'border-primary' : 'border-ink')} />
      <div className={cn(compact ? 'mt-1.5 space-y-1.5' : 'mt-2 space-y-2')}>{children}</div>
    </section>
  )
}

export function ResumeItemHeading({ title, meta, compact = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className={cn('font-semibold text-ink', compact ? 'text-[0.78rem]' : 'text-[0.82rem]')}>{title}</p>
      {meta ? <p className={cn('shrink-0 text-muted', compact ? 'text-[0.68rem]' : 'text-[0.72rem]')}>{meta}</p> : null}
    </div>
  )
}

export function ResumeBody({ children, compact = false, muted = false }) {
  return (
    <p className={cn(compact ? 'text-[0.74rem] leading-snug' : 'text-[0.78rem] leading-relaxed', muted ? 'text-muted' : 'text-ink')}>
      {children}
    </p>
  )
}

export function ResumeEducationList({ view, accent, compact }) {
  if (!view.hasEducation) {
    return null
  }
  return (
    <ResumeSection title="Education" accent={accent} compact={compact}>
      {view.education.map((item, index) => (
        <div key={`education-${index}`}>
          <ResumeItemHeading title={item.institution || item.detail} meta={item.years} compact={compact} />
          {item.detail && item.institution ? (
            <ResumeBody compact={compact} muted>
              {item.detail}
            </ResumeBody>
          ) : null}
          {item.notes ? <ResumeBody compact={compact}>{item.notes}</ResumeBody> : null}
        </div>
      ))}
    </ResumeSection>
  )
}

export function ResumeExperienceList({ view, accent, compact }) {
  if (!view.hasExperience) {
    return null
  }
  return (
    <ResumeSection title="Work experience" accent={accent} compact={compact}>
      {view.experience.map((item, index) => {
        const heading = item.jobTitle || item.organization
        const orgLine = [item.organization, item.location].filter(Boolean).join(' · ')
        return (
          <div key={`experience-${index}`}>
            <ResumeItemHeading title={heading} meta={item.dates} compact={compact} />
            {orgLine && orgLine !== heading ? (
              <ResumeBody compact={compact} muted>
                {orgLine}
              </ResumeBody>
            ) : null}
            {item.description ? <ResumeBody compact={compact}>{item.description}</ResumeBody> : null}
          </div>
        )
      })}
    </ResumeSection>
  )
}

export function ResumeSkillList({ view, accent, compact }) {
  if (!view.hasSkills) {
    return null
  }
  return (
    <ResumeSection title="Skills" accent={accent} compact={compact}>
      <ResumeBody compact={compact}>{view.skills.map((item) => item.display).join(' · ')}</ResumeBody>
    </ResumeSection>
  )
}

export function ResumeCertificationList({ view, accent, compact }) {
  if (!view.hasCertifications) {
    return null
  }
  return (
    <ResumeSection title="Certifications" accent={accent} compact={compact}>
      {view.certifications.map((item, index) => (
        <ResumeBody key={`certification-${index}`} compact={compact}>
          {item.display}
        </ResumeBody>
      ))}
    </ResumeSection>
  )
}

export function ResumeSummarySection({ view, accent, compact }) {
  if (!view.hasSummary) {
    return null
  }
  return (
    <ResumeSection title="Professional summary" accent={accent} compact={compact}>
      <ResumeBody compact={compact}>{view.summary}</ResumeBody>
    </ResumeSection>
  )
}
