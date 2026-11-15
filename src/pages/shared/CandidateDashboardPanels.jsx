import { useEffect, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import { formatRelationType, relationTone } from '../../api/esco.js'
import {
  CAREER_TARGET_EMPTY,
  DASHBOARD_APPLICATIONS_UNAVAILABLE,
  DASHBOARD_INTERVIEWS_EMPTY,
  DASHBOARD_JOBS_UNAVAILABLE,
  DASHBOARD_LEARNING_PROGRESS,
  DASHBOARD_PROFILE_INCOMPLETE,
  DASHBOARD_SKILL_PREVIEW,
  LEARNING_ALL_RECORDED,
  LEARNING_NO_LINKED_SKILLS,
  LEARNING_NO_RECORDED,
  LEARNING_NO_TARGET,
} from '../../api/candidateDashboard.js'
import {
  candidateInterviewPath,
  fetchMyInterviews,
  formatInterviewStatus,
  formatInterviewWhen,
  interviewStatusTone,
  isAbortError,
} from '../../api/interviews.js'
import { SKILL_GAP_DISCLAIMER, recordedStatusLabel, recordedStatusTone } from '../../api/skillGap.js'

function SkillLabelList({ labels, status }) {
  const preview = labels.slice(0, DASHBOARD_SKILL_PREVIEW)
  const remaining = labels.length - preview.length
  if (preview.length === 0) {
    return <p className="po-secondary">None yet.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {preview.map((label) => (
        <Badge key={`${status}-${label}`} tone={recordedStatusTone(status === 'recorded')} className="normal-case">
          {label}
        </Badge>
      ))}
      {remaining > 0 ? <p className="po-helper mt-0">+{remaining} more</p> : null}
    </div>
  )
}

export function DashboardStats({ stats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((item) => (
        <StatCard key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  )
}

export function ProfileHighlights({ highlights, profileTo }) {
  if (highlights.length === 0) {
    return (
      <p className="po-secondary mt-2">
        {DASHBOARD_PROFILE_INCOMPLETE.description}{' '}
        <Button to={profileTo} variant="ghost" size="sm" className="align-baseline px-0">
          Open My Profile
        </Button>
      </p>
    )
  }
  return <p className="po-secondary mt-2">{highlights.join(' · ')}</p>
}

export function CareerTargetCard({ occupation, basePath }) {
  if (!occupation) {
    return (
      <Card>
        <EmptyState
          title={CAREER_TARGET_EMPTY.title}
          description={CAREER_TARGET_EMPTY.description}
          action={
            <Button to={`${basePath}/career-target`} variant="secondary">
              Go to Career Target
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <Card>
      <p className="po-secondary">Career target</p>
      <h2 className="po-section-title mt-1">{occupation.preferredLabel}</h2>
      <p className="po-helper mt-1">{occupation.sourceSystem}</p>
      <p className="po-secondary mt-3 break-all">{occupation.sourceUri}</p>
      <p className="po-helper mt-4">
        This is the occupation saved on your account. PeaceOne does not calculate a readiness score.
      </p>
      <div className="mt-5">
        <Button to={`${basePath}/career-target`} variant="secondary">
          View Career Target
        </Button>
      </div>
    </Card>
  )
}

export function SkillGapOverviewCard({ data, basePath }) {
  if (!data.occupation) {
    return (
      <Card>
        <h2 className="po-section-title">Skill Gap Overview</h2>
        <EmptyState
          title={LEARNING_NO_TARGET.title}
          description="Save a career target to compare recorded ESCO skills with that occupation. Not recorded does not mean you lack a skill."
          action={
            <Button to={`${basePath}/career-target`} size="sm" variant="secondary">
              Go to Career Target
            </Button>
          }
        />
      </Card>
    )
  }

  if (data.learningStatus === 'no-linked-skills') {
    return (
      <Card>
        <h2 className="po-section-title">Skill Gap Overview</h2>
        <EmptyState title={LEARNING_NO_LINKED_SKILLS.title} description={LEARNING_NO_LINKED_SKILLS.description} />
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="po-section-title">Skill Gap Overview</h2>
          <p className="po-secondary mt-1">
            Recorded versus not recorded skills for {data.occupation.preferredLabel}.
          </p>
        </div>
        <Button to={`${basePath}/skill-gap`} size="sm" variant="secondary">
          View Full Analysis
        </Button>
      </div>
      <p className="po-helper mt-4">{SKILL_GAP_DISCLAIMER}</p>
      {data.recordedSkillCount === 0 ? (
        <p className="po-secondary mt-3">{LEARNING_NO_RECORDED.description}</p>
      ) : null}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <p className="text-2xl font-semibold text-ink">{data.recordedForTarget}</p>
          <p className="po-helper">Recorded</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-ink">{data.notRecordedForTarget}</p>
          <p className="po-helper">Not recorded</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <div>
          <p className="po-helper mb-2">{recordedStatusLabel(true)}</p>
          <SkillLabelList labels={data.recordedLabels} status="recorded" />
        </div>
        <div>
          <p className="po-helper mb-2">{recordedStatusLabel(false)}</p>
          <SkillLabelList labels={data.notRecordedLabels} status="not-recorded" />
        </div>
      </div>
    </Card>
  )
}

export function LearningTopicsSection({ data, basePath }) {
  let empty = null
  if (!data.occupation) {
    empty = LEARNING_NO_TARGET
  } else if (data.learningStatus === 'no-linked-skills') {
    empty = LEARNING_NO_LINKED_SKILLS
  } else if (data.learningStatus === 'all-recorded') {
    empty = LEARNING_ALL_RECORDED
  }

  return (
    <section className="po-section-block">
      <SectionHeader
        title="Skill-development topics"
        action={
          <Button to={`${basePath}/learning`} variant="ghost" size="sm">
            View Learning
          </Button>
        }
      />
      <p className="po-secondary mb-4">{DASHBOARD_LEARNING_PROGRESS.description}</p>
      {empty ? (
        <Card>
          <EmptyState
            title={empty.title}
            description={empty.description}
            action={
              data.occupation ? null : (
                <Button to={`${basePath}/career-target`} variant="secondary">
                  Go to Career Target
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {data.topics.map((topic) => (
            <Card key={topic.id}>
              <div className="flex flex-wrap gap-2">
                <Badge tone={relationTone(topic.relationType)} className="normal-case">
                  {formatRelationType(topic.relationType)}
                </Badge>
                <Badge tone={recordedStatusTone(false)} className="normal-case">
                  {recordedStatusLabel(false)}
                </Badge>
              </div>
              <h3 className="po-card-title mt-3">{topic.skill.preferredLabel}</h3>
              <p className="po-helper mt-1">Target occupation: {topic.occupation.preferredLabel}</p>
              <p className="po-secondary mt-3">{topic.rationale}</p>
            </Card>
          ))}
        </div>
      )}
      {data.occupation && data.topicTotal > data.topics.length ? (
        <p className="po-helper mt-4">
          Showing {data.topics.length} of {data.topicTotal} unrecorded topics.
        </p>
      ) : null}
    </section>
  )
}

export function JobsUnavailableSection({ jobsTo }) {
  return (
    <section className="po-section-block">
      <SectionHeader
        title="Published jobs"
        action={
          <Button to={jobsTo} variant="ghost" size="sm">
            Open job search
          </Button>
        }
      />
      <Card>
        <EmptyState title={DASHBOARD_JOBS_UNAVAILABLE.title} description={DASHBOARD_JOBS_UNAVAILABLE.description} />
      </Card>
    </section>
  )
}

export function ApplicationsUnavailableSection() {
  return (
    <section className="po-section-block">
      <SectionHeader title="Recent applications" />
      <Card>
        <EmptyState
          title={DASHBOARD_APPLICATIONS_UNAVAILABLE.title}
          description={DASHBOARD_APPLICATIONS_UNAVAILABLE.description}
        />
      </Card>
    </section>
  )
}

export function CandidateUpcomingInterviewCard({ interviewsTo, basePath }) {
  const [interview, setInterview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetchMyInterviews({ page: 1, limit: 10, signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) {
          return
        }
        const next = page.items.find((item) => (
          item.status === 'PROPOSED' || item.status === 'CONFIRMED' || item.status === 'RESCHEDULE_REQUESTED'
        ))
        setInterview(next || null)
      })
      .catch((error) => {
        if (isAbortError(error) || controller.signal.aborted) {
          return
        }
        setInterview(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [])

  return (
    <Card>
      <p className="po-secondary">Upcoming interview</p>
      {loading ? (
        <p className="po-body mt-4">Loading stored interviews…</p>
      ) : interview ? (
        <>
          <h3 className="po-section-title mt-1">{interview.title}</h3>
          <p className="po-secondary mt-2">{interview.job?.company?.companyName || '—'}</p>
          <p className="po-body mt-2">{formatInterviewWhen(interview)}</p>
          <div className="mt-3">
            <Badge tone={interviewStatusTone(interview.status)} className="normal-case">
              {formatInterviewStatus(interview.status)}
            </Badge>
          </div>
          <div className="mt-5">
            <Button to={candidateInterviewPath(basePath, interview.id)} variant="secondary">
              View Interview Details
            </Button>
          </div>
        </>
      ) : (
        <EmptyState
          title={DASHBOARD_INTERVIEWS_EMPTY.title}
          description={DASHBOARD_INTERVIEWS_EMPTY.description}
          action={
            <Button to={interviewsTo} variant="secondary">
              View Interview Details
            </Button>
          }
        />
      )}
    </Card>
  )
}

export function ApplicationsAndInterviewsUnavailable({ applicationsTo, interviewsTo, basePath }) {
  return (
    <div className="po-section-block grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="po-section-title">Application tracking</h2>
          <Button to={applicationsTo} size="sm" variant="ghost">
            View All Applications
          </Button>
        </div>
        <EmptyState
          title={DASHBOARD_APPLICATIONS_UNAVAILABLE.title}
          description={DASHBOARD_APPLICATIONS_UNAVAILABLE.description}
        />
      </Card>
      <CandidateUpcomingInterviewCard interviewsTo={interviewsTo} basePath={basePath} />
    </div>
  )
}
