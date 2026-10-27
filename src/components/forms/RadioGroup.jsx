import { cn } from '../../utils/cn.js'

function RadioGroup({
  name,
  legend,
  options = [],
  value,
  onChange,
  helperText,
  error,
  className = '',
}) {
  const describedBy = error ? `${name}-error` : helperText ? `${name}-help` : undefined

  return (
    <fieldset className={cn('w-full', className)} aria-describedby={describedBy}>
      {legend ? <legend className="po-label mb-3">{legend}</legend> : null}
      <div className="flex flex-col gap-2.5">
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value
          const optionLabel = typeof option === 'string' ? option : option.label
          const optionId = `${name}-${optionValue}`

          return (
            <label key={optionValue} htmlFor={optionId} className="flex cursor-pointer items-center gap-3">
              <input
                id={optionId}
                type="radio"
                name={name}
                value={optionValue}
                checked={value === optionValue}
                onChange={(event) => onChange?.(event.target.value)}
                className="h-[1.125rem] w-[1.125rem] shrink-0 border-line text-primary accent-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="text-sm text-ink">{optionLabel}</span>
            </label>
          )
        })}
      </div>
      {error ? (
        <p id={`${name}-error`} className="po-helper po-helper-error">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${name}-help`} className="po-helper">
          {helperText}
        </p>
      ) : null}
    </fieldset>
  )
}

export default RadioGroup
