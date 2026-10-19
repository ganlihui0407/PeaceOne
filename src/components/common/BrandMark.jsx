import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn.js'

function BrandMark({ to = '/', className = '', as: Component }) {
  const content = (
    <span className={cn('text-[1.25rem] font-semibold tracking-tight text-ink', className)}>
      Peace<span className="text-primary">One</span>
    </span>
  )

  if (Component) {
    return <Component className="inline-flex items-center no-underline">{content}</Component>
  }

  if (to === '#') {
    return (
      <a href="#top" className="inline-flex items-center no-underline">
        {content}
      </a>
    )
  }

  return (
    <Link to={to} className="inline-flex shrink-0 items-center no-underline">
      {content}
    </Link>
  )
}

export default BrandMark
