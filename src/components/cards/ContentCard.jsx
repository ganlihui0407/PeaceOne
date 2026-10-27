import Card from './Card.jsx'

function ContentCard({ title, description, children, ...props }) {
  return (
    <Card {...props}>
      {title ? <h3 className="po-card-title">{title}</h3> : null}
      {description ? <p className="po-secondary mt-2">{description}</p> : null}
      {children}
    </Card>
  )
}

export default ContentCard
