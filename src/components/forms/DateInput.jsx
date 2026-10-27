import Field from './Field.jsx'

function DateInput({
  id,
  label,
  helperText,
  error,
  required = false,
  ...props
}) {
  const invalid = Boolean(error)

  return (
    <Field id={id} label={label} required={required} helperText={helperText} error={error}>
      {(describedBy) => (
        <input
          id={id}
          type="date"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="po-field"
          {...props}
        />
      )}
    </Field>
  )
}

export default DateInput
