import Avatar from '../../components/common/Avatar.jsx'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { greetingForHour } from '../../api/candidateDashboard.js'
import { useStaffDashboard } from '../../hooks/useStaffAdminDashboard.js'
import {
  StaffApplicationStatsSection,
  StaffCompanySection,
  StaffUpcomingInterviewsSection,
  StaffJobsUnavailableSection,
  StaffProfileHighlights,
} from '../shared/StaffAdminDashboardPanels.jsx'

function EmployerDashboard() {
  const { data, loading, error, retry } = useStaffDashboard()

  return (
    <PageContent
      width="wide"
      actions={<Button to="/employer/jobs/create">Create Job Posting</Button>}
    >
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
                    Your signed-in staff profile is shown here. Job postings are managed on Jobs. Application
                    and interview totals below come from stored company records.
                  </p>
                  <StaffProfileHighlights highlights={data.profileHighlights} profileTo="/employer/profile" />
                </div>
              </div>
            </Card>

            <StaffCompanySection company={data.company} companyTo="/employer/company" />
            <StaffJobsUnavailableSection />
            <StaffApplicationStatsSection stats={data.applicationStats} />
            <StaffUpcomingInterviewsSection stats={data.interviewStats} interviews={data.upcomingInterviews} />
          </>
        ) : null}
      </QueryStatus>
    </PageContent>
  )
}

export default EmployerDashboard
