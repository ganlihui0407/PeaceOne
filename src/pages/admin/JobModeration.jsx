import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import { formatSalaryRange, getAdminJob } from '../../data/adminJobs.js'

function JobModeration() {
  const { jobId } = useParams()
  return <JobModerationView key={jobId} jobId={jobId} />
}

function JobModerationView({ jobId }) {
  const job = getAdminJob(jobId)
  const [reviewStatus, setReviewStatus] = useState(job?.reviewStatus || '')
  const [reviewNotes, setReviewNotes] = useState(job?.reviewNotes || '')
  const [toast, setToast] = useState('')

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  if (!job) {
    return (
      <PageContent title="Job posting not found">
        <Card>
          <p className="po-body">This job posting could not be found.</p>
          <div className="mt-5">
            <Button to="/admin/jobs" variant="secondary">
              Back to Job Monitoring
            </Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent
      title={job.jobTitle}
      description="Review this vacancy and record a mock moderation decision."
      actions={
        <Button variant="secondary" to="/admin/jobs">
          Back to Job Monitoring
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]">
        <div className="space-y-6">
          <Card>
            <h2 className="po-section-title">Job Posting</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailItem label="Company Name" value={job.companyName} />
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
                minWidthClass="min-w-[420px]"
                headers={['Skill Name', 'Required Level']}
                rows={(job.requiredSkills || []).map((skill) => [skill.skillName, skill.requiredLevel])}
              />
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="po-section-title">Administration</h2>
          <div className="mt-4">
            <p className="po-helper mt-0">Review Status</p>
            <Badge status={reviewStatus.toLowerCase()} className="normal-case">
              {reviewStatus}
            </Badge>
          </div>
          <div className="mt-5">
            <TextArea
              id="admin-review-notes"
              label="Review Notes"
              rows={5}
              value={reviewNotes}
              onChange={(event) => setReviewNotes(event.target.value)}
            />
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              onClick={() => {
                setReviewStatus('Approved')
                showToast('Job posting approved.')
              }}
            >
              Approve Posting
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setReviewStatus('Flagged')
                showToast('Job posting flagged.')
              }}
            >
              Flag Posting
            </Button>
            <Button
              variant="danger"
              onClick={() => showToast('Job posting removed from the current view.')}
            >
              Remove Posting
            </Button>
          </div>
        </Card>
      </div>
      <Toast message={toast} />
    </PageContent>
  )
}

export default JobModeration
