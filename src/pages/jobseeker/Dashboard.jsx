import { useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import CourseCard from '../../components/cards/CourseCard.jsx'
import JobCard from '../../components/cards/JobCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import { jobSeekerDashboard } from '../../data/dashboardData.js'

function JobSeekerDashboard() {
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')
  const { stats, jobs, applications, interview, readiness, skillsToImprove, learning } =
    jobSeekerDashboard

  function handleSearch(event) {
    event.preventDefault()
  }

  return (
    <PageContent width="wide">
      <Card className="mb-8">
        <h1 className="po-page-title">{jobSeekerDashboard.heading}</h1>
        <p className="po-secondary mt-1">{jobSeekerDashboard.support}</p>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <section className="po-section-block">
        <SectionHeader title="Recommended jobs" />
        <div className="grid gap-4 lg:grid-cols-2">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              actions={[
                { label: 'View Job', to: `/jobseeker/jobs/${job.id}`, variant: 'secondary' },
                { label: 'Apply', to: `/jobseeker/jobs/${job.id}/apply` },
              ]}
            />
          ))}
        </div>
      </section>

      <div className="po-section-block grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="po-section-title">Application tracking</h2>
            <Button to="/jobseeker/applications" size="sm" variant="ghost">
              View All Applications
            </Button>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {applications.map((item) => (
              <li key={`${item.job}-${item.company}`} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{item.job}</p>
                  <p className="po-helper mt-0">{item.company}</p>
                </div>
                <Badge status={item.status.toLowerCase()}>{item.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <p className="po-secondary">Upcoming interview</p>
          <h2 className="po-section-title mt-1">{interview.title}</h2>
          <dl className="po-secondary mt-4 space-y-2">
            <div className="flex justify-between gap-3">
              <dt>Company</dt>
              <dd className="font-medium text-ink">{interview.company}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Date</dt>
              <dd className="font-medium text-ink">{interview.date}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Time</dt>
              <dd className="font-medium text-ink">{interview.time}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Method</dt>
              <dd className="font-medium text-ink">{interview.method}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Status</dt>
              <dd>
                <Badge status="scheduled">{interview.status}</Badge>
              </dd>
            </div>
          </dl>
          <div className="mt-5">
            <Button to="/jobseeker/interviews" variant="secondary">
              View Interview Details
            </Button>
          </div>
        </Card>
      </div>

      <div className="po-section-block grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="po-section-title">Improve Your Match</h2>
          <p className="po-secondary mt-2">Your current readiness for Data Analyst roles: {readiness}%</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-page">
            <div className="h-full rounded-full bg-primary" style={{ width: `${readiness}%` }} />
          </div>
          <p className="po-helper mt-4 mb-2">Suggested skills to improve</p>
          <div className="flex flex-wrap gap-2">
            {skillsToImprove.map((skill) => (
              <Badge key={skill} status="insufficient">
                {skill}
              </Badge>
            ))}
          </div>
          <div className="mt-5">
            <Button to="/jobseeker/skill-gap" variant="secondary">
              Review Skill Gap
            </Button>
          </div>
        </Card>

        <div>
          <SectionHeader title="Suggested learning" />
          <div className="grid gap-4">
            {learning.map((course) => (
              <CourseCard key={course.id} course={course} to={`/jobseeker/learning/${course.id}`} />
            ))}
          </div>
        </div>
      </div>
    </PageContent>
  )
}

export default JobSeekerDashboard
