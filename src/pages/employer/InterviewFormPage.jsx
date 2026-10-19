import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import DateInput from '../../components/forms/DateInput.jsx'
import TimeInput from '../../components/forms/TimeInput.jsx'
import {
  getEmployerInterview,
  interviewCandidateOptions,
  interviewMethods,
  interviewPositionOptions,
  interviewStatuses,
} from '../../data/employerInterviews.js'

function createDefaults() {
  return {
    candidate: 'Daniel Lee',
    jobTitle: 'Data Analyst',
    interviewDate: '',
    interviewTime: '',
    method: 'Online',
    locationOrLink: '',
    interviewStatus: 'Scheduled',
    notes: '',
  }
}

function interviewToForm(item) {
  return {
    candidate: item.candidate,
    jobTitle: item.jobTitle,
    interviewDate: item.interviewDate,
    interviewTime: item.interviewTime,
    method: item.method,
    locationOrLink: item.locationOrLink,
    interviewStatus: item.interviewStatus,
    notes: item.notes || '',
  }
}

function InterviewFormPage() {
  const { interviewId } = useParams()
  return <InterviewForm key={interviewId || 'create'} interviewId={interviewId} />
}

function InterviewForm({ interviewId }) {
  const existing = interviewId ? getEmployerInterview(interviewId) : null
  const isEdit = Boolean(existing)
  const [form, setForm] = useState(() => (existing ? interviewToForm(existing) : createDefaults()))
  const [toast, setToast] = useState('')
  const [scheduled, setScheduled] = useState(false)

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isEdit) {
      setToast('Interview changes saved.')
    } else {
      setScheduled(true)
      setToast('Interview scheduled successfully.')
    }
    window.setTimeout(() => setToast(''), 2500)
  }

  if (interviewId && !existing) {
    return (
      <PageContent title="Interview not found">
        <Card>
          <p className="po-body">This interview could not be found.</p>
          <div className="mt-5">
            <Button to="/employer/interviews" variant="secondary">
              Back to Interview Management
            </Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent
      title={isEdit ? 'Edit Interview' : 'Schedule Interview'}
      description={
        isEdit
          ? 'Update the interview arrangement for this candidate.'
          : 'Arrange an interview for a shortlisted candidate.'
      }
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card>
          <h2 className="po-section-title">Interview Details</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <SelectInput
              id="interview-candidate"
              label="Candidate"
              value={form.candidate}
              onChange={(event) => updateField('candidate', event.target.value)}
              options={interviewCandidateOptions}
            />
            <SelectInput
              id="interview-job"
              label="Job Application / Position"
              value={form.jobTitle}
              onChange={(event) => updateField('jobTitle', event.target.value)}
              options={interviewPositionOptions}
            />
            <DateInput
              id="interview-date"
              label="Interview Date"
              value={form.interviewDate}
              onChange={(event) => updateField('interviewDate', event.target.value)}
            />
            <TimeInput
              id="interview-time"
              label="Interview Time"
              value={form.interviewTime}
              onChange={(event) => updateField('interviewTime', event.target.value)}
            />
            <SelectInput
              id="interview-method"
              label="Interview Method"
              value={form.method}
              onChange={(event) => updateField('method', event.target.value)}
              options={interviewMethods}
            />
            <TextInput
              id="interview-location"
              label="Location / Link"
              value={form.locationOrLink}
              placeholder="Microsoft Teams or Meeting Room A"
              onChange={(event) => updateField('locationOrLink', event.target.value)}
            />
            <SelectInput
              id="interview-status"
              label="Interview Status"
              value={form.interviewStatus}
              onChange={(event) => updateField('interviewStatus', event.target.value)}
              options={interviewStatuses}
            />
            <div className="md:col-span-2">
              <TextArea
                id="interview-notes"
                label="Notes"
                rows={4}
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
              />
            </div>
          </div>
        </Card>

        {scheduled ? (
          <Card className="border-primary/20 bg-soft/40">
            <p className="po-body">Interview scheduled successfully.</p>
            <div className="mt-4">
              <Button to="/employer/interviews" variant="secondary">
                View Interviews
              </Button>
            </div>
          </Card>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" to="/employer/interviews">
            Cancel
          </Button>
          <Button type="submit">{isEdit ? 'Save Changes' : 'Schedule Interview'}</Button>
        </div>
      </form>
      <Toast message={toast} />
    </PageContent>
  )
}

export default InterviewFormPage
