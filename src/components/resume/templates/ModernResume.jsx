import {
  ResumeCertificationList,
  ResumeEducationList,
  ResumeExperienceList,
  ResumeSkillList,
  ResumeSummarySection,
} from '../ResumeSections.jsx'

function ModernResume({ view }) {
  return (
    <article className="bg-white text-ink" data-resume-template="modern">
      <header className="bg-primary px-8 py-6 text-white">
        <h2 className="text-[1.45rem] font-semibold tracking-tight">{view.fullName || 'No name added yet.'}</h2>
        {view.hasContact ? <p className="mt-2 text-[0.78rem] text-primary-light">{view.contactLine}</p> : null}
      </header>
      <div className="px-8 py-6">
        <ResumeSummarySection view={view} accent />
        <ResumeEducationList view={view} accent />
        <ResumeExperienceList view={view} accent />
        <ResumeSkillList view={view} accent />
        <ResumeCertificationList view={view} accent />
      </div>
    </article>
  )
}

export default ModernResume
