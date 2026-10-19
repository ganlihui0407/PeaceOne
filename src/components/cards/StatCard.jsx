import Card from './Card.jsx'

function StatCard({ label, value }) {
  return (
    <Card>
      <p className="po-secondary">{label}</p>
      <p className="po-stat-value mt-2">{value}</p>
    </Card>
  )
}

export default StatCard
