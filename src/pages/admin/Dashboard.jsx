import Avatar from '../../components/common/Avatar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { greetingForHour } from '../../api/candidateDashboard.js'
import { useAdminDashboard } from '../../hooks/useStaffAdminDashboard.js'
import {
  AdminApplicationStatsSection,
  AdminInterviewStatsSection,
  AdminPlatformStatsSection,
  AdminRecentActivitySection,
  AdminShortcutsSection,
} from '../shared/StaffAdminDashboardPanels.jsx'

function AdminDashboard() {
  const { data, loading, error, retry } = useAdminDashboard()

  return (
    <PageContent width="wide">
      <QueryStatus
        loading={loading}
        error={error}
        loadingLabel="Loading your dashboard…"
        onRetry={retry}
      >
        {data ? (
          <>
            <Card className="mb-8">
              <div className="flex items-start gap-4">
                <Avatar name={data.fullName} size="lg" />
                <div>
                  <h1 className="po-page-title">
                    {greetingForHour()}, {data.firstName}
                  </h1>
                  <p className="po-secondary mt-1">
                    Your signed-in administrator profile is shown here. User, company, job, application,
                    interview and learning totals below are live PostgreSQL aggregates.
                  </p>
                  <p className="po-secondary mt-2">
                    {data.roleLabel} · {data.accountStatusLabel} · {data.email}
                  </p>
                </div>
              </div>
            </Card>

            <AdminPlatformStatsSection stats={data.platformStats} />
            <AdminApplicationStatsSection stats={data.applicationStats} />
            <AdminInterviewStatsSection stats={data.interviewStats} />
            <AdminShortcutsSection />
            <AdminRecentActivitySection activity={data.platformStats?.recentActivity} />
          </>
        ) : null}
      </QueryStatus>
    </PageContent>
  )
}

export default AdminDashboard
