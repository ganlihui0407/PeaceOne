import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { getCandidateJob } from '../../data/candidateJobs.js'

function CandidateJobDetailPage({ basePath, variant = 'student' }) {
  const { jobId } = useParams()
  const job = getCandidateJob(jobId)
  const [toast, setToast] = useState('')
  const isJobSeeker = variant === 'jobseeker'

  if (!job) {
    return (
      <PageContent title="Job Details">
        <Card>
          <p className="po-body">This job posting could not be found.</p>
          <div className="mt-5">
            <Button to={`${basePath}/jobs`}>Back to Jobs</Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent>
      <Link to={`${basePath}/jobs`} className="text-sm font-medium text-primary">
        Back to Jobs
      </Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex flex-wrap gap-2">
            <Badge tone="primary">{job.employmentType}</Badge>
            <Badge status="active" className="normal-case">
              {job.jobStatus}
            </Badge>
            {isJobSeeker && typeof job.match === 'number' ? (
              <Badge tone={job.match >= 80 ? 'success' : 'primary'}>{job.match}% Match</Badge>
            ) : job.careerFit ? (
              <Badge tone="primary" className="normal-case">
                Career Fit: {job.careerFit.replace(' Fit', '')}
              </Badge>
            ) : null}
          </div>
          <h1 className="po-page-title mt-4">{job.jobTitle}</h1>
          <p className="po-secondary mt-2">
            {job.company} · {job.location}
          </p>
          <dl className="po-secondary mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="po-helper">Employment Type</dt>
              <dd className="font-medium text-ink">{job.employmentType}</dd>
            </div>
            <div>
              <dt className="po-helper">Location</dt>
              <dd className="font-medium text-ink">{job.location}</dd>
            </div>
            <div>
              <dt className="po-helper">Salary</dt>
              <dd className="font-medium text-ink">{job.salary}</dd>
            </div>
            <div>
              <dt className="po-helper">Experience Required</dt>
              <dd className="font-medium text-ink">{job.experienceRequired}</dd>
            </div>
            <div>
              <dt className="po-helper">Qualification Required</dt>
              <dd className="font-medium text-ink">{job.qualificationRequired}</dd>
            </div>
            <div>
              <dt className="po-helper">Posted Date</dt>
              <dd className="font-medium text-ink">{job.postedDate}</dd>
            </div>
            <div>
              <dt className="po-helper">Closing Date</dt>
              <dd className="font-medium text-ink">{job.closingDate}</dd>
            </div>
            <div>
              <dt className="po-helper">Job Status</dt>
              <dd className="font-medium text-ink">{job.jobStatus}</dd>
            </div>
          </dl>
          <h2 className="po-section-title mt-8">Job Description</h2>
          <p className="po-secondary mt-2">{job.jobDescription}</p>
          <h2 className="po-section-title mt-8">Required Skills</h2>
          <div className="mt-4">
            <Table
              minWidthClass="min-w-[520px]"
              headers={['Skill Name', 'Required Level', 'Importance']}
              rows={job.requiredSkills.map((item) => [
                item.skillName,
                item.requiredLevel,
                <Badge
                  key={item.skillName}
                  tone={item.importance === 'High' ? 'primary' : 'default'}
                  className="normal-case"
                >
                  {item.importance}
                </Badge>,
              ])}
            />
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button to={`${basePath}/jobs/${job.id}/apply`}>Apply Now</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setToast('Job saved.')
                window.setTimeout(() => setToast(''), 2500)
              }}
            >
              Save Job
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="po-section-title">Company</h2>
            <p className="mt-3 text-lg font-semibold text-ink">{job.companyInfo.name}</p>
            <dl className="po-secondary mt-4 space-y-3">
              <div>
                <dt className="po-helper">Industry</dt>
                <dd className="font-medium text-ink">{job.companyInfo.industry}</dd>
              </div>
              <div>
                <dt className="po-helper">Location</dt>
                <dd className="font-medium text-ink">{job.companyInfo.location}</dd>
              </div>
              <div>
                <dt className="po-helper">Website</dt>
                <dd className="font-medium text-ink">{job.companyInfo.website}</dd>
              </div>
            </dl>
            <p className="po-secondary mt-4">{job.companyInfo.description}</p>
          </Card>

          {isJobSeeker && job.matchBreakdown ? (
            <Card>
              <h2 className="po-section-title">Compatibility Score: {job.match}%</h2>
              <p className="po-secondary mt-2">How this role compares with your current profile.</p>
              <dl className="mt-4 space-y-3">
                <div className="flex justify-between gap-3">
                  <dt className="po-secondary">Skill Match</dt>
                  <dd className="font-medium text-ink">{job.matchBreakdown.skillMatch}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="po-secondary">Qualification</dt>
                  <dd className="font-medium text-ink">{job.matchBreakdown.qualification}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="po-secondary">Experience</dt>
                  <dd className="font-medium text-ink">{job.matchBreakdown.experience}</dd>
                </div>
              </dl>
            </Card>
          ) : (
            <Card>
              <h2 className="po-section-title">Career Fit: {job.careerFit || 'Good'}</h2>
              <p className="po-secondary mt-2">
                This label reflects how closely the role aligns with your selected career target.
              </p>
            </Card>
          )}
        </div>
      </div>
      <Toast message={toast} />
    </PageContent>
  )
}

export default CandidateJobDetailPage
