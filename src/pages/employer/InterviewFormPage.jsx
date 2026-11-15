import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DateInput from '../../components/forms/DateInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import TimeInput from '../../components/forms/TimeInput.jsx'
import {
  APPLICATION_LIST_LIMIT,
  fetchEmployerApplications,
  formatApplicationStatus,
  isApplicationId,
} from '../../api/applications.js'
import {
  DEFAULT_INTERVIEW_TIMEZONE,
  INTERVIEW_DURATION_OPTIONS,
  INTERVIEW_INSTRUCTIONS_MAX,
  INTERVIEW_NOTES_MAX,
  INTERVIEW_TIMEZONE_OPTIONS,
  INTERVIEW_TYPE_OPTIONS,
  canUpdateInterviewSchedule,
  combineDateTimeToIso,
  createEmployerInterview,
  employerInterviewPath,
  fetchEmployerInterview,
  fetchEmployerInterviews,
  isAbortError,
  isInterviewId,
  splitIsoToDateTime,
  updateEmployerInterviewSchedule,
  userFacingInterviewError,
} from '../../api/interviews.js'

function emptyForm() {
  return {
    applicationId: '',
    interviewType: 'ONLINE',
    interviewDate: '',
    interviewTime: '',
    durationMinutes: '45',
    timezone: DEFAULT_INTERVIEW_TIMEZONE,
    meetingLink: '',
    venue: '',
    instructions: '',
    employerNotes: '',
  }
}

function InterviewFormPage() {
  const { interviewId } = useParams()
  return <InterviewForm key={interviewId || 'create'} interviewId={interviewId} />
}

function InterviewForm({ interviewId }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryApplicationId = isApplicationId(searchParams.get('applicationId') || '')
    ? searchParams.get('applicationId')
    : ''
  const isEdit = isInterviewId(interviewId)
  const [form, setForm] = useState(() => ({ ...emptyForm(), applicationId: queryApplicationId }))
  const [applicationOptions, setApplicationOptions] = useState([{ value: '', label: 'Select a shortlisted application' }])
  const [existing, setExisting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setNotFound(false)

    async function load() {
      if (isEdit) {
        const interview = await fetchEmployerInterview(interviewId, { signal: controller.signal })
        if (controller.signal.aborted) {
          return
        }
        if (!canUpdateInterviewSchedule(interview)) {
          setExisting(interview)
          return
        }
        const parts = splitIsoToDateTime(interview.scheduledStartAt, interview.timezone)
        setExisting(interview)
        setForm({
          applicationId: interview.applicationId,
          interviewType: interview.interviewType,
          interviewDate: parts.date,
          interviewTime: parts.time,
          durationMinutes: String(interview.durationMinutes),
          timezone: interview.timezone || DEFAULT_INTERVIEW_TIMEZONE,
          meetingLink: interview.meetingLink || '',
          venue: interview.venue || '',
          instructions: interview.instructions || '',
          employerNotes: interview.employerNotes || '',
        })
        return
      }

      const [shortlisted, interviewApps] = await Promise.all([
        fetchEmployerApplications({ status: 'SHORTLISTED', page: 1, limit: APPLICATION_LIST_LIMIT, signal: controller.signal }),
        fetchEmployerApplications({ status: 'INTERVIEW', page: 1, limit: APPLICATION_LIST_LIMIT, signal: controller.signal }),
      ])
      if (controller.signal.aborted) {
        return
      }
      const applications = [...shortlisted.items, ...interviewApps.items]
      const activeChecks = await Promise.all(
        applications.map((application) => fetchEmployerInterviews({
          applicationId: application.id,
          page: 1,
          limit: 5,
          signal: controller.signal,
        })),
      )
      if (controller.signal.aborted) {
        return
      }
      const options = applications
        .filter((application, index) => {
          const active = activeChecks[index].items.some((item) => (
            item.status === 'PROPOSED' || item.status === 'RESCHEDULE_REQUESTED' || item.status === 'CONFIRMED'
          ))
          return !active
        })
        .map((application) => ({
          value: application.id,
          label: `${application.applicant?.fullName || 'Candidate'} · ${application.job?.title || 'Job'} · ${formatApplicationStatus(application.status)}`,
        }))
      setApplicationOptions([{ value: '', label: 'Select a shortlisted application' }, ...options])
      if (queryApplicationId) {
        setForm((current) => ({ ...current, applicationId: queryApplicationId }))
      }
    }

    load()
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        if (loadError.status === 404) {
          setNotFound(true)
          return
        }
        setError(userFacingInterviewError(loadError))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [interviewId, isEdit, queryApplicationId])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const locationError = useMemo(() => {
    if (form.interviewType === 'ONLINE' && !form.meetingLink.trim()) {
      return 'Enter a meeting link for an online interview.'
    }
    if (form.interviewType === 'ONSITE' && !form.venue.trim()) {
      return 'Enter a venue for an on-site interview.'
    }
    return ''
  }, [form.interviewType, form.meetingLink, form.venue])

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) {
      return
    }
    const scheduledStartAt = combineDateTimeToIso(form.interviewDate, form.interviewTime, form.timezone)
    if (!scheduledStartAt) {
      setActionError('Enter a valid future date and time.')
      return
    }
    if (locationError) {
      setActionError(locationError)
      return
    }
    setBusy(true)
    setActionError('')
    try {
      const body = {
        interviewType: form.interviewType,
        scheduledStartAt,
        durationMinutes: Number.parseInt(form.durationMinutes, 10),
        timezone: form.timezone,
        meetingLink: form.meetingLink.trim() || null,
        venue: form.venue.trim() || null,
        instructions: form.instructions.trim() || null,
      }
      let saved
      if (isEdit) {
        saved = await updateEmployerInterviewSchedule(interviewId, body)
        setToast('Interview schedule updated.')
      } else {
        saved = await createEmployerInterview({
          applicationId: form.applicationId,
          ...body,
          employerNotes: form.employerNotes.trim() || null,
        })
        setToast('Interview invitation sent.')
      }
      navigate(employerInterviewPath(saved.id))
    } catch (submitError) {
      setActionError(userFacingInterviewError(submitError))
    } finally {
      setBusy(false)
    }
  }

  if (notFound) {
    return (
      <PageContent title="Interview not found">
        <Card>
          <p className="po-body">This interview could not be found.</p>
          <div className="mt-5">
            <Button to="/employer/interviews" variant="secondary">Back to Interview Management</Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  if (isEdit && existing && !canUpdateInterviewSchedule(existing)) {
    return (
      <PageContent title="Interview cannot be edited">
        <Card>
          <p className="po-body">
            Completed, confirmed, declined or cancelled interviews cannot be rewritten. Open the interview
            details to cancel, complete or review history.
          </p>
          <div className="mt-5">
            <Button to={employerInterviewPath(existing.id)} variant="secondary">Open interview</Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent
      title={isEdit ? 'Update interview schedule' : 'Schedule Interview'}
      description={
        isEdit
          ? 'Propose a new date and time. The previous schedule stays in interview history.'
          : 'Invite a shortlisted candidate. Sending the invitation does not change application status.'
      }
    >
      <QueryStatus
        loading={loading}
        error={error}
        loadingLabel="Loading interview form…"
        onRetry={() => window.location.reload()}
      >
        <form className="space-y-6" onSubmit={handleSubmit}>
          <Card>
            <h2 className="po-section-title">Interview details</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {isEdit ? (
                <TextInput
                  id="interview-application"
                  label="Application"
                  value={existing?.candidate?.fullName ? `${existing.candidate.fullName} · ${existing.job?.title || ''}` : existing?.applicationId}
                  disabled
                />
              ) : (
                <SelectInput
                  id="interview-application"
                  label="Application"
                  required
                  value={form.applicationId}
                  onChange={(event) => updateField('applicationId', event.target.value)}
                  options={applicationOptions}
                />
              )}
              <SelectInput
                id="interview-type"
                label="Interview type"
                required
                value={form.interviewType}
                onChange={(event) => updateField('interviewType', event.target.value)}
                options={INTERVIEW_TYPE_OPTIONS}
              />
              <DateInput
                id="interview-date"
                label="Interview date"
                required
                value={form.interviewDate}
                onChange={(event) => updateField('interviewDate', event.target.value)}
              />
              <TimeInput
                id="interview-time"
                label="Interview time"
                required
                value={form.interviewTime}
                onChange={(event) => updateField('interviewTime', event.target.value)}
              />
              <SelectInput
                id="interview-duration"
                label="Duration"
                required
                value={form.durationMinutes}
                onChange={(event) => updateField('durationMinutes', event.target.value)}
                options={INTERVIEW_DURATION_OPTIONS}
              />
              <SelectInput
                id="interview-timezone"
                label="Timezone"
                required
                value={form.timezone}
                onChange={(event) => updateField('timezone', event.target.value)}
                options={INTERVIEW_TIMEZONE_OPTIONS}
              />
              {form.interviewType === 'ONLINE' ? (
                <TextInput
                  id="interview-link"
                  label="Meeting link"
                  required
                  value={form.meetingLink}
                  placeholder="https://meet.example.com/room"
                  onChange={(event) => updateField('meetingLink', event.target.value)}
                />
              ) : null}
              {form.interviewType === 'ONSITE' ? (
                <TextInput
                  id="interview-venue"
                  label="Venue"
                  required
                  value={form.venue}
                  placeholder="Meeting Room A"
                  onChange={(event) => updateField('venue', event.target.value)}
                />
              ) : (
                <TextInput
                  id="interview-venue-optional"
                  label="Venue (optional)"
                  value={form.venue}
                  onChange={(event) => updateField('venue', event.target.value)}
                />
              )}
              {form.interviewType === 'PHONE' ? (
                <TextInput
                  id="interview-link-optional"
                  label="Meeting link (optional)"
                  value={form.meetingLink}
                  onChange={(event) => updateField('meetingLink', event.target.value)}
                />
              ) : null}
              <div className="md:col-span-2">
                <TextArea
                  id="interview-instructions"
                  label="Instructions for the candidate"
                  rows={4}
                  maxLength={INTERVIEW_INSTRUCTIONS_MAX}
                  value={form.instructions}
                  onChange={(event) => updateField('instructions', event.target.value)}
                />
              </div>
              {isEdit ? null : (
                <div className="md:col-span-2">
                  <TextArea
                    id="interview-notes"
                    label="Internal employer notes"
                    rows={3}
                    maxLength={INTERVIEW_NOTES_MAX}
                    value={form.employerNotes}
                    onChange={(event) => updateField('employerNotes', event.target.value)}
                    helperText="This note stays internal to your company."
                  />
                </div>
              )}
            </div>
          </Card>
          {actionError ? (
            <p className="po-helper po-helper-error" role="alert">{actionError}</p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" to="/employer/interviews">Cancel</Button>
            <Button type="submit" disabled={busy || (!isEdit && !form.applicationId)}>
              {busy ? 'Saving…' : isEdit ? 'Update schedule' : 'Send invitation'}
            </Button>
          </div>
        </form>
      </QueryStatus>
      <Toast message={toast} />
    </PageContent>
  )
}

export default InterviewFormPage
