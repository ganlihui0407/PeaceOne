import { useEffect, useRef } from 'react'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function Modal({ open, title, onClose, children, footer, size = 'md' }) {
  const dialogRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    previouslyFocused.current = document.activeElement
    const dialog = dialogRef.current
    const focusables = dialog ? [...dialog.querySelectorAll(FOCUSABLE)] : []
    ;(focusables[0] || dialog)?.focus()

    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || focusables.length === 0) {
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      if (previouslyFocused.current && typeof previouslyFocused.current.focus === 'function') {
        previouslyFocused.current.focus()
      }
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 py-6 sm:items-center sm:py-8">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-ink/30"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="po-modal-title"
        tabIndex={-1}
        className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-[var(--shadow-lift)] ${
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
