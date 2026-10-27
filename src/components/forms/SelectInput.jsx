import Field from './Field.jsx'

function SelectInput({
  id,
  label,
  helperText,
  error,
  required = false,
  options = [],
  placeholder,
  ...props
}) {
  const invalid = Boolean(error)

  return (
    <Field id={id} label={label} required={required} helperText={helperText} error={error}>
      {(describedBy) => (
        <select
          id={id}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="po-field"
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) =>
            typeof option === 'string' ? (
              <option key={option} value={option}>
                {option}
              </option>
            ) : (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ),
          )}
        </select>
      )}
    </Field>
  )
}

export default SelectInput
