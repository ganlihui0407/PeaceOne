import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import { greetingForHour } from '../../api/candidateDashboard.js'
import { useCandidateDashboard } from '../../hooks/useCandidateDashboard.js'
import {
  ApplicationsAndInterviewsUnavailable,
  CareerTargetCard,
  DashboardStats,
  JobsUnavailableSection,
  LearningTopicsSection,
  ProfileHighlights,
  SkillGapOverviewCard,
} from '../shared/CandidateDashboardPanels.jsx'

const BASE_PATH = '/jobseeker'

function JobSeekerDashboard() {
  const navigate = useNavigate()
  const { data, loading, error, retry } = useCandidateDashboard()
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')

  function handleSearch(event) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (keyword.trim()) {
      params.set('q', keyword.trim())
    }
    if (location.trim()) {
      params.set('location', location.trim())
    }
    const query = params.toString()
    navigate(`${BASE_PATH}/jobs${query ? `?${query}` : ''}`)
  }

  return (
    <PageContent width="wide">
      <Card className="mb-8">
        <h1 className="po-page-title">
          {data ? `${greetingForHour()}, ${data.firstName}` : 'Find your next opportunity'}
        </h1>
        <p className="po-secondary mt-1">
          Review your saved career target and recorded skills. Published vacancies are listed on Find Jobs.
          Submitted applications are listed on My Applications. Stored interviews appear below.
        </p>
        {data ? <ProfileHighlights highlights={data.profileHighlights} profileTo={`${BASE_PATH}/profile`} /> : null}
        <form
          className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
          onSubmit={handleSearch}
        >
          <SearchInput
            id="js-keyword"
            label="Keyword / Job Title"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Data analyst"
          />
          <TextInput
            id="js-location"
            label="Location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Kuala Lumpur"
          />
          <div className="flex items-end">
            <Button type="submit" className="w-full shrink-0 md:w-auto">
              Search
            </Button>
          </div>
        </form>
      </Card>

      <QueryStatus
        loading={loading}
        error={error}
        loadingLabel="Loading your dashboard…"
        onRetry={retry}
      >
        {data ? (
          <>
            <DashboardStats stats={data.stats} />
            <JobsUnavailableSection jobsTo={`${BASE_PATH}/jobs`} />
            <ApplicationsAndInterviewsUnavailable
              applicationsTo={`${BASE_PATH}/applications`}
              interviewsTo={`${BASE_PATH}/interviews`}
              basePath={BASE_PATH}
            />
            <div className="po-section-block grid gap-6 lg:grid-cols-2">
              <CareerTargetCard occupation={data.occupation} basePath={BASE_PATH} />
              <SkillGapOverviewCard data={data} basePath={BASE_PATH} />
            </div>
            <LearningTopicsSection data={data} basePath={BASE_PATH} />
          </>
        ) : null}
      </QueryStatus>
    </PageContent>
  )
}

export default JobSeekerDashboard
