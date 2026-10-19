import { cn } from '../../utils/cn.js'

function FormHelperText({ children, error = false, id }) {
  return (
    <p id={id} className={cn('po-helper', error && 'po-helper-error')}>
      {children}
    </p>
  )
}

export default FormHelperText
