import { cn } from '../../utils/cn.js'

function Checkbox({
  id,
  label,
  helperText,
  error,
  className = '',
  ...props
}) {
  const invalid = Boolean(error)
  const describedBy = error ? `${id}-error` : helperText ? `${id}-help` : undefined

  return (
    <div className={cn('w-full', className)}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 rounded border-line text-primary accent-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
        <span className="text-sm font-medium text-ink">{label}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="po-helper po-helper-error ml-8">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-help`} className="po-helper ml-8">
          {helperText}
        </p>
      ) : null}
    </div>
  )
}

export default Checkbox
