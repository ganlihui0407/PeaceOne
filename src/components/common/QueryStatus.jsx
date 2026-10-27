import Button from './Button.jsx'
import EmptyState from './EmptyState.jsx'

function QueryStatus({
  loading,
  error,
  empty,
  loadingLabel = 'Loading…',
  emptyTitle = 'Nothing to show yet',
  emptyDescription,
  emptyAction,
  onRetry,
  children,
}) {
  if (loading) {
    return (
      <p className="po-secondary px-2 py-8 text-center" role="status">
        {loadingLabel}
      </p>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Unable to load data"
        description={error}
        action={
          onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          ) : null
        }
      />
    )
  }

  if (empty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
  }

  return children
}

export default QueryStatus
