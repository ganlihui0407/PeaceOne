import {
  ResumeCertificationList,
  ResumeEducationList,
  ResumeExperienceList,
  ResumeSkillList,
  ResumeSummarySection,
} from '../ResumeSections.jsx'

function CompactResume({ view }) {
  return (
    <article className="bg-white px-6 py-5 text-ink" data-resume-template="compact">
      <header>
        <h2 className="text-[1.1rem] font-semibold tracking-tight">{view.fullName || 'No name added yet.'}</h2>
        {view.hasContact ? <p className="mt-1 text-[0.72rem] text-muted">{view.contactLine}</p> : null}
      </header>
      <ResumeSummarySection view={view} compact />
      <ResumeEducationList view={view} compact />
      <ResumeExperienceList view={view} compact />
      <ResumeSkillList view={view} compact />
      <ResumeCertificationList view={view} compact />
    </article>
  )
}

export default CompactResume
