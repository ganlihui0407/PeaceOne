import FormLabel from './FormLabel.jsx'
import FormHelperText from './FormHelperText.jsx'

function Field({ id, label, required, helperText, error, children }) {
  const describedBy = error ? `${id}-error` : helperText ? `${id}-help` : undefined

  return (
    <div className="w-full">
      {label ? (
        <FormLabel htmlFor={id} required={required}>
          {label}
        </FormLabel>
      ) : null}
      {children(describedBy)}
      {error ? (
        <FormHelperText id={`${id}-error`} error>
          {error}
        </FormHelperText>
      ) : helperText ? (
        <FormHelperText id={`${id}-help`}>{helperText}</FormHelperText>
      ) : null}
    </div>
  )
}

export default Field
