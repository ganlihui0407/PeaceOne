import Field from './Field.jsx'

function TimeInput({
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
          type="time"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="po-field"
          {...props}
        />
      )}
    </Field>
  )
}

export default TimeInput
