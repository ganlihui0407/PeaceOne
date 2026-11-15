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
import SelectInput from '../../components/forms/SelectInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import { employerApplicantPath, formatApplicationStatus } from '../../api/applications.js'
import {
  INTERVIEW_ATTENDANCE_OPTIONS,
  INTERVIEW_NOTES_MAX,
  INTERVIEW_OUTCOME_OPTIONS,
  canCancelInterview,
  canCompleteInterview,
  canConfirmInterviewReschedule,
  canUpdateInterviewSchedule,
  cancelEmployerInterview,
  completeEmployerInterview,
  confirmEmployerInterviewReschedule,
  employerInterviewEditPath,
  fetchEmployerInterview,
  formatInterviewStatus,
  formatInterviewType,
  formatInterviewWhen,
  formatJobDateTime,
  interviewStatusTone,
  isAbortError,
  isInterviewId,
  userFacingInterviewError,
} from '../../api/interviews.js'

function displayValue(value) {
  if (value == null || value === '') {
    return '—'
  }
  return String(value)
}

function EmployerInterviewDetails() {
  const { interviewId } = useParams()
  return <InterviewDetailsView key={interviewId} interviewId={interviewId} />
}

function InterviewDetailsView({ interviewId }) {
  const validId = isInterviewId(interviewId)
  const [interview, setInterview] = useState(null)
  const [loading, setLoading] = useState(validId)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(!validId)
  const [retryNonce, setRetryNonce] = useState(0)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [toast, setToast] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [attendance, setAttendance] = useState('ATTENDED')
  const [outcome, setOutcome] = useState('')
  const [employerNotes, setEmployerNotes] = useState('')

  useEffect(() => {
    if (!validId) {
      return undefined
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setNotFound(false)
    fetchEmployerInterview(interviewId, { signal: controller.signal })
      .then((next) => {
        if (!controller.signal.aborted) {
          setInterview(next)
          setEmployerNotes(next.employerNotes || '')
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
      setCancelOpen(false)
      setCompleteOpen(false)
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
          <p className="po-body">This interview could not be found for your company.</p>
          <div className="mt-5">
            <Button to="/employer/interviews" variant="secondary">Back to Interview Management</Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent
      title={interview?.title || 'Interview details'}
      description="Review the stored interview, respond to reschedule requests and record completion."
      actions={<Button variant="secondary" to="/employer/interviews">All interviews</Button>}
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
                    <p className="po-secondary mt-1">Round {interview.roundNumber}</p>
                  </div>
                  <Badge tone={interviewStatusTone(interview.status)} className="normal-case">
                    {formatInterviewStatus(interview.status)}
                  </Badge>
                </div>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Candidate" value={displayValue(interview.candidate?.fullName)} />
                  <DetailItem label="Email" value={displayValue(interview.candidate?.email)} />
                  <DetailItem label="Job" value={displayValue(interview.job?.title)} />
                  <DetailItem
                    label="Application status"
                    value={interview.application?.status ? formatApplicationStatus(interview.application.status) : '—'}
                  />
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
                <p className="po-helper mt-5">Internal notes</p>
                <p className="po-body mt-1">{displayValue(interview.employerNotes)}</p>
                {interview.attendance ? (
                  <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                    <DetailItem label="Attendance" value={interview.attendance} />
                    <DetailItem label="Outcome" value={displayValue(interview.outcome)} />
                  </dl>
                ) : null}
              </Card>

              <Card>
                <h2 className="po-section-title">Interview history</h2>
                <div className="mt-5">
                  <Table
                    minWidthClass="min-w-[640px]"
                    headers={['Event', 'From', 'To', 'Actor', 'When']}
                    rows={(interview.events || []).map((event) => [
                      event.eventType.replaceAll('_', ' '),
                      event.previousStatus ? formatInterviewStatus(event.previousStatus) : '—',
                      formatInterviewStatus(event.newStatus),
                      event.actor?.fullName || '—',
                      formatJobDateTime(event.createdAt),
                    ])}
                    emptyTitle="No interview history is stored."
                  />
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <h2 className="po-section-title">Actions</h2>
                <p className="po-secondary mt-2">
                  Cancellation does not revert application status. Completing an interview records attendance
                  without creating an offer.
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {canUpdateInterviewSchedule(interview) ? (
                    <Button variant="secondary" to={employerInterviewEditPath(interview.id)}>
                      Update proposed schedule
                    </Button>
                  ) : null}
                  {canConfirmInterviewReschedule(interview) ? (
                    <Button
                      onClick={() => runAction(
                        () => confirmEmployerInterviewReschedule(interview.id),
                        'Requested time confirmed.',
                      )}
                      disabled={busy}
                    >
                      Confirm requested time
                    </Button>
                  ) : null}
                  {canCompleteInterview(interview) ? (
                    <Button variant="secondary" onClick={() => setCompleteOpen(true)} disabled={busy}>
                      Mark completed
                    </Button>
                  ) : null}
                  {canCancelInterview(interview) ? (
                    <Button variant="danger" onClick={() => setCancelOpen(true)} disabled={busy}>
                      Cancel interview
                    </Button>
                  ) : null}
                  <Button variant="secondary" to={employerApplicantPath(interview.applicationId)}>
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
        open={cancelOpen}
        title="Cancel interview"
        onClose={() => setCancelOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)} disabled={busy}>Close</Button>
            <Button
              variant="danger"
              onClick={() => runAction(() => cancelEmployerInterview(interview.id), 'Interview cancelled.')}
              disabled={busy}
            >
              {busy ? 'Cancelling…' : 'Confirm cancellation'}
            </Button>
          </>
        }
      >
        <p className="po-body">
          Cancel this interview? The application stays in its current status. You can send a new invitation later.
        </p>
      </Modal>

      <Modal
        open={completeOpen}
        title="Complete interview"
        onClose={() => setCompleteOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleteOpen(false)} disabled={busy}>Close</Button>
            <Button
              onClick={() => runAction(
                () => completeEmployerInterview(interview.id, {
                  attendance,
                  outcome: outcome || null,
                  employerNotes: employerNotes.trim() || null,
                }),
                'Interview marked completed.',
              )}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Save completion'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectInput
            id="complete-attendance"
            label="Attendance"
            value={attendance}
            onChange={(event) => setAttendance(event.target.value)}
            options={INTERVIEW_ATTENDANCE_OPTIONS}
          />
          <SelectInput
            id="complete-outcome"
            label="Outcome"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            options={INTERVIEW_OUTCOME_OPTIONS}
          />
          <TextArea
            id="complete-notes"
            label="Internal notes"
            rows={4}
            maxLength={INTERVIEW_NOTES_MAX}
            value={employerNotes}
            onChange={(event) => setEmployerNotes(event.target.value)}
          />
        </div>
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default EmployerInterviewDetails
