import { cn } from '../../utils/cn.js'

const tones = {
  default: 'bg-page text-ink',
  primary: 'bg-soft text-primary-dark',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}

const statusTones = {
  active: 'success',
  pending: 'warning',
  verified: 'success',
  shortlisted: 'info',
  rejected: 'danger',
  interview: 'info',
  reviewed: 'info',
  scheduled: 'info',
  informational: 'info',
  completed: 'success',
  missing: 'danger',
  matched: 'success',
  insufficient: 'warning',
  processed: 'success',
  accepted: 'success',
  cancelled: 'default',
  inprogress: 'info',
  draft: 'warning',
  closed: 'default',
  suspended: 'danger',
  inactive: 'default',
  flagged: 'danger',
  approved: 'success',
  archived: 'default',
  'pending review': 'warning',
  registration: 'info',
  'job posting': 'info',
  learning: 'info',
}

function Badge({ children, status, tone, className = '' }) {
  const resolvedTone = tone || statusTones[status] || 'default'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize',
        tones[resolvedTone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export default Badge
