import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DateInput from '../../components/forms/DateInput.jsx'
import Field from '../../components/forms/Field.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import EscoJobSkillPicker from '../../components/jobs/EscoJobSkillPicker.jsx'
import {
  EMPLOYMENT_TYPE_OPTIONS,
  JOB_FIELD_LIMITS,
  canPublishJob,
  formatJobStatus,
  publishStaffJob,
  staffJobPath,
  staffJobsPath,
  userFacingJobError,
} from '../../api/jobs.js'
import { useJobPostingForm } from '../../hooks/useJobPostingForm.js'

function SalaryField({ id, label, value, error, disabled, onChange, placeholder }) {
  return (
    <Field id={id} label={label} error={error}>
      {(describedBy) => (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm font-medium text-muted">RM</span>
          <input
            id={id}
            type="text"
            inputMode="numeric"
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            className="po-field"
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      )}
    </Field>
  )
}

function JobPostingFormPage() {
  const { jobId } = useParams()
  return <JobPostingForm key={jobId || 'create'} jobId={jobId} />
}

function JobPostingForm({ jobId }) {
  const navigate = useNavigate()
  const {
    isEdit,
    company,
    job,
    form,
    fieldErrors,
    loading,
    saving,
    loadError,
    saveError,
    notFound,
    retry,
    updateField,
    setRequiredSkills,
    save,
  } = useJobPostingForm(jobId)
  const [toast, setToast] = useState('')
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')

  const title = isEdit ? 'Edit Job Posting' : 'Create Job Posting'
  const description = isEdit
    ? 'Update the vacancy details and required ESCO skills for this job posting.'
    : 'Enter the vacancy details and required ESCO skills. Saving creates a draft.'
  const readOnly = Boolean(job) && !canPublishJob(job) && job.status !== 'PUBLISHED'
  const disabled = saving || publishing || readOnly

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function handleSave(event) {
    event.preventDefault()
    const saved = await save()
    if (!saved) {
      return
    }
    if (!isEdit) {
      navigate(staffJobPath(saved.id), { replace: true })
      return
    }
    showToast('Job posting changes saved.')
  }

  async function handlePublish() {
    setPublishing(true)
    setPublishError('')
    try {
      const saved = await save()
      if (!saved) {
        return
      }
      const published = await publishStaffJob(saved.id)
      setPublishOpen(false)
      showToast('Job posting published.')
      navigate(staffJobPath(published.id))
    } catch (error) {
      setPublishError(userFacingJobError(error))
    } finally {
      setPublishing(false)
    }
  }

  if (notFound) {
    return (
      <PageContent title="Job posting not found">
        <Card>
          <p className="po-body">This job posting could not be found.</p>
          <div className="mt-5">
            <Button to={staffJobsPath()} variant="secondary">
              Back to Manage Job Postings
            </Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent
      title={title}
      description={description}
      actions={
        isEdit && job ? (
          <Button variant="secondary" to={staffJobPath(job.id)}>
            View Job Posting
          </Button>
        ) : null
      }
    >
      <QueryStatus
        loading={loading}
        error={loadError}
        loadingLabel="Loading job posting…"
        onRetry={retry}
      >
        {!company ? (
          <Card>
            <p className="po-body">Save a company profile before creating or managing job postings.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button to="/employer/company">Open Company Profile</Button>
              <Button variant="secondary" to={staffJobsPath()}>
                Back to Manage Job Postings
              </Button>
            </div>
          </Card>
        ) : (
          <form className="space-y-6" onSubmit={handleSave}>
            <Card>
              <h2 className="po-section-title">Job & Company Information</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <TextInput
                  id="job-company-name"
                  label="Company"
                  value={company.companyName}
                  disabled
                  helperText="Company identity comes from your signed-in company profile."
                />
                {job ? (
                  <TextInput
                    id="job-status"
                    label="Status"
                    value={formatJobStatus(job.status)}
                    disabled
                  />
                ) : null}
                <div className="md:col-span-2">
                  <TextInput
                    id="job-title"
                    label="Job title"
                    required
                    value={form.title}
                    error={fieldErrors.title}
                    disabled={disabled}
                    maxLength={JOB_FIELD_LIMITS.title}
                    placeholder="Data Analyst"
                    onChange={(event) => updateField('title', event.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <TextArea
                    id="job-description"
                    label="Job description"
                    required
                    rows={5}
                    value={form.description}
                    error={fieldErrors.description}
                    disabled={disabled}
                    maxLength={JOB_FIELD_LIMITS.description}
                    onChange={(event) => updateField('description', event.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <TextArea
                    id="job-qualification"
                    label="Qualifications required"
                    required
                    rows={4}
                    value={form.qualificationRequired}
                    error={fieldErrors.qualificationRequired}
                    disabled={disabled}
                    maxLength={JOB_FIELD_LIMITS.qualificationRequired}
                    onChange={(event) => updateField('qualificationRequired', event.target.value)}
                  />
                </div>
                <TextInput
                  id="job-experience"
                  label="Experience required"
                  required
                  value={form.experienceRequired}
                  error={fieldErrors.experienceRequired}
                  disabled={disabled}
                  maxLength={JOB_FIELD_LIMITS.experienceRequired}
                  placeholder="1–2 years"
                  onChange={(event) => updateField('experienceRequired', event.target.value)}
                />
                <SelectInput
                  id="job-employment-type"
                  label="Employment type"
                  required
                  value={form.employmentType}
                  error={fieldErrors.employmentType}
                  disabled={disabled}
                  options={EMPLOYMENT_TYPE_OPTIONS}
                  onChange={(event) => updateField('employmentType', event.target.value)}
                />
                <TextInput
                  id="job-location"
                  label="Location"
                  required
                  value={form.location}
                  error={fieldErrors.location}
                  disabled={disabled}
                  maxLength={JOB_FIELD_LIMITS.location}
                  placeholder="Kuala Lumpur"
                  onChange={(event) => updateField('location', event.target.value)}
                />
                <DateInput
                  id="job-closing-date"
                  label="Application closing date"
                  value={form.closesAt}
                  error={fieldErrors.closesAt}
                  disabled={disabled}
                  onChange={(event) => updateField('closesAt', event.target.value)}
                />
                <SalaryField
                  id="job-salary-min"
                  label="Minimum salary"
                  value={form.salaryMin}
                  error={fieldErrors.salaryMin}
                  disabled={disabled}
                  placeholder="4000"
                  onChange={(event) => updateField('salaryMin', event.target.value)}
                />
                <SalaryField
                  id="job-salary-max"
                  label="Maximum salary"
                  value={form.salaryMax}
                  error={fieldErrors.salaryMax}
                  disabled={disabled}
                  placeholder="6500"
                  onChange={(event) => updateField('salaryMax', event.target.value)}
                />
              </div>
            </Card>

            <EscoJobSkillPicker
              skills={form.requiredSkills}
              error={fieldErrors.requiredSkills}
              disabled={disabled}
              onChange={setRequiredSkills}
            />

            {saveError ? <p className="po-helper text-danger">{saveError}</p> : null}
            {publishError ? <p className="po-helper text-danger">{publishError}</p> : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" to={staffJobsPath()}>
                Cancel
              </Button>
              {canPublishJob(job) ? (
                <Button type="button" variant="secondary" disabled={disabled} onClick={() => setPublishOpen(true)}>
                  Publish
                </Button>
              ) : null}
              {readOnly ? null : (
                <Button type="submit" disabled={disabled}>
                  {isEdit ? 'Save Changes' : 'Save draft'}
                </Button>
              )}
            </div>
          </form>
        )}
      </QueryStatus>

      <Modal
        open={publishOpen}
        title="Publish job posting"
        onClose={() => setPublishOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button disabled={publishing} onClick={handlePublish}>
              Publish
            </Button>
          </>
        }
      >
        <p className="po-body">
          Publishing makes this vacancy visible to students and job seekers immediately. Save any remaining edits first
          if you still need to change the draft.
        </p>
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default JobPostingFormPage
