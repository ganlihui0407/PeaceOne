import Badge from '../common/Badge.jsx'
import Button from '../common/Button.jsx'
import QueryStatus from '../common/QueryStatus.jsx'
import Table from '../common/Table.jsx'
import Card from '../cards/Card.jsx'
import DetailItem from '../ui/DetailItem.jsx'
import {
  JOB_SKILL_MATCH_DISCLAIMER,
  JOB_SKILL_MATCH_EMPTY_CANDIDATE,
  JOB_SKILL_MATCH_EMPTY_EMPLOYER,
  JOB_SKILL_MATCH_EMPLOYER_INTRO,
  JOB_SKILL_MATCH_UNAVAILABLE,
  canComputeJobSkillOverlap,
  candidateSkillGapPath,
  candidateSkillsPath,
  compareJobSkillOverlap,
  formatRecordedSkillOverlap,
  matchStatusLabel,
  matchStatusTone,
  missingSkillExplanation,
  proficiencyGapExplanation,
} from '../../api/jobSkillMatch.js'

function StatusBadge({ status }) {
  return (
    <Badge tone={matchStatusTone(status)} className="normal-case">
      {matchStatusLabel(status)}
    </Badge>
  )
}

function SkillTable({ headers, rows, emptyTitle }) {
  return (
    <Table
      minWidthClass="min-w-[560px]"
      headers={headers}
      rows={rows}
      emptyTitle={emptyTitle}
    />
  )
}

function JobSkillMatchPanel({
  job,
  skills,
  skillsLoading = false,
  skillsError = '',
  onRetrySkills,
  basePath,
  audience = 'candidate',
}) {
  const isEmployer = audience === 'employer'
  const skillsPath = candidateSkillsPath(basePath)
  const skillGapPath = candidateSkillGapPath(basePath)
  const requiredSkills = job?.requiredSkills || []
  const canCompute = canComputeJobSkillOverlap(skills)
  const comparison = requiredSkills.length === 0
    ? compareJobSkillOverlap([], skills || [])
    : canCompute
      ? compareJobSkillOverlap(requiredSkills, skills)
      : null
  const proficiencyHeader = isEmployer ? 'Candidate proficiency' : 'Your proficiency'
  const emptyCandidateCopy = isEmployer ? JOB_SKILL_MATCH_EMPTY_EMPLOYER : JOB_SKILL_MATCH_EMPTY_CANDIDATE

  return (
    <Card>
      <h2 className="po-section-title">
        {isEmployer ? 'Recorded skills vs job requirements' : 'Your Skills vs Job Requirements'}
      </h2>
      <p className="po-secondary mt-2">
        {isEmployer
          ? JOB_SKILL_MATCH_EMPLOYER_INTRO
          : 'PeaceOne compares your recorded My Skills list with this vacancy\'s required ESCO skill IDs.'}
      </p>

      {requiredSkills.length === 0 ? (
        <p className="po-body mt-4">{JOB_SKILL_MATCH_UNAVAILABLE}</p>
      ) : (
        <QueryStatus
          loading={skillsLoading}
          error={skillsError}
          loadingLabel="Loading your recorded skills…"
          onRetry={onRetrySkills}
        >
          {comparison ? (
            <div className="mt-5 space-y-6">
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailItem label="Required skills" value={String(comparison.totalRequired)} />
                <DetailItem label="Matched" value={String(comparison.matchedCount)} />
                <DetailItem label="Proficiency gaps" value={String(comparison.proficiencyGapCount)} />
                <DetailItem label="Missing" value={String(comparison.missingCount)} />
                <DetailItem
                  label="Recorded-skill overlap"
                  value={`${comparison.overlapPercent}%`}
                />
              </dl>
              <p className="po-helper mt-0">{formatRecordedSkillOverlap(comparison.overlapPercent)}</p>
              <p className="po-helper mt-2">{JOB_SKILL_MATCH_DISCLAIMER}</p>

              {skills.length === 0 ? (
                <p className="po-body">{emptyCandidateCopy}</p>
              ) : null}

              <div>
                <h3 className="po-card-title">Matched skills</h3>
                <div className="mt-3">
                  <SkillTable
                    headers={['Skill', proficiencyHeader, 'Required proficiency', 'Status']}
                    emptyTitle="No matched skills yet."
                    rows={comparison.matched.map((row) => [
                      row.preferredLabel,
                      row.candidateLevel,
                      row.requiredLevel,
                      <StatusBadge key={`${row.skillId}-matched`} status={row.status} />,
                    ])}
                  />
                </div>
              </div>

              <div>
                <h3 className="po-card-title">Proficiency gaps</h3>
                <p className="po-helper mt-2">
                  These ESCO skills are recorded, but the saved proficiency is below the vacancy requirement.
                </p>
                <div className="mt-3">
                  <SkillTable
                    headers={['Skill', proficiencyHeader, 'Required proficiency', 'Difference']}
                    emptyTitle="No proficiency gaps for this vacancy."
                    rows={comparison.proficiencyGaps.map((row) => [
                      row.preferredLabel,
                      row.candidateLevel,
                      row.requiredLevel,
                      proficiencyGapExplanation(row.candidateLevel, row.requiredLevel, audience),
                    ])}
                  />
                </div>
              </div>

              <div>
                <h3 className="po-card-title">Missing skills</h3>
                <p className="po-helper mt-2">{missingSkillExplanation(audience)}</p>
                <div className="mt-3">
                  <SkillTable
                    headers={['Skill', 'Required proficiency', 'Status']}
                    emptyTitle="No missing required skills."
                    rows={comparison.missing.map((row) => [
                      row.preferredLabel,
                      row.requiredLevel,
                      <StatusBadge key={`${row.skillId}-missing`} status={row.status} />,
                    ])}
                  />
                </div>
              </div>

              {isEmployer ? null : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button to={skillsPath} variant="secondary">
                    My Skills
                  </Button>
                  <Button to={skillGapPath} variant="secondary">
                    Skill Gap
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </QueryStatus>
      )}
    </Card>
  )
}

export default JobSkillMatchPanel
