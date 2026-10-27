import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn.js'

const variants = {
  primary:
    'bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary/30',
  secondary:
    'bg-surface text-ink border border-line hover:bg-page focus-visible:ring-primary/25',
  outline:
    'bg-transparent text-ink border border-line hover:bg-page focus-visible:ring-primary/25',
  ghost:
    'bg-transparent text-primary hover:bg-soft focus-visible:ring-primary/25',
  danger:
    'bg-danger text-white hover:bg-danger-hover focus-visible:ring-danger/30',
}

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-[0.9375rem]',
}

function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  to,
  className = '',
  disabled = false,
  ...props
}) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap no-underline transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:cursor-not-allowed disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  )

  if (to && !disabled) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} disabled={disabled} className={classes} {...props}>
      {children}
    </button>
  )
}

export default Button
