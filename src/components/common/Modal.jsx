import { useEffect } from 'react'

function Modal({ open, title, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-ink/30"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="po-modal-title"
        className={`relative z-10 w-full rounded-xl border border-line bg-surface p-6 shadow-[var(--shadow-lift)] ${
          size === 'lg' ? 'max-w-2xl' : 'max-w-lg'
        }`}
      >
        <h2 id="po-modal-title" className="po-section-title">
          {title}
        </h2>
        <div className="mt-5">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  )
}

export default Modal
