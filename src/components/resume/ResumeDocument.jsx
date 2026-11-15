import { resolveResumeTemplateKey } from '../../api/resumeTemplates.js'
import ClassicResume from './templates/ClassicResume.jsx'
import CompactResume from './templates/CompactResume.jsx'
import ModernResume from './templates/ModernResume.jsx'

function ResumeDocument({ view }) {
  const templateKey = resolveResumeTemplateKey(view?.templateKey)
  if (templateKey === 'modern') {
    return <ModernResume view={view} />
  }
  if (templateKey === 'compact') {
    return <CompactResume view={view} />
  }
  return <ClassicResume view={view} />
}

export default ResumeDocument
