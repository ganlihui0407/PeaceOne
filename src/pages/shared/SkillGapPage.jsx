import { useEffect, useRef, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import {
  CAREER_TARGET_EMPTY,
  careerTargetPath,
  fetchCareerTarget,
  userFacingCareerTargetError,
} from '../../api/careerTarget.js'
import { fetchOccupations, formatSkillType, skillTypeTone } from '../../api/esco.js'
import {
  SKILL_GAP_DISCLAIMER,
  SKILL_GAP_EMPTY_SKILLS,
  fetchSkillGap,
  groupSkillGapItems,
  recordedStatusLabel,
  recordedStatusTone,
  skillGapSkillsPath,
  userFacingSkillGapError,
} from '../../api/skillGap.js'
import { fetchSavedSkills, userFacingSkillError } from '../../api/userSkills.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

function relationRows(items) {
  return items.map((item) => [
    item.skill.preferredLabel,
    <Badge key={`${item.skill.id}-type`} tone={skillTypeTone(item.skill.skillType)} className="normal-case">
      {formatSkillType(item.skill.skillType)}
    </Badge>,
    item.recorded ? item.proficiencyLevel : '—',
    <Badge
      key={`${item.skill.id}-status`}
      tone={recordedStatusTone(item.recorded)}
      className="normal-case"
    >
      {recordedStatusLabel(item.recorded)}
    </Badge>,
  ])
}

function SkillGapPage({ basePath }) {
  const occupations = useEscoPagedSearch(fetchOccupations)
  const [skills, setSkills] = useState([])
  const [skillsLoading, setSkillsLoading] = useState(true)
  const [skillsError, setSkillsError] = useState('')
  const [savedTarget, setSavedTarget] = useState(null)
  const [targetLoading, setTargetLoading] = useState(true)
  const [targetError, setTargetError] = useState('')
  const [selected, setSelected] = useState(null)
  const [result, setResult] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [toast, setToast] = useState('')
  const skillsRequestRef = useRef(0)
  const targetRequestRef = useRef(0)
  const analysisAbortRef = useRef(null)
  const analysisSeqRef = useRef(0)
  const skillsPath = skillGapSkillsPath(basePath)
  const targetPath = careerTargetPath(basePath)

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function loadSavedSkills() {
    const requestId = skillsRequestRef.current + 1
    skillsRequestRef.current = requestId
    setSkillsLoading(true)
    setSkillsError('')
    try {
      const items = await fetchSavedSkills()
      if (requestId !== skillsRequestRef.current) {
        return
      }
      setSkills(items)
    } catch (error) {
      if (requestId !== skillsRequestRef.current) {
        return
      }
      setSkills([])
      setSkillsError(userFacingSkillError(error))
    } finally {
      if (requestId === skillsRequestRef.current) {
        setSkillsLoading(false)
      }
    }
  }

  async function loadSavedTarget() {
    const requestId = targetRequestRef.current + 1
    targetRequestRef.current = requestId
    setTargetLoading(true)
    setTargetError('')
    try {
      const occupation = await fetchCareerTarget()
      if (requestId !== targetRequestRef.current) {
        return
      }
      setSavedTarget(occupation)
      if (occupation) {
        setSelected(occupation)
        setResult(null)
        setAnalysisError('')
      }
    } catch (error) {
      if (requestId !== targetRequestRef.current) {
        return
      }
      setSavedTarget(null)
      setTargetError(userFacingCareerTargetError(error))
    } finally {
      if (requestId === targetRequestRef.current) {
        setTargetLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadSavedSkills()
    void loadSavedTarget()
  }, [])

  function selectOccupation(item) {
    setSelected(item)
    setResult(null)
    setAnalysisError('')
    analysisAbortRef.current?.abort()
  }

  async function runAnalysis() {
    if (!selected || analyzing) {
      return
    }

    analysisAbortRef.current?.abort()
    const controller = new AbortController()
    analysisAbortRef.current = controller
    const requestId = analysisSeqRef.current + 1
    analysisSeqRef.current = requestId
    setAnalyzing(true)
    setAnalysisError('')

    try {
      const comparison = await fetchSkillGap(selected.id, { signal: controller.signal })
      if (requestId !== analysisSeqRef.current) {
        return
      }
      setResult(comparison)
      showToast('Skill gap comparison updated.')
    } catch (error) {
      if (requestId !== analysisSeqRef.current) {
        return
      }
      setResult(null)
      setAnalysisError(userFacingSkillGapError(error))
    } finally {
      if (requestId === analysisSeqRef.current) {
        setAnalyzing(false)
      }
    }
  }

  const grouped = result ? groupSkillGapItems(result.items) : { essential: [], optional: [] }

  return (
    <PageContent
      title="Skill Gap Analysis"
      description="Compare your recorded skills with the ESCO skills linked to a selected occupation."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
        <Card>
          <SectionHeader
            title="My Skills"
            className="sm:items-center"
            action={
              <Button size="sm" variant="secondary" to={skillsPath}>
                Manage My Skills
              </Button>
            }
          />
          <QueryStatus
            loading={skillsLoading}
            error={skillsError}
            empty={skills.length === 0}
            loadingLabel="Loading your recorded skills…"
            emptyTitle={SKILL_GAP_EMPTY_SKILLS.title}
            emptyDescription={SKILL_GAP_EMPTY_SKILLS.description}
            emptyAction={
              <Button variant="secondary" to={skillsPath}>
                Go to Skills
              </Button>
            }
            onRetry={loadSavedSkills}
          >
            <Table
              minWidthClass="min-w-[640px]"
              headers={['Skill Name', 'Skill type', 'Proficiency Level']}
              rows={skills.map((record) => [
                record.skill.preferredLabel,
                <Badge
                  key={`${record.id}-type`}
                  tone={skillTypeTone(record.skill.skillType)}
                  className="normal-case"
                >
                  {formatSkillType(record.skill.skillType)}
                </Badge>,
                record.proficiencyLevel,
              ])}
            />
          </QueryStatus>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="po-section-title">Career Target</h2>
            <QueryStatus
              loading={targetLoading}
              error={targetError}
              empty={!savedTarget}
              loadingLabel="Loading your saved career target…"
              emptyTitle={CAREER_TARGET_EMPTY.title}
              emptyDescription={CAREER_TARGET_EMPTY.description}
              emptyAction={
                <Button variant="secondary" to={targetPath}>
                  Go to Career Target
                </Button>
              }
              onRetry={loadSavedTarget}
            >
              <p className="po-secondary mt-1">
                Saved target: {savedTarget?.preferredLabel}. Selecting another occupation compares temporarily and does
                not change the saved target.
              </p>
              <p className="po-secondary mt-1 break-all">{savedTarget?.sourceUri}</p>
            </QueryStatus>
            <p className="po-secondary mt-4">Search official ESCO occupations and compare against your recorded skills.</p>
            <form className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={occupations.search}>
              <SearchInput
                id="skill-gap-occupation-search"
                label="Search ESCO occupations"
                value={occupations.input}
                onChange={(event) => occupations.setInput(event.target.value)}
                placeholder="chief ICT security officer"
              />
              <div className="flex items-end">
                <Button type="submit" className="w-full md:w-auto" disabled={occupations.loading}>
                  Search
                </Button>
              </div>
            </form>
            <div className="mt-4">
              <QueryStatus
                loading={occupations.loading}
                error={occupations.error}
                empty={occupations.items.length === 0}
                loadingLabel="Loading occupations…"
                emptyTitle="No occupations match this search yet."
                emptyDescription="Try a different ESCO occupation name, or clear the search to browse the ESCO catalogue."
                onRetry={occupations.retry}
              >
                <Table
                  minWidthClass="min-w-[640px]"
                  headers={['Occupation', 'Source', 'Actions']}
                  rows={occupations.items.map((item) => [
                    item.preferredLabel,
                    item.sourceSystem || 'ESCO',
                    <Button
                      key={`${item.id}-select`}
                      size="sm"
                      variant={item.id === selected?.id ? 'primary' : 'secondary'}
                      onClick={() => selectOccupation(item)}
                    >
                      {item.id === selected?.id ? 'Selected' : 'Select'}
                    </Button>,
                  ])}
                />
                <PaginationBar
                  page={occupations.meta.page}
                  totalPages={occupations.meta.totalPages}
                  total={occupations.meta.total}
                  noun="occupations"
                  disabled={occupations.loading}
                  onPrevious={() => occupations.goToPage(occupations.page - 1)}
                  onNext={() => occupations.goToPage(occupations.page + 1)}
                />
              </QueryStatus>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p className="po-helper">
                  {savedTarget && selected?.id === savedTarget.id
                    ? 'Saved career target'
                    : selected
                      ? 'Temporary selection'
                      : 'Selected occupation'}
                </p>
                <p className="text-sm font-medium text-ink">{selected?.preferredLabel || 'None selected'}</p>
                {selected ? (
                  <p className="po-secondary mt-1 break-all">{selected.sourceUri}</p>
                ) : (
                  <p className="po-secondary mt-1">Choose an occupation from the results, then run the comparison.</p>
                )}
              </div>
              <Button onClick={runAnalysis} disabled={!selected || analyzing}>
                {analyzing ? 'Comparing…' : 'Run Analysis'}
              </Button>
            </div>
          </Card>

          <QueryStatus
            loading={analyzing}
            error={analysisError}
            empty={!result}
            loadingLabel="Comparing recorded skills with this occupation…"
            emptyTitle={selected ? 'Run analysis to compare recorded skills.' : 'Select an occupation to compare.'}
            emptyDescription={
              selected
                ? 'The comparison uses this occupation’s ESCO skill relationships and your saved skill list.'
                : 'Search the occupation catalogue and select a role first.'
            }
            onRetry={selected ? runAnalysis : undefined}
          >
            {result ? (
              <>
                <Card>
                  <h2 className="po-section-title">Skill Gap Analysis Result</h2>
                  <p className="po-secondary mt-1">Selected occupation</p>
                  <p className="po-stat-value mt-1 text-2xl">{result.occupation.preferredLabel}</p>
                  <p className="po-helper mt-2">{result.occupation.sourceSystem || 'ESCO'}</p>
                  <p className="po-secondary mt-1 break-all">{result.occupation.sourceUri}</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="po-secondary">Occupation-linked skills</p>
                      <p className="po-stat-value mt-1">{result.totals.relations}</p>
                    </div>
                    <div>
                      <p className="po-secondary">Occupation-linked recorded</p>
                      <p className="po-stat-value mt-1">
                        {result.matchedOccupationSkillCount} of {result.totals.relations}
                      </p>
                    </div>
                    <div>
                      <p className="po-secondary">Essential recorded</p>
                      <p className="po-stat-value mt-1">
                        {result.totals.essential.recorded} of {result.totals.essential.total}
                      </p>
                    </div>
                    <div>
                      <p className="po-secondary">Optional recorded</p>
                      <p className="po-stat-value mt-1">
                        {result.totals.optional.recorded} of {result.totals.optional.total}
                      </p>
                    </div>
                    <div>
                      <p className="po-secondary">Your recorded skills</p>
                      <p className="po-stat-value mt-1">{result.recordedSkillCount}</p>
                    </div>
                  </div>
                  <p className="po-secondary mt-5">{SKILL_GAP_DISCLAIMER}</p>
                  {result.coverageExplanation ? (
                    <p className="po-secondary mt-3">{result.coverageExplanation}</p>
                  ) : null}
                  {result.unmatchedRecordedSkills.length > 0 ? (
                    <div className="mt-5">
                      <h3 className="po-card-title">Recorded skills not linked to this occupation</h3>
                      <p className="po-helper mt-1">
                        These UserSkill rows are valid ESCO records. They are excluded from occupation-linked coverage because they do not share an ESCO skill identifier with this occupation.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {result.unmatchedRecordedSkills.map((item) => (
                          <Badge key={item.skill.id} tone="warning" className="normal-case">
                            {item.skill.preferredLabel} · {item.proficiencyLevel}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-5 space-y-6">
                    <div>
                      <h3 className="po-card-title">Essential skills</h3>
                      {grouped.essential.length === 0 ? (
                        <p className="po-secondary mt-2">No essential ESCO skills are linked to this occupation.</p>
                      ) : (
                        <div className="mt-3">
                          <Table
                            minWidthClass="min-w-[720px]"
                            headers={['Skill', 'Skill type', 'Recorded proficiency', 'Status']}
                            rows={relationRows(grouped.essential)}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="po-card-title">Optional skills</h3>
                      {grouped.optional.length === 0 ? (
                        <p className="po-secondary mt-2">No optional ESCO skills are linked to this occupation.</p>
                      ) : (
                        <div className="mt-3">
                          <Table
                            minWidthClass="min-w-[720px]"
                            headers={['Skill', 'Skill type', 'Recorded proficiency', 'Status']}
                            rows={relationRows(grouped.optional)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
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
                    <div className="rounded-xl border border-line bg-page p-4">
                      <h3 className="po-card-title">Record skills you already have</h3>
                      <p className="po-secondary mt-1">
                        Add official ESCO skills on the Skills page so this comparison can mark them as recorded.
                      </p>
                      <div className="mt-3">
                        <Button size="sm" variant="secondary" to={skillsPath}>
                          Go to Skills
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-line bg-page p-4">
                      <h3 className="po-card-title">Review not-recorded essentials</h3>
                      <p className="po-secondary mt-1">
                        {result.totals.essential.notRecorded} essential occupation skills are not in your saved list.
                        That is not evidence that you lack them.
                      </p>
                    </div>
                    <div className="rounded-xl border border-line bg-page p-4">
                      <h3 className="po-card-title">Browse learning content</h3>
                      <p className="po-secondary mt-1">
                        Use the learning pages to explore available material. This comparison does not invent required
                        proficiency levels.
                      </p>
                    </div>
                  </div>
                </Card>
              </>
            ) : null}
          </QueryStatus>
        </div>
      </div>

      <Toast message={toast} />
    </PageContent>
  )
}

export default SkillGapPage
