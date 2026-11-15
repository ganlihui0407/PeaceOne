import { RESUME_TEMPLATES, resolveResumeTemplateKey } from '../../api/resumeTemplates.js'
import { cn } from '../../utils/cn.js'

const MINI = {
  classic: (
    <div className="h-16 rounded-sm border border-line bg-white p-1.5">
      <div className="h-2 w-10 bg-ink" />
      <div className="mt-1 h-px bg-ink" />
      <div className="mt-1.5 space-y-1">
        <div className="h-1 w-full bg-line" />
        <div className="h-1 w-4/5 bg-line" />
        <div className="h-1 w-3/5 bg-line" />
      </div>
    </div>
  ),
  modern: (
    <div className="h-16 overflow-hidden rounded-sm border border-line bg-white">
      <div className="h-5 bg-primary" />
      <div className="space-y-1 p-1.5">
        <div className="h-1 w-full bg-line" />
        <div className="h-1 w-4/5 bg-line" />
        <div className="h-1 w-3/5 bg-line" />
      </div>
    </div>
  ),
  compact: (
    <div className="h-16 rounded-sm border border-line bg-white p-1.5">
      <div className="h-1.5 w-8 bg-ink" />
      <div className="mt-1 space-y-0.5">
        <div className="h-1 w-full bg-line" />
        <div className="h-1 w-full bg-line" />
        <div className="h-1 w-4/5 bg-line" />
        <div className="h-1 w-3/5 bg-line" />
        <div className="h-1 w-2/3 bg-line" />
      </div>
    </div>
  ),
}

function ResumeTemplatePicker({ value, onChange, disabled = false }) {
  const selected = resolveResumeTemplateKey(value)

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {RESUME_TEMPLATES.map((template) => {
        const isSelected = template.key === selected
        return (
          <button
            key={template.key}
            type="button"
            disabled={disabled}
            aria-pressed={isSelected}
            onClick={() => onChange(template.key)}
            className={cn(
              'rounded-md border p-3 text-left transition-colors',
              isSelected ? 'border-primary bg-soft' : 'border-line bg-surface hover:border-primary/50',
              disabled ? 'cursor-not-allowed opacity-50' : '',
            )}
          >
            {MINI[template.key]}
            <p className="po-body mt-2 font-medium">{template.name}</p>
            <p className="po-secondary mt-1">{template.description}</p>
            {isSelected ? <p className="po-helper mt-2 text-primary">Selected</p> : null}
          </button>
        )
      })}
    </div>
  )
}

export default ResumeTemplatePicker
