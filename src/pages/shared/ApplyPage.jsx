import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import RadioGroup from '../../components/forms/RadioGroup.jsx'
import { getCandidateJob } from '../../data/candidateJobs.js'
import { jobSeekerProfile, studentProfile } from '../../data/candidateData.js'
import { mockResumes } from '../../data/resumes.js'

function ApplyPage({ basePath, variant = 'student' }) {
  const { jobId } = useParams()
  const job = getCandidateJob(jobId)
  const profile = variant === 'student' ? studentProfile : jobSeekerProfile
  const primary = mockResumes[variant] || mockResumes.student
  const [resume, setResume] = useState('primary')
  const [open, setOpen] = useState(false)

  const resumeLabel = resume === 'primary' ? primary.fileName : 'Updated_Resume_2026.pdf'

  if (!job) {
    return (
      <PageContent title="Apply">
        <Card>
          <p className="po-body">This role is no longer available.</p>
          <div className="mt-5">
            <Button to={`${basePath}/jobs`}>Back to Jobs</Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent title={`Apply for ${job.jobTitle}`}>
      <Link to={`${basePath}/jobs/${job.id}`} className="text-sm font-medium text-primary">
        Back to job details
      </Link>

      <Card className="mt-5">
        <p className="po-secondary">Job summary</p>
        <h2 className="po-section-title mt-1">{job.jobTitle}</h2>
        <p className="po-secondary mt-1">
          {job.company} · {job.location}
        </p>
      </Card>

      <Card className="mt-6">
        <h2 className="po-section-title">Choose Resume</h2>
        <div className="mt-4">
          <RadioGroup
            name="resume-choice"
            value={resume}
            onChange={setResume}
            options={[
              { value: 'primary', label: `${primary.fileName} — Primary Resume` },
              { value: 'updated', label: 'Updated_Resume_2026.pdf' },
            ]}
          />
        </div>
        <div className="mt-5">
          <Button variant="outline" to={`${basePath}/resume`}>
            Upload Another Resume
          </Button>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="po-section-title">Application summary</h2>
        <dl className="po-secondary mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="po-helper">Applicant Name</dt>
            <dd className="font-medium text-ink">{profile.fullName}</dd>
          </div>
          <div>
            <dt className="po-helper">Email</dt>
            <dd className="font-medium text-ink">{profile.email}</dd>
          </div>
          <div>
            <dt className="po-helper">Selected Resume</dt>
            <dd className="font-medium text-ink">{resumeLabel}</dd>
          </div>
          <div>
            <dt className="po-helper">Applying For</dt>
            <dd className="font-medium text-ink">{job.jobTitle}</dd>
          </div>
          <div>
            <dt className="po-helper">Company</dt>
            <dd className="font-medium text-ink">{job.company}</dd>
          </div>
        </dl>
        <div className="mt-6">
          <Button
            onClick={(event) => {
              event.preventDefault()
              setOpen(true)
            }}
          >
            Submit Application
          </Button>
        </div>
      </Card>

      <Modal
        open={open}
        title="Application submitted"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button to={`${basePath}/applications`}>View Applications</Button>
          </>
        }
      >
        <p className="po-body">Your application has been submitted.</p>
        <p className="po-secondary mt-2">You can review its progress on the Applications page.</p>
      </Modal>
    </PageContent>
  )
}

export default ApplyPage
