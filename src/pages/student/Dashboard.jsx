import Avatar from '../../components/common/Avatar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { greetingForHour } from '../../api/candidateDashboard.js'
import { useCandidateDashboard } from '../../hooks/useCandidateDashboard.js'
import {
  ApplicationsUnavailableSection,
  CandidateUpcomingInterviewCard,
  CareerTargetCard,
  DashboardStats,
  JobsUnavailableSection,
  LearningTopicsSection,
  ProfileHighlights,
  SkillGapOverviewCard,
} from '../shared/CandidateDashboardPanels.jsx'

const BASE_PATH = '/student'

function StudentDashboard() {
  const { data, loading, error, retry } = useCandidateDashboard()

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
                    Keep building your recorded skills and preparing from your saved career target.
                  </p>
                  <ProfileHighlights highlights={data.profileHighlights} profileTo={`${BASE_PATH}/profile`} />
                </div>
              </div>
            </Card>

            <DashboardStats stats={data.stats} />

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <CareerTargetCard occupation={data.occupation} basePath={BASE_PATH} />
              <SkillGapOverviewCard data={data} basePath={BASE_PATH} />
            </div>

            <LearningTopicsSection data={data} basePath={BASE_PATH} />
            <JobsUnavailableSection jobsTo={`${BASE_PATH}/jobs`} />
            <div className="po-section-block grid gap-6 lg:grid-cols-2">
              <ApplicationsUnavailableSection />
              <CandidateUpcomingInterviewCard
                interviewsTo={`${BASE_PATH}/interviews`}
                basePath={BASE_PATH}
              />
            </div>
          </>
        ) : null}
      </QueryStatus>
    </PageContent>
  )
}

export default StudentDashboard
