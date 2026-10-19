import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Field from './Field.jsx'

function PasswordInput({
  id,
  label,
  helperText,
  error,
  required = false,
  ...props
}) {
  const [visible, setVisible] = useState(false)
  const invalid = Boolean(error)
  const toggleId = `${id}-toggle`

  return (
    <Field id={id} label={label} required={required} helperText={helperText} error={error}>
      {(describedBy) => (
        <div className="relative">
          <input
            id={id}
            type={visible ? 'text' : 'password'}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className="po-field pr-11"
            {...props}
          />
          <button
            id={toggleId}
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute top-0 right-0 flex h-11 w-11 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      )}
    </Field>
  )
}

export default PasswordInput
