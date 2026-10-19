import Field from './Field.jsx'

function TextInput({
  id,
  label,
  helperText,
  error,
  required = false,
  type = 'text',
  ...props
}) {
  const invalid = Boolean(error)

  return (
    <Field id={id} label={label} required={required} helperText={helperText} error={error}>
      {(describedBy) => (
        <input
          id={id}
          type={type}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="po-field"
          {...props}
        />
      )}
    </Field>
  )
}

export default TextInput
