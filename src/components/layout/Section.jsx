import { cn } from '../../utils/cn.js'

function Section({ children, className = '', contained = true }) {
  return (
    <section className={cn('px-4 py-16 sm:px-6 lg:py-24', className)}>
      {contained ? <div className="mx-auto max-w-6xl">{children}</div> : children}
    </section>
  )
}

export default Section
