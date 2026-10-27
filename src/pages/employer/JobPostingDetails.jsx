import { useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import { formatSalaryRange, getEmployerJob } from '../../data/employerJobs.js'

function JobPostingDetails() {
  const { jobId } = useParams()
  const job = getEmployerJob(jobId)

  if (!job) {
    return (
      <PageContent title="Job posting not found">
        <Card>
          <p className="po-body">This job posting could not be found.</p>
          <div className="mt-5">
            <Button to="/employer/jobs" variant="secondary">
              Back to Manage Job Postings
            </Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent
      title={job.jobTitle}
      description="Review the vacancy details shown to candidates."
      actions={
        <>
          <Button variant="secondary" to={`/employer/applicants`}>
            View Applicants
          </Button>
          <Button to={`/employer/jobs/${job.id}/edit`}>Edit Job Posting</Button>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]">
        <div className="space-y-6">
          <Card>
            <h2 className="po-section-title">Job & Company Information</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailItem label="Company" value={job.companyName} />
              <DetailItem label="Job Title" value={job.jobTitle} />
              <DetailItem label="Employment Type" value={job.employmentType} />
              <DetailItem label="Location" value={job.location} />
              <DetailItem label="Salary Range" value={formatSalaryRange(job)} />
              <div>
                <dt className="po-helper mt-0">Job Status</dt>
                <dd className="mt-1">
                  <Badge status={job.jobStatus.toLowerCase()} className="normal-case">
                    {job.jobStatus}
                  </Badge>
                </dd>
              </div>
              <DetailItem label="Posted Date" value={job.postedDateLabel} />
              <DetailItem label="Closing Date" value={job.closingDateLabel} />
            </dl>
          </Card>

          <Card>
            <h2 className="po-section-title">Job Description</h2>
            <p className="po-body mt-4">{job.jobDescription}</p>
          </Card>

          <Card>
            <h2 className="po-section-title">Qualification Required</h2>
            <p className="po-body mt-4">{job.qualificationRequired}</p>
          </Card>

          <Card>
            <h2 className="po-section-title">Experience Required</h2>
            <p className="po-body mt-4">{job.experienceRequired}</p>
          </Card>

          <Card>
            <h2 className="po-section-title">Required Skills</h2>
            <div className="mt-5">
              <Table
                minWidthClass="min-w-[520px]"
                headers={['Skill Name', 'Required Level', 'Importance Weight (1–5)']}
                rows={job.requiredSkills.map((skill) => [
                  skill.skillName,
                  skill.requiredLevel,
                  skill.importanceWeight,
                ])}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <p className="po-secondary">Applicants</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{job.applicants}</p>
            <p className="po-helper">Candidates who have applied to this posting.</p>
            <div className="mt-5">
              <Button to="/employer/applicants" variant="secondary" className="w-full">
                View Applicants
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </PageContent>
  )
}

export default JobPostingDetails
