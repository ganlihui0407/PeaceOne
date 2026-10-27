import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'

function ModulePlaceholder({ title }) {
  return (
    <PageContent
      title={title}
      description="Review account and workspace preferences for your PeaceOne profile."
    >
      <Card>
        <h2 className="po-section-title">Preferences</h2>
        <p className="po-body mt-3">
          Your PeaceOne workspace is active. Additional notification and display preferences can be
          managed here.
        </p>
      </Card>
    </PageContent>
  )
}

export default ModulePlaceholder
