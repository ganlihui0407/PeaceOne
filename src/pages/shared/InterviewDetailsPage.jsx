import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DateInput from '../../components/forms/DateInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import TimeInput from '../../components/forms/TimeInput.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import { candidateApplicationPath } from '../../api/applications.js'
import {
  DEFAULT_INTERVIEW_TIMEZONE,
  INTERVIEW_DURATION_OPTIONS,
  INTERVIEW_RESPONSE_NOTE_MAX,
  INTERVIEW_TIMEZONE_OPTIONS,
  acceptMyInterview,
  canAcceptInterview,
  canDeclineInterview,
  canRequestReschedule,
  candidateInterviewsPath,
  combineDateTimeToIso,
  declineMyInterview,
  fetchMyInterview,
  formatInterviewStatus,
  formatInterviewType,
  formatInterviewWhen,
  formatJobDateTime,
  interviewStatusTone,
  isAbortError,
  isInterviewId,
  rescheduleMyInterview,
  userFacingInterviewError,
} from '../../api/interviews.js'

function displayValue(value) {
  if (value == null || value === '') {
    return '—'
  }
  return String(value)
}

function InterviewDetailsPage({ basePath }) {
  const { interviewId } = useParams()
  return <InterviewDetailsView key={interviewId} basePath={basePath} interviewId={interviewId} />
}

function InterviewDetailsView({ basePath, interviewId }) {
  const validId = isInterviewId(interviewId)
  const listPath = candidateInterviewsPath(basePath)
  const [interview, setInterview] = useState(null)
  const [loading, setLoading] = useState(validId)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(!validId)
  const [retryNonce, setRetryNonce] = useState(0)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [toast, setToast] = useState('')
  const [declineOpen, setDeclineOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [responseNote, setResponseNote] = useState('')
  const [requestedDate, setRequestedDate] = useState('')
  const [requestedTime, setRequestedTime] = useState('')
  const [requestedDuration, setRequestedDuration] = useState('45')
  const [timezone, setTimezone] = useState(DEFAULT_INTERVIEW_TIMEZONE)

  useEffect(() => {
    if (!validId) {
      return undefined
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setNotFound(false)
    fetchMyInterview(interviewId, { signal: controller.signal })
      .then((next) => {
        if (!controller.signal.aborted) {
          setInterview(next)
          setTimezone(next.timezone || DEFAULT_INTERVIEW_TIMEZONE)
          setRequestedDuration(String(next.durationMinutes || 45))
        }
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || controller.signal.aborted) {
          return
        }
        setInterview(null)
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
  }, [interviewId, retryNonce, validId])

  async function runAction(action, successMessage) {
    if (!interview || busy) {
      return
    }
    setBusy(true)
    setActionError('')
    try {
      const next = await action()
      setInterview(next)
      setToast(successMessage)
      setDeclineOpen(false)
      setRescheduleOpen(false)
      window.setTimeout(() => setToast(''), 2500)
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
          <p className="po-body">This interview could not be found for your account.</p>
          <div className="mt-5">
            <Button to={listPath} variant="secondary">Back to My Interviews</Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent
      title={interview?.title || 'Interview details'}
      description="Respond to this invitation or review the confirmed schedule stored for your account."
      actions={<Button variant="secondary" to={listPath}>All interviews</Button>}
    >
      <QueryStatus
        loading={loading}
        error={error}
        loadingLabel="Loading interview…"
        onRetry={() => setRetryNonce((current) => current + 1)}
      >
        {interview ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
            <div className="space-y-6">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="po-section-title">{interview.title}</h2>
                    <p className="po-secondary mt-1">
                      {interview.job?.company?.companyName || 'Company'} · Round {interview.roundNumber}
                    </p>
                  </div>
                  <Badge tone={interviewStatusTone(interview.status)} className="normal-case">
                    {formatInterviewStatus(interview.status)}
                  </Badge>
                </div>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Job" value={displayValue(interview.job?.title)} />
                  <DetailItem label="When" value={formatInterviewWhen(interview)} />
                  <DetailItem label="Duration" value={`${interview.durationMinutes} minutes`} />
                  <DetailItem label="Type" value={formatInterviewType(interview.interviewType)} />
                  <DetailItem label="Meeting link" value={displayValue(interview.meetingLink)} />
                  <DetailItem label="Venue" value={displayValue(interview.venue)} />
                  {interview.requestedStartAt ? (
                    <DetailItem
                      label="Requested time"
                      value={`${formatJobDateTime(interview.requestedStartAt)} (${interview.timezone})`}
                    />
                  ) : null}
                </dl>
                <p className="po-helper mt-5">Instructions</p>
                <p className="po-body mt-1">{displayValue(interview.instructions)}</p>
                {interview.candidateResponseNote ? (
                  <>
                    <p className="po-helper mt-5">Your note</p>
                    <p className="po-body mt-1">{interview.candidateResponseNote}</p>
                  </>
                ) : null}
              </Card>

              <Card>
                <h2 className="po-section-title">Interview history</h2>
                <div className="mt-5">
                  <Table
                    minWidthClass="min-w-[640px]"
                    headers={['Event', 'From', 'To', 'When']}
                    rows={(interview.events || []).map((event) => [
                      event.eventType.replaceAll('_', ' '),
                      event.previousStatus ? formatInterviewStatus(event.previousStatus) : '—',
                      formatInterviewStatus(event.newStatus),
                      formatJobDateTime(event.createdAt),
                    ])}
                    emptyTitle="No interview history is stored."
                  />
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <h2 className="po-section-title">Your response</h2>
                <p className="po-secondary mt-2">
                  Accepting the first invitation moves the application to Interview. Later rounds keep that status.
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {canAcceptInterview(interview) ? (
                    <Button
                      onClick={() => runAction(() => acceptMyInterview(interview.id), 'Interview accepted.')}
                      disabled={busy}
                    >
                      Accept invitation
                    </Button>
                  ) : null}
                  {canDeclineInterview(interview) ? (
                    <Button variant="danger" onClick={() => setDeclineOpen(true)} disabled={busy}>
                      Decline
                    </Button>
                  ) : null}
                  {canRequestReschedule(interview) ? (
                    <Button variant="secondary" onClick={() => setRescheduleOpen(true)} disabled={busy}>
                      Request rescheduling
                    </Button>
                  ) : null}
                  {interview.meetingLink ? (
                    <Button
                      variant="secondary"
                      onClick={() => window.open(interview.meetingLink, '_blank', 'noopener,noreferrer')}
                    >
                      Open meeting link
                    </Button>
                  ) : null}
                  <Button variant="secondary" to={candidateApplicationPath(basePath, interview.applicationId)}>
                    Open application
                  </Button>
                </div>
                {actionError ? (
                  <p className="po-helper po-helper-error mt-4" role="alert">{actionError}</p>
                ) : null}
              </Card>
            </div>
          </div>
        ) : null}
      </QueryStatus>

      <Modal
        open={declineOpen}
        title="Decline interview"
        onClose={() => setDeclineOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeclineOpen(false)} disabled={busy}>Close</Button>
            <Button
              variant="danger"
              onClick={() => runAction(
                () => declineMyInterview(interview.id, { candidateResponseNote: responseNote }),
                'Interview declined.',
              )}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Confirm decline'}
            </Button>
          </>
        }
      >
        <TextArea
          id="decline-note"
          label="Reason (optional)"
          rows={4}
          maxLength={INTERVIEW_RESPONSE_NOTE_MAX}
          value={responseNote}
          onChange={(event) => setResponseNote(event.target.value)}
        />
      </Modal>

      <Modal
        open={rescheduleOpen}
        title="Request a new time"
        onClose={() => setRescheduleOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRescheduleOpen(false)} disabled={busy}>Close</Button>
            <Button
              onClick={() => {
                const requestedStartAt = combineDateTimeToIso(requestedDate, requestedTime, timezone)
                if (!requestedStartAt) {
                  setActionError('Enter a valid future date and time.')
                  return
                }
                runAction(
                  () => rescheduleMyInterview(interview.id, {
                    requestedStartAt,
                    requestedDurationMinutes: Number.parseInt(requestedDuration, 10),
                    candidateResponseNote: responseNote,
                  }),
                  'Reschedule request sent.',
                )
              }}
              disabled={busy}
            >
              {busy ? 'Sending…' : 'Send request'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <DateInput
            id="requested-date"
            label="Requested date"
            required
            value={requestedDate}
            onChange={(event) => setRequestedDate(event.target.value)}
          />
          <TimeInput
            id="requested-time"
            label="Requested time"
            required
            value={requestedTime}
            onChange={(event) => setRequestedTime(event.target.value)}
          />
          <SelectInput
            id="requested-duration"
            label="Duration"
            value={requestedDuration}
            onChange={(event) => setRequestedDuration(event.target.value)}
            options={INTERVIEW_DURATION_OPTIONS}
          />
          <SelectInput
            id="requested-timezone"
            label="Timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            options={INTERVIEW_TIMEZONE_OPTIONS}
          />
          <TextArea
            id="reschedule-note"
            label="Reason (optional)"
            rows={3}
            maxLength={INTERVIEW_RESPONSE_NOTE_MAX}
            value={responseNote}
            onChange={(event) => setResponseNote(event.target.value)}
          />
        </div>
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default InterviewDetailsPage
