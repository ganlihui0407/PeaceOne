import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import Field from '../../components/forms/Field.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import DateInput from '../../components/forms/DateInput.jsx'
import { skillCatalogue } from '../../data/skills.js'
import {
  defaultCreateSkills,
  emptyRequiredSkill,
  employmentTypes,
  getEmployerJob,
  importanceWeights,
  jobStatuses,
  requiredLevels,
} from '../../data/employerJobs.js'

function nextSkillId() {
  return `skill-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function SalaryField({ id, label, value, onChange, placeholder }) {
  return (
    <Field id={id} label={label}>
      {(describedBy) => (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm font-medium text-muted">RM</span>
          <input
            id={id}
            type="text"
            inputMode="numeric"
            aria-describedby={describedBy}
            className="po-field"
            value={value}
            placeholder={placeholder}
            onChange={onChange}
          />
        </div>
      )}
    </Field>
  )
}

function createDefaults() {
  return {
    companyName: 'Nexa Digital',
    jobTitle: '',
    jobDescription: '',
    qualificationRequired: '',
    experienceRequired: '',
    employmentType: 'Full-Time',
    location: '',
    salaryMin: '',
    salaryMax: '',
    jobStatus: 'Draft',
    postedDate: '',
    closingDate: '',
    requiredSkills: defaultCreateSkills.map((skill) => ({ ...skill })),
  }
}

function jobToForm(job) {
  return {
    companyName: job.companyName,
    jobTitle: job.jobTitle,
    jobDescription: job.jobDescription,
    qualificationRequired: job.qualificationRequired,
    experienceRequired: job.experienceRequired,
    employmentType: job.employmentType,
    location: job.location,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    jobStatus: job.jobStatus,
    postedDate: job.postedDate,
    closingDate: job.closingDate,
    requiredSkills: job.requiredSkills.map((skill) => ({ ...skill })),
  }
}

function JobPostingFormPage() {
  const { jobId } = useParams()
  return <JobPostingForm key={jobId || 'create'} jobId={jobId} />
}

function JobPostingForm({ jobId }) {
  const navigate = useNavigate()
  const existing = jobId ? getEmployerJob(jobId) : null
  const isEdit = Boolean(existing)
  const [form, setForm] = useState(() => (existing ? jobToForm(existing) : createDefaults()))
  const [toast, setToast] = useState('')
  const [published, setPublished] = useState(false)

  const title = isEdit ? 'Edit Job Posting' : 'Create Job Posting'
  const description = isEdit
    ? 'Update the vacancy details and required skills for this job posting.'
    : 'Enter the vacancy details and required skills for this job posting.'

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateSkill(skillId, key, value) {
    setForm((current) => ({
      ...current,
      requiredSkills: current.requiredSkills.map((skill) =>
        skill.id === skillId ? { ...skill, [key]: value } : skill,
      ),
    }))
  }

  function addSkill() {
    setForm((current) => ({
      ...current,
      requiredSkills: [
        ...current.requiredSkills,
        { id: nextSkillId(), ...emptyRequiredSkill },
      ],
    }))
  }

  function removeSkill(skillId) {
    setForm((current) => ({
      ...current,
      requiredSkills: current.requiredSkills.filter((skill) => skill.id !== skillId),
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isEdit) {
      setToast('Job posting changes saved.')
    } else {
      setPublished(true)
      setToast('Job posting published successfully.')
    }
    window.setTimeout(() => setToast(''), 2500)
  }

  const headingActions = useMemo(
    () =>
      isEdit ? (
        <Button variant="secondary" to={`/employer/jobs/${jobId}`}>
          View Job Posting
        </Button>
      ) : null,
    [isEdit, jobId],
  )

  if (jobId && !existing) {
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
    <PageContent title={title} description={description} actions={headingActions}>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card>
          <h2 className="po-section-title">Job & Company Information</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <TextInput
              id="job-company-name"
              label="Company Name"
              value={form.companyName}
              onChange={(event) => updateField('companyName', event.target.value)}
            />
            <TextInput
              id="job-title"
              label="Job Title"
              value={form.jobTitle}
              placeholder="Data Analyst"
              onChange={(event) => updateField('jobTitle', event.target.value)}
            />
            <div className="md:col-span-2">
              <TextArea
                id="job-description"
                label="Job Description"
                rows={5}
                value={form.jobDescription}
                onChange={(event) => updateField('jobDescription', event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <TextArea
                id="job-qualification"
                label="Qualification Required"
                rows={4}
                value={form.qualificationRequired}
                onChange={(event) => updateField('qualificationRequired', event.target.value)}
              />
            </div>
            <TextInput
              id="job-experience"
              label="Experience Required"
              value={form.experienceRequired}
              placeholder="1–2 years"
              onChange={(event) => updateField('experienceRequired', event.target.value)}
            />
            <SelectInput
              id="job-employment-type"
              label="Employment Type"
              value={form.employmentType}
              onChange={(event) => updateField('employmentType', event.target.value)}
              options={employmentTypes}
            />
            <TextInput
              id="job-location"
              label="Location"
              value={form.location}
              placeholder="Kuala Lumpur"
              onChange={(event) => updateField('location', event.target.value)}
            />
            <SalaryField
              id="job-salary-min"
              label="Salary Min"
              value={form.salaryMin}
              placeholder="4000"
              onChange={(event) => updateField('salaryMin', event.target.value)}
            />
            <SalaryField
              id="job-salary-max"
              label="Salary Max"
              value={form.salaryMax}
              placeholder="6500"
              onChange={(event) => updateField('salaryMax', event.target.value)}
            />
            <SelectInput
              id="job-status"
              label="Job Status"
              value={form.jobStatus}
              onChange={(event) => updateField('jobStatus', event.target.value)}
              options={jobStatuses}
            />
            <DateInput
              id="job-posted-date"
              label="Posted Date"
              value={form.postedDate}
              onChange={(event) => updateField('postedDate', event.target.value)}
            />
            <DateInput
              id="job-closing-date"
              label="Closing Date"
              value={form.closingDate}
              onChange={(event) => updateField('closingDate', event.target.value)}
            />
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Required Skills"
            description="Add the skills expected for this vacancy."
            action={
              <Button type="button" variant="outline" onClick={addSkill}>
                + Add Skill
              </Button>
            }
          />

          <div className="space-y-4">
            {form.requiredSkills.map((skill, index) => (
              <div
                key={skill.id}
                className="grid gap-4 rounded-xl border border-line bg-page/60 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
              >
                <Field id={`${skill.id}-name`} label="Skill Name">
                  {(describedBy) => (
                    <>
                      <input
                        id={`${skill.id}-name`}
                        list={`${skill.id}-skill-options`}
                        aria-describedby={describedBy}
                        className="po-field"
                        value={skill.skillName}
                        placeholder="JavaScript"
                        onChange={(event) => updateSkill(skill.id, 'skillName', event.target.value)}
                      />
                      <datalist id={`${skill.id}-skill-options`}>
                        {skillCatalogue.map((item) => (
                          <option key={item.skillName} value={item.skillName} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <SelectInput
                  id={`${skill.id}-level`}
                  label="Required Level"
                  value={skill.requiredLevel}
                  onChange={(event) => updateSkill(skill.id, 'requiredLevel', event.target.value)}
                  options={requiredLevels}
                />
                <SelectInput
                  id={`${skill.id}-weight`}
                  label="Importance Weight (1–5)"
                  value={skill.importanceWeight}
                  onChange={(event) => updateSkill(skill.id, 'importanceWeight', event.target.value)}
                  options={importanceWeights}
                />
                <div className="flex items-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    className="w-full md:w-auto"
                    aria-label={`Remove skill ${index + 1}`}
                    onClick={() => removeSkill(skill.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {published ? (
          <Card className="border-primary/20 bg-soft/40">
            <p className="po-body">Job posting published successfully.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button to="/employer/jobs" variant="secondary">
                View Job Posting
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate('/employer/jobs')}>
                Back to Manage Jobs
              </Button>
            </div>
          </Card>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" to="/employer/jobs">
            Cancel
          </Button>
          <Button type="submit">{isEdit ? 'Save Changes' : 'Publish Job Posting'}</Button>
        </div>
      </form>
      <Toast message={toast} />
    </PageContent>
  )
}

export default JobPostingFormPage
