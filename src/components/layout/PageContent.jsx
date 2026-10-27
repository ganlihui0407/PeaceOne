import { cn } from '../../utils/cn.js'
import PageHeader from './PageHeader.jsx'

function PageContent({
  title,
  description,
  breadcrumb,
  actions,
  width = 'wide',
  children,
  className = '',
}) {
  const widthClass = {
    default: 'max-w-5xl',
    wide: 'max-w-[1200px]',
    full: 'max-w-none',
  }[width]

  return (
    <div className={cn('w-full min-w-0 px-4 py-6 md:px-6 lg:px-8 lg:py-8', className)}>
      <div className={cn('mx-auto w-full min-w-0', widthClass)}>
        <PageHeader
          title={title}
          description={description}
          breadcrumb={breadcrumb}
          actions={actions}
        />
        {children}
      </div>
    </div>
  )
}

export default PageContent
