import { cn } from '../../utils/cn.js'

function Card({ children, hoverable = false, padding = 'md', className = '' }) {
  const paddingClass = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }[padding]

  return (
    <section
      className={cn(
        'min-w-0 rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]',
        paddingClass,
        hoverable &&
          'transition-shadow duration-150 hover:shadow-[var(--shadow-lift)]',
        className,
      )}
    >
      {children}
    </section>
  )
}

export default Card
