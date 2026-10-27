import Field from './Field.jsx'

function TextArea({
  id,
  label,
  helperText,
  error,
  required = false,
  rows = 4,
  ...props
}) {
  const invalid = Boolean(error)

  return (
    <Field id={id} label={label} required={required} helperText={helperText} error={error}>
      {(describedBy) => (
        <textarea
          id={id}
          rows={rows}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="po-field"
          {...props}
        />
      )}
    </Field>
  )
}

export default TextArea
