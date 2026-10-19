function Toast({ message }) {
  if (!message) {
    return null
  }

  return (
    <div
      role="status"
      className="fixed right-6 bottom-6 z-50 max-w-sm rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-[var(--shadow-lift)]"
    >
      {message}
    </div>
  )
}

export default Toast
