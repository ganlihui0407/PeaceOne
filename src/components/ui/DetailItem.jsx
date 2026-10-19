function DetailItem({ label, value, children }) {
  return (
    <div>
      <dt className="po-helper mt-0">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{children ?? value ?? '—'}</dd>
    </div>
  )
}

export default DetailItem
