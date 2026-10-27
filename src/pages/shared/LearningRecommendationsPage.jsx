import { useEffect, useMemo, useRef, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import { formatRelationType, formatSkillType, isAbortError, relationTone, skillTypeTone } from '../../api/esco.js'
import {
  LEARNING_ALL_RECORDED,
  LEARNING_DISCLAIMER,
  LEARNING_NO_LINKED_SKILLS,
  LEARNING_NO_RECORDED,
  LEARNING_NO_TARGET,
  SKILL_GAP_DISCLAIMER,
  fetchLearningRecommendations,
  learningCareerTargetPath,
  learningSkillGapPath,
  learningSkillsPath,
  userFacingLearningError,
} from '../../api/learningRecommendations.js'
import { recordedStatusLabel, recordedStatusTone } from '../../api/skillGap.js'

function matchesQuery(topic, query) {
  if (!query) {
    return true
  }
  const haystack = `${topic.skill.preferredLabel} ${topic.skill.sourceUri} ${topic.relationType}`.toLowerCase()
  return haystack.includes(query)
}

function LearningRecommendationsPage({ basePath }) {
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestRef = useRef(0)
  const skillsPath = learningSkillsPath(basePath)
  const targetPath = learningCareerTargetPath(basePath)
  const gapPath = learningSkillGapPath(basePath)

  function loadRecommendations() {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setError('')
    fetchLearningRecommendations()
      .then((next) => {
        if (requestId !== requestRef.current) {
          return
        }
        setResult(next)
      })
      .catch((loadError) => {
        if (requestId !== requestRef.current) {
          return
        }
        setResult(null)
        setError(userFacingLearningError(loadError))
      })
      .finally(() => {
        if (requestId === requestRef.current) {
          setLoading(false)
        }
      })
  }

  useEffect(() => {
    const controller = new AbortController()
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    fetchLearningRecommendations({ signal: controller.signal })
      .then((next) => {
        if (requestId !== requestRef.current) {
          return
        }
        setResult(next)
        setError('')
        setLoading(false)
      })
      .catch((loadError) => {
        if (isAbortError(loadError) || requestId !== requestRef.current) {
          return
        }
        setResult(null)
        setError(userFacingLearningError(loadError))
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  function handleSearch(event) {
    event.preventDefault()
    setAppliedQuery(query.trim().toLowerCase())
  }

  const filteredTopics = useMemo(() => {
    const topics = result?.topics ?? []
    return topics.filter((topic) => matchesQuery(topic, appliedQuery))
  }, [appliedQuery, result])
  const filteredRecorded = useMemo(() => {
    const topics = result?.recordedTopics ?? []
    return topics.filter((topic) => matchesQuery(topic, appliedQuery))
  }, [appliedQuery, result])

  const emptyTarget = !loading && !error && result?.status === 'empty-target'

  return (
    <PageContent
      title="Learning Recommendations"
      description="Build the skills linked to your saved career target using official ESCO relationships."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" to={`${basePath}/learning/progress`}>
            Learning Progress
          </Button>
          <Button variant="secondary" to={gapPath}>
            Review Skill Gap
          </Button>
        </div>
      }
    >
      <QueryStatus
        loading={loading}
        error={error}
        empty={emptyTarget}
        loadingLabel="Loading skill-development topics…"
        emptyTitle={LEARNING_NO_TARGET.title}
        emptyDescription={LEARNING_NO_TARGET.description}
        emptyAction={
          <Button variant="secondary" to={targetPath}>
            Go to Career Target
          </Button>
        }
        onRetry={loadRecommendations}
      >
        {result?.occupation ? (
          <div className="space-y-8">
            <Card>
              <h2 className="po-section-title">Saved career target</h2>
              <p className="po-card-title mt-3">{result.occupation.preferredLabel}</p>
              <p className="po-secondary mt-1 break-all">{result.occupation.sourceUri}</p>
              <p className="po-secondary mt-4">{LEARNING_DISCLAIMER}</p>
              <p className="po-secondary mt-2">{SKILL_GAP_DISCLAIMER}</p>
              <p className="po-helper mt-4">
                {`${result.recordedSkillCount} recorded skill${result.recordedSkillCount === 1 ? '' : 's'} in your PeaceOne list. ${result.totals.relations} ESCO skill${result.totals.relations === 1 ? '' : 's'} are linked to this occupation.`}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="secondary" to={targetPath}>
                  Change Career Target
                </Button>
                <Button variant="secondary" to={skillsPath}>
                  Manage My Skills
                </Button>
              </div>
            </Card>

            {result.status === 'no-recorded-skills' ? (
              <Card>
                <QueryStatus
                  empty
                  emptyTitle={LEARNING_NO_RECORDED.title}
                  emptyDescription={LEARNING_NO_RECORDED.description}
                  emptyAction={
                    <Button variant="secondary" to={skillsPath}>
                      Go to Skills
                    </Button>
                  }
                />
              </Card>
            ) : null}

            {result.status === 'all-recorded' ? (
              <Card>
                <QueryStatus empty emptyTitle={LEARNING_ALL_RECORDED.title} emptyDescription={LEARNING_ALL_RECORDED.description} />
              </Card>
            ) : null}

            {result.status === 'no-linked-skills' ? (
              <Card>
                <QueryStatus
                  empty
                  emptyTitle={LEARNING_NO_LINKED_SKILLS.title}
                  emptyDescription={LEARNING_NO_LINKED_SKILLS.description}
                />
              </Card>
            ) : null}

            <form className="grid gap-4 rounded-xl border border-line bg-surface p-5 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleSearch}>
              <SearchInput
                id="search-learning-topics"
                label="Search skill-development topics"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Skill name or ESCO URI"
              />
              <div className="flex items-end">
                <Button type="submit">Search</Button>
              </div>
            </form>

            <section>
              <SectionHeader
                title="Skill-development topics"
                description="Unrecorded essential skills are listed first, then unrecorded optional skills. These are learning goals, not courses."
              />
              {filteredTopics.length === 0 ? (
                <p className="po-secondary">
                  {result.topics.length === 0
                    ? 'There are no unrecorded occupation skills to recommend right now.'
                    : 'No skill-development topics match this search yet.'}
                </p>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {filteredTopics.map((topic) => (
                    <Card key={topic.id}>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={relationTone(topic.relationType)} className="normal-case">
                          {formatRelationType(topic.relationType)}
                        </Badge>
                        <Badge tone={recordedStatusTone(topic.recorded)} className="normal-case">
                          {recordedStatusLabel(topic.recorded)}
                        </Badge>
                        <Badge tone={skillTypeTone(topic.skill.skillType)} className="normal-case">
                          {formatSkillType(topic.skill.skillType)}
                        </Badge>
                      </div>
                      <h3 className="po-card-title mt-3">{topic.skill.preferredLabel}</h3>
                      <p className="po-helper mt-1">Target occupation: {topic.occupation.preferredLabel}</p>
                      <p className="po-secondary mt-1 break-all">{topic.skill.sourceUri}</p>
                      <p className="po-secondary mt-3">{topic.rationale}</p>
                      <p className="po-helper mt-4">Practical learning goals</p>
                      <ul className="po-secondary mt-2 list-disc space-y-1 pl-5">
                        {topic.learningGoals.map((goal) => (
                          <li key={goal}>{goal}</li>
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionHeader
                title="Already recorded for this occupation"
                description="Recorded proficiency is the level you saved. It is not a PeaceOne score."
              />
              {filteredRecorded.length === 0 ? (
                <p className="po-secondary">
                  {result.recordedTopics.length === 0
                    ? 'None of the linked occupation skills are in your recorded list yet.'
                    : 'No recorded occupation skills match this search yet.'}
                </p>
              ) : (
                <Table
                  minWidthClass="min-w-[720px]"
                  headers={['Skill', 'Type', 'Proficiency', 'URI']}
                  rows={filteredRecorded.map((topic) => [
                    topic.skill.preferredLabel,
                    <Badge
                      key={`${topic.id}-type`}
                      tone={relationTone(topic.relationType)}
                      className="normal-case"
                    >
                      {formatRelationType(topic.relationType)}
                    </Badge>,
                    topic.proficiencyLevel,
                    topic.skill.sourceUri,
                  ])}
                />
              )}
            </section>
          </div>
        ) : null}
      </QueryStatus>
    </PageContent>
  )
}

export default LearningRecommendationsPage
