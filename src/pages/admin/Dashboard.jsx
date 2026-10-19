import Button from '../../components/common/Button.jsx'
import Badge from '../../components/common/Badge.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import { adminDashboard } from '../../data/adminDashboardData.js'

function AdminDashboard() {
  const { heading, support, stats, reviewStats, activity, shortcuts } = adminDashboard

  return (
    <PageContent title={heading} description={support}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviewStats.map((item) => (
          <Card key={item.label} padding="sm">
            <p className="po-secondary">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{item.value}</p>
          </Card>
        ))}
      </div>

      <section className="po-section-block">
        <SectionHeader title="Quick management" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map((item) => (
            <Card key={item.label}>
              <h3 className="po-card-title">{item.label}</h3>
              <div className="mt-4">
                <Button to={item.to} variant="secondary" className="w-full">
                  {item.label}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="po-section-block">
        <SectionHeader title="Recent activity" />
        <Table
          minWidthClass="min-w-[720px]"
          headers={['Activity', 'User / Company', 'Date / Time', 'Type / Status']}
          rows={activity.map((item) => [
            item.activity,
            item.actor,
            item.time,
            <Badge key={item.id} status={item.type.toLowerCase()} className="normal-case">
              {item.type}
            </Badge>,
          ])}
        />
      </section>
    </PageContent>
  )
}

export default AdminDashboard
