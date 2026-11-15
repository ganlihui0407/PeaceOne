import {
  ResumeCertificationList,
  ResumeEducationList,
  ResumeExperienceList,
  ResumeSkillList,
  ResumeSummarySection,
} from '../ResumeSections.jsx'

function ClassicResume({ view }) {
  return (
    <article className="bg-white px-8 py-8 text-ink" data-resume-template="classic">
      <header>
        <h2 className="text-[1.45rem] font-semibold tracking-tight">{view.fullName || 'No name added yet.'}</h2>
        <div className="mt-2 border-t border-ink" />
        {view.hasContact ? <p className="mt-2 text-[0.78rem] text-muted">{view.contactLine}</p> : null}
      </header>
      <ResumeSummarySection view={view} />
      <ResumeEducationList view={view} />
      <ResumeExperienceList view={view} />
      <ResumeSkillList view={view} />
      <ResumeCertificationList view={view} />
    </article>
  )
}

export default ClassicResume
