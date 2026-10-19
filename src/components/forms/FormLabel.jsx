function FormLabel({ htmlFor, required = false, children }) {
  return (
    <label htmlFor={htmlFor} className="po-label">
      {children}
      {required ? (
        <span className="text-danger" aria-hidden="true">
          {' '}
          *
        </span>
      ) : null}
    </label>
  )
}

export default FormLabel
