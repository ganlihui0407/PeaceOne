import { useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import { careerTargets } from '../../data/careerTargets.js'
import { initialUserSkills } from '../../data/skills.js'
import { defaultSkillGapId, skillGapResults } from '../../data/skillGapData.js'

function gapStatusTone(status) {
  return status.toLowerCase()
}

function SkillGapPage({ basePath }) {
  const [selectedId, setSelectedId] = useState(defaultSkillGapId)
  const [resultId, setResultId] = useState(defaultSkillGapId)
  const [showResult, setShowResult] = useState(true)
  const [toast, setToast] = useState('')
  const result = skillGapResults[resultId] || skillGapResults[defaultSkillGapId]

  function handleRunAnalysis() {
    setResultId(selectedId)
    setShowResult(true)
    setToast('Skill gap analysis updated.')
    window.setTimeout(() => setToast(''), 2500)
  }

  return (
    <PageContent
      title="Skill Gap Analysis"
      description="Compare your current skills with the requirements of your selected career target."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
        <Card>
          <SectionHeader
            title="My Skills"
            className="sm:items-center"
            action={
              <Button size="sm" variant="secondary" to={`${basePath}/skills`}>
                Manage My Skills
              </Button>
            }
          />
          <Table
            minWidthClass="min-w-[640px]"
            headers={['Skill Name', 'Proficiency Level', 'Source Type', 'Verification Status']}
            rows={initialUserSkills.map((skill) => [
              skill.skillName,
              skill.proficiencyLevel,
              skill.sourceType,
              <Badge
                key={`${skill.id}-status`}
                status={skill.verificationStatus.toLowerCase()}
                className="normal-case"
              >
                {skill.verificationStatus}
              </Badge>,
            ])}
          />
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="po-section-title">Career Target</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <SelectInput
                id="skill-gap-career"
                label="Select Career Target"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                options={careerTargets.map((item) => ({ value: item.id, label: item.careerName }))}
              />
              <Button onClick={handleRunAnalysis}>Run Analysis</Button>
            </div>
          </Card>

          {showResult ? (
            <>
              <Card>
                <h2 className="po-section-title">Skill Gap Analysis Result</h2>
                <p className="po-secondary mt-1">Overall Match</p>
                <p className="po-stat-value mt-1">{result.overallMatch}</p>
                <p className="po-secondary mt-2">{result.summary}</p>
                <div className="mt-5">
                  <Table
                    minWidthClass="min-w-[720px]"
                    headers={['Skill', 'Current Level', 'Required Level', 'Gap Level', 'Gap Status']}
                    rows={result.rows.map((row) => [
                      row.skill,
                      row.currentLevel,
                      row.requiredLevel,
                      row.gapLevel,
                      <Badge
                        key={`${row.skill}-gap`}
                        status={gapStatusTone(row.gapStatus)}
                        className="normal-case"
                      >
                        {row.gapStatus}
                      </Badge>,
                    ])}
                  />
                </div>
                <p className="po-secondary mt-5">
                  Review your results and take action to improve the skills that need attention.
                </p>
              </Card>

              <Card>
                <SectionHeader
                  title="Recommended Next Steps"
                  className="sm:items-center"
                  action={
                    <Button size="sm" variant="secondary" to={`${basePath}/learning`}>
                      View Learning Recommendations
                    </Button>
                  }
                />
                <div className="grid gap-3 md:grid-cols-3">
                  {result.nextSteps.map((step) => (
                    <div key={step.title} className="rounded-xl border border-line bg-page p-4">
                      <h3 className="po-card-title">{step.title}</h3>
                      <p className="po-secondary mt-1">{step.message}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : null}
        </div>
      </div>

      <Toast message={toast} />
    </PageContent>
  )
}

export default SkillGapPage
