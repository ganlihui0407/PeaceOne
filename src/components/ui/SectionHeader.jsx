import { cn } from '../../utils/cn.js'

function SectionHeader({ title, description, action, className = '' }) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="po-section-title">{title}</h2>
        {description ? <p className="po-secondary mt-1">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  )
}

export default SectionHeader
