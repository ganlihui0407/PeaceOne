import Button from './Button.jsx'

function PaginationBar({ page, totalPages, total, noun = 'results', disabled = false, onPrevious, onNext }) {
  if (!totalPages) {
    return null
  }

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="po-secondary">
        Page {page} of {totalPages} · {total} {noun}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={disabled || page <= 1} onClick={onPrevious}>
          Previous
        </Button>
        <Button size="sm" variant="secondary" disabled={disabled || page >= totalPages} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  )
}

export default PaginationBar
