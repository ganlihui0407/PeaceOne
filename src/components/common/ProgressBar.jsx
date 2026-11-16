function ProgressBar({ value = 0, label }) {
  const width = Math.min(Math.max(Number(value) || 0, 0), 100)

  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-page"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      aria-label={label || `Progress ${Math.round(width)} percent`}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
  )
}

export default ProgressBar
