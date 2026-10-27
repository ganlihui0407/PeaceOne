function PageHeader({ title, description, breadcrumb, actions }) {
  if (!title && !actions && !breadcrumb) {
    return null
  }

  return (
    <>
      {breadcrumb ? <p className="po-helper mb-2">{breadcrumb}</p> : null}

      {title || actions ? (
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? <h1 className="po-page-title">{title}</h1> : null}
            {description ? <p className="po-secondary mt-1 max-w-2xl">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </>
  )
}

export default PageHeader
