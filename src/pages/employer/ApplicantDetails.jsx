import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import ProgressBar from '../../components/common/ProgressBar.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import { getEmployerApplicant } from '../../data/applicants.js'

function ApplicantDetails() {
  const { applicationId } = useParams()
  return <ApplicantDetailsView key={applicationId} applicationId={applicationId} />
}

function ApplicantDetailsView({ applicationId }) {
  const applicant = getEmployerApplicant(applicationId)
  const [status, setStatus] = useState(applicant?.status || '')
  const [toast, setToast] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  function updateStatus(nextStatus, message) {
    setStatus(nextStatus)
    showToast(message)
  }

  if (!applicant) {
    return (
      <PageContent title="Applicant not found">
        <Card>
          <p className="po-body">This application could not be found.</p>
          <div className="mt-5">
            <Button to="/employer/applicants" variant="secondary">
              Back to Applicants
            </Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  const match = applicant.matchResult

  return (
    <PageContent
      title={applicant.fullName}
      description="Review this candidate’s application and decide the next step."
      actions={
        <Button variant="secondary" to="/employer/applicants">
          Back to Applicants
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)]">
        <div className="space-y-6">
          <Card>
            <h2 className="po-section-title">Candidate Profile Information</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailItem label="Full Name" value={applicant.fullName} />
              <DetailItem label="Email" value={applicant.email} />
              <DetailItem label="Phone" value={applicant.phone} />
              <DetailItem label="Location" value={applicant.location} />
              <DetailItem label="Education Level" value={applicant.educationLevel} />
              <DetailItem label="Field of Study" value={applicant.fieldOfStudy} />
              <DetailItem label="Institution" value={applicant.institution} />
              <DetailItem label="Graduation Year" value={applicant.graduationYear} />
              <div className="sm:col-span-2">
                <dt className="po-helper mt-0">Experience Summary</dt>
                <dd className="po-body mt-1">{applicant.experienceSummary}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="po-section-title">Applied Job Information</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailItem label="Job Title" value={applicant.jobTitle} />
              <DetailItem label="Company" value={applicant.company} />
              <DetailItem label="Applied Date" value={applicant.appliedDate} />
              <div>
                <dt className="po-helper mt-0">Application Status</dt>
                <dd className="mt-1">
                  <Badge status={status.toLowerCase()} className="normal-case">
                    {status}
                  </Badge>
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="po-section-title">Submitted Resume</h2>
            <p className="po-card-title mt-4">{applicant.resumeFile}</p>
            <p className="po-helper">Preview is a visual presentation of the submitted file.</p>
            <div className="mt-5">
              <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
                Preview Resume
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="po-section-title">Candidate Skills</h2>
            <div className="mt-5">
              <Table
                minWidthClass="min-w-[520px]"
                headers={['Skill Name', 'Proficiency Level', 'Verification Status']}
                rows={applicant.skills.map((skill) => [
                  skill.skillName,
                  skill.proficiencyLevel,
                  <Badge
                    key={`${skill.skillName}-verify`}
                    status={skill.verificationStatus.toLowerCase()}
                    className="normal-case"
                  >
                    {skill.verificationStatus}
                  </Badge>,
                ])}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="po-section-title">Job Match Result</h2>
            <p className="po-helper mt-1">How this candidate compares with the vacancy requirements.</p>
            <div className="mt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">Overall Match</p>
                  <p className="text-sm font-semibold text-ink">{match.overallMatch}%</p>
                </div>
                <div className="mt-2">
                  <ProgressBar value={match.overallMatch} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">Skill Match</p>
                  <p className="text-sm font-semibold text-ink">{match.skillMatch}%</p>
                </div>
                <div className="mt-2">
                  <ProgressBar value={match.skillMatch} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">Qualification Score</p>
                  <p className="text-sm font-semibold text-ink">{match.qualificationScore}%</p>
                </div>
                <div className="mt-2">
                  <ProgressBar value={match.qualificationScore} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">Experience Score</p>
                  <p className="text-sm font-semibold text-ink">{match.experienceScore}%</p>
                </div>
                <div className="mt-2">
                  <ProgressBar value={match.experienceScore} />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="po-section-title">Application Actions</h2>
            <p className="po-helper">Update the application status for this candidate.</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={() => updateStatus('Shortlisted', 'Candidate shortlisted.')}>
                Shortlist
              </Button>
              <Button
                variant="secondary"
                onClick={() => updateStatus('Interview', 'Candidate moved to Interview.')}
              >
                Move to Interview
              </Button>
              <Button
                variant="danger"
                onClick={() => updateStatus('Rejected', 'Candidate rejected.')}
              >
                Reject
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={previewOpen}
        title="Resume preview"
        onClose={() => setPreviewOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
            Close
          </Button>
        }
      >
        <p className="po-body">{applicant.resumeFile}</p>
        <p className="po-secondary mt-2">
          Resume preview will open here when the file viewer is available.
        </p>
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default ApplicantDetails
