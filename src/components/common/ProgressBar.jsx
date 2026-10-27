function ProgressBar({ value = 0 }) {
  const width = Math.min(Math.max(Number(value) || 0, 0), 100)

  return (
    <div className="h-2 overflow-hidden rounded-full bg-page">
      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
  )
}

export default ProgressBar
