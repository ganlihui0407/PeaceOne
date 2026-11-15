import { resumeTemplateByKey } from '../../api/resumeTemplates.js'
import { buildResumeViewModel } from '../../api/resumeViewModel.js'
import ResumeDocument from './ResumeDocument.jsx'

function ResumePreview({ form }) {
  const view = buildResumeViewModel(form ?? {})
  const template = resumeTemplateByKey(view.templateKey)
  const empty =
    !view.fullName &&
    !view.hasContact &&
    !view.hasSummary &&
    !view.hasEducation &&
    !view.hasExperience &&
    !view.hasSkills &&
    !view.hasCertifications

  return (
    <div>
      <p className="po-helper mt-0 mb-3">
        Live preview of {template.name}. Empty sections are hidden. Unsaved editor changes appear here immediately.
      </p>
      <div className="overflow-hidden rounded-md border border-line bg-page shadow-card">
        <div className="origin-top scale-[0.98]">
          <ResumeDocument view={view} />
        </div>
        {empty ? (
          <p className="po-secondary px-6 pb-6">Add contact details or a section to see them on this template.</p>
        ) : null}
      </div>
    </div>
  )
}

export default ResumePreview
