function EmptyState({ title = 'Nothing to show yet', description, action }) {
  return (
    <div className="px-2 py-8 text-center">
      <p className="po-card-title">{title}</p>
      {description ? <p className="po-secondary mx-auto mt-1 max-w-md">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

export default EmptyState
