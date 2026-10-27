import Avatar from '../../components/common/Avatar.jsx'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import CourseCard from '../../components/cards/CourseCard.jsx'
import JobCard from '../../components/cards/JobCard.jsx'
import Table from '../../components/common/Table.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import { studentProfile } from '../../data/candidateData.js'
import { studentDashboard } from '../../data/dashboardData.js'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function StudentDashboard() {
  const firstName = studentProfile.fullName.split(' ')[0]
  const { stats, careerTarget, skillGap, learning, jobs, applications } = studentDashboard

  return (
    <PageContent width="wide">
      <Card className="mb-8">
        <div className="flex items-start gap-4">
          <Avatar name={studentProfile.fullName} size="lg" />
          <div>
            <h1 className="po-page-title">
              {greeting()}, {firstName}
            </h1>
            <p className="po-secondary mt-1">{studentDashboard.greetingSupport}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="po-secondary">Career target</p>
          <h2 className="po-section-title mt-1">{careerTarget.title}</h2>
          <p className="po-helper mt-1">{careerTarget.industry}</p>
          <p className="po-secondary mt-3">{careerTarget.description}</p>
          <p className="mt-4 text-sm font-medium text-ink">Readiness {careerTarget.readiness}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-page">
            <div className="h-full rounded-full bg-primary" style={{ width: `${careerTarget.readiness}%` }} />
          </div>
          <div className="mt-5">
            <Button to="/student/career-target" variant="secondary">
              View Career Target
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="po-section-title">Skill Gap Overview</h2>
              <p className="po-secondary mt-1">A compact summary for your Data Analyst target.</p>
            </div>
            <Button to="/student/skill-gap" size="sm" variant="secondary">
              View Full Analysis
            </Button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div>
              <p className="text-2xl font-semibold text-ink">{skillGap.matchedCount}</p>
              <p className="po-helper">Matched Skills</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-ink">{skillGap.needsImprovementCount}</p>
              <p className="po-helper">Needs Improvement</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-ink">{skillGap.missingCount}</p>
              <p className="po-helper">Missing Skills</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div>
              <p className="po-helper mb-2">Matched</p>
              <div className="flex flex-wrap gap-2">
                {skillGap.matched.map((skill) => (
                  <Badge key={skill} status="matched">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="po-helper mb-2">Needs improvement</p>
              <div className="flex flex-wrap gap-2">
                {skillGap.needsImprovement.map((skill) => (
                  <Badge key={skill} status="insufficient">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="po-helper mb-2">Missing</p>
              <div className="flex flex-wrap gap-2">
                {skillGap.missing.map((skill) => (
                  <Badge key={skill} status="missing">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <section className="po-section-block">
        <SectionHeader
          title="Recommended learning"
          action={
            <Button to="/student/learning" variant="ghost" size="sm">
              View Learning
            </Button>
          }
        />
        <div className="grid gap-4 md:grid-cols-3">
          {learning.map((course) => (
            <CourseCard key={course.id} course={course} to={`/student/learning/${course.id}`} />
          ))}
        </div>
      </section>

      <section className="po-section-block">
        <SectionHeader
          title="Recommended jobs"
          action={
            <Button to="/student/jobs" variant="ghost" size="sm">
              Explore Jobs
            </Button>
          }
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} to={`/student/jobs/${job.id}`} />
          ))}
        </div>
      </section>

      <section className="po-section-block">
        <SectionHeader title="Recent applications" />
        <Table
          headers={['Job', 'Company', 'Status']}
          rows={applications.map((item) => [
            item.job,
            item.company,
            <Badge key={item.job} status={item.status.toLowerCase()}>
              {item.status}
            </Badge>,
          ])}
        />
      </section>
    </PageContent>
  )
}

export default StudentDashboard
