import { useEffect, useRef, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import {
  clearCareerTarget,
  fetchCareerTarget,
  saveCareerTarget,
  userFacingCareerTargetError,
} from '../../api/careerTarget.js'
import {
  ESCO_LIST_LIMIT,
  ESCO_UNAVAILABLE,
  fetchOccupation,
  fetchOccupationSkills,
  fetchOccupations,
  formatRelationType,
  formatSkillType,
  isAbortError,
  relationTone,
  skillTypeTone,
  userFacingLoadError,
} from '../../api/esco.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

const relationFilters = [
  { value: '', label: 'All' },
  { value: 'essential', label: 'Essential' },
  { value: 'optional', label: 'Optional' },
]

function CareerTargetPage({ basePath }) {
  const list = useEscoPagedSearch(fetchOccupations)
  const [selectedId, setSelectedId] = useState(null)
  const [savedTarget, setSavedTarget] = useState(null)
  const [targetLoading, setTargetLoading] = useState(true)
  const [targetError, setTargetError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [relationFilter, setRelationFilter] = useState('')
  const [skillsPage, setSkillsPage] = useState(1)
  const [skillItems, setSkillItems] = useState([])
  const [skillsMeta, setSkillsMeta] = useState({ page: 1, limit: ESCO_LIST_LIMIT, total: 0, totalPages: 0 })
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [skillsError, setSkillsError] = useState('')
  const [detailNonce, setDetailNonce] = useState(0)
  const [skillsNonce, setSkillsNonce] = useState(0)
  const [toast, setToast] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState('')
  const targetRequestRef = useRef(0)

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  function applySavedTarget(occupation) {
    setSavedTarget(occupation)
    if (occupation) {
      selectOccupation(occupation.id)
    }
  }

  function selectOccupation(id) {
    setSelectedId(id)
    setRelationFilter('')
    setSkillsPage(1)
    setSaveError('')
    setClearError('')
    setDetail(null)
    setDetailLoading(true)
    setDetailError('')
    setSkillItems([])
    setSkillsLoading(true)
    setSkillsError('')
    setSkillsMeta({ page: 1, limit: ESCO_LIST_LIMIT, total: 0, totalPages: 0 })
  }

  function loadSavedTarget() {
    const requestId = targetRequestRef.current + 1
    targetRequestRef.current = requestId
    setTargetLoading(true)
    setTargetError('')
    fetchCareerTarget()
      .then((occupation) => {
        if (requestId !== targetRequestRef.current) {
          return
        }
        applySavedTarget(occupation)
      })
      .catch((error) => {
        if (requestId !== targetRequestRef.current) {
          return
        }
        setSavedTarget(null)
        setTargetError(userFacingCareerTargetError(error))
      })
      .finally(() => {
        if (requestId === targetRequestRef.current) {
          setTargetLoading(false)
        }
      })
  }

  useEffect(() => {
    const controller = new AbortController()
    const requestId = targetRequestRef.current + 1
    targetRequestRef.current = requestId
    fetchCareerTarget({ signal: controller.signal })
      .then((occupation) => {
        if (requestId !== targetRequestRef.current) {
          return
        }
        applySavedTarget(occupation)
        setTargetError('')
        setTargetLoading(false)
      })
      .catch((error) => {
        if (isAbortError(error) || requestId !== targetRequestRef.current) {
          return
        }
        setSavedTarget(null)
        setTargetError(userFacingCareerTargetError(error))
        setTargetLoading(false)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      return undefined
    }

    const controller = new AbortController()
    fetchOccupation(selectedId, { signal: controller.signal })
      .then((occupation) => {
        setDetail(occupation)
        setDetailError('')
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return
        }
        setDetail(null)
        setDetailError(userFacingLoadError(error, ESCO_UNAVAILABLE.occupation))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDetailLoading(false)
        }
      })

    return () => controller.abort()
  }, [detailNonce, selectedId])

  useEffect(() => {
    if (!selectedId) {
      return undefined
    }

    const controller = new AbortController()
    fetchOccupationSkills(selectedId, {
      page: skillsPage,
      limit: ESCO_LIST_LIMIT,
      relationType: relationFilter || undefined,
      signal: controller.signal,
    })
      .then((result) => {
        setSkillItems(result.items)
        setSkillsMeta({
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        })
        setSkillsError('')
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return
        }
        setSkillItems([])
        setSkillsMeta({ page: skillsPage, limit: ESCO_LIST_LIMIT, total: 0, totalPages: 0 })
        setSkillsError(userFacingLoadError(error, ESCO_UNAVAILABLE.occupationSkills))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSkillsLoading(false)
        }
      })

    return () => controller.abort()
  }, [relationFilter, selectedId, skillsNonce, skillsPage])

  async function handleSaveTarget() {
    if (!selectedId || saving) {
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const occupation = await saveCareerTarget(selectedId)
      setSavedTarget(occupation)
      showToast('Career target saved.')
    } catch (error) {
      setSaveError(userFacingCareerTargetError(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleClearTarget() {
    if (clearing) {
      return
    }
    setClearing(true)
    setClearError('')
    try {
      await clearCareerTarget()
      setSavedTarget(null)
      setConfirmClear(false)
      showToast('Career target cleared.')
    } catch (error) {
      setClearError(userFacingCareerTargetError(error))
    } finally {
      setClearing(false)
    }
  }

  function retryDetails() {
    setDetailLoading(true)
    setDetailError('')
    setDetailNonce((current) => current + 1)
  }

  function retrySkills() {
    setSkillsLoading(true)
    setSkillsError('')
    setSkillsNonce((current) => current + 1)
  }

  const alreadySaved = Boolean(savedTarget && selectedId === savedTarget.id)

  return (
    <PageContent
      title="Career Target"
      description="Choose the career role you want to prepare for."
    >
      <Card>
        <form
          className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={list.search}
        >
          <SearchInput
            id="occupation-search"
            label="Search occupations"
            value={list.input}
            onChange={(event) => list.setInput(event.target.value)}
            placeholder="food service worker"
          />
          <div className="flex items-end">
            <Button type="submit" className="w-full md:w-auto" disabled={list.loading}>
              Search
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <QueryStatus
          loading={targetLoading}
          error={targetError}
          empty={!savedTarget}
          loadingLabel="Loading your saved career target…"
          emptyTitle="No career target saved yet."
          emptyDescription="Search official ESCO occupations, open a role, then click Set as Career Target. Browsing results does not save a target."
          onRetry={loadSavedTarget}
        >
          <p className="po-helper">Saved career target</p>
          <p className="po-section-title mt-1">{savedTarget?.preferredLabel}</p>
          <p className="po-secondary mt-1 break-all">{savedTarget?.sourceUri}</p>
          {clearError ? <p className="po-secondary mt-4 text-danger">{clearError}</p> : null}
          <div className="mt-5">
            <Button variant="danger" onClick={() => setConfirmClear(true)} disabled={clearing}>
              Clear Career Target
            </Button>
          </div>
        </QueryStatus>
      </Card>

      <section className="mt-6">
        <SectionHeader title="Occupation results" />
        <QueryStatus
          loading={list.loading}
          error={list.error}
          empty={list.items.length === 0}
          loadingLabel="Loading occupations…"
          emptyTitle="No occupations match this search yet."
          emptyDescription="Try a different occupation name, or clear the search to browse the catalogue."
          onRetry={list.retry}
        >
          <Table
            minWidthClass="min-w-[640px]"
            headers={['Occupation', 'ISCO group', 'Source', 'Actions']}
            rows={list.items.map((item) => [
              item.preferredLabel,
              item.iscoGroup || 'Not specified',
              item.sourceSystem || 'ESCO',
              <Button
                key={`${item.id}-view`}
                size="sm"
                variant={item.id === selectedId ? 'primary' : 'secondary'}
                onClick={() => selectOccupation(item.id)}
              >
                {item.id === savedTarget?.id ? 'Saved' : item.id === selectedId ? 'Selected' : 'View'}
              </Button>,
            ])}
          />
          <PaginationBar
            page={list.meta.page}
            totalPages={list.meta.totalPages}
            total={list.meta.total}
            noun="occupations"
            disabled={list.loading}
            onPrevious={() => list.goToPage(list.page - 1)}
            onNext={() => list.goToPage(list.page + 1)}
          />
        </QueryStatus>
      </section>

      <Card className="mt-6">
        <QueryStatus
          loading={detailLoading}
          error={detailError}
          empty={!detail}
          loadingLabel="Loading occupation details…"
          emptyTitle="Select an occupation to see details."
          emptyDescription="Choose a role from the occupation results to review its description and skills."
          onRetry={retryDetails}
        >
          {detail ? (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="po-secondary">Career Name</p>
                  <h2 className="po-section-title mt-1">{detail.preferredLabel}</h2>
                  <p className="po-helper mt-2">Industry</p>
                  <p className="text-sm font-medium text-ink">{detail.iscoGroup || 'Not specified'}</p>
                  <p className="po-helper mt-4">Career Description</p>
                  <p className="po-secondary mt-1 max-w-2xl">
                    {detail.description || detail.definition || 'No description is available for this occupation.'}
                  </p>
                  {detail.altLabels ? (
                    <>
                      <p className="po-helper mt-4">Also known as</p>
                      <p className="po-secondary mt-1 max-w-2xl">{detail.altLabels}</p>
                    </>
                  ) : null}
                </div>
                <div>
                  <p className="po-helper">Status</p>
                  <Badge status="active" className="mt-1 normal-case">
                    {alreadySaved ? 'Saved target' : detail.status || detail.sourceSystem || 'ESCO'}
                  </Badge>
                </div>
              </div>
              {saveError ? <p className="po-secondary mt-4 text-danger">{saveError}</p> : null}
              <div className="mt-6 flex flex-wrap gap-2">
                <Button onClick={handleSaveTarget} disabled={saving || alreadySaved || clearing}>
                  {saving ? 'Saving…' : alreadySaved ? 'Career Target Saved' : 'Set as Career Target'}
                </Button>
                {alreadySaved ? (
                  <Button variant="danger" onClick={() => setConfirmClear(true)} disabled={clearing}>
                    Clear Career Target
                  </Button>
                ) : null}
                <Button variant="secondary" to={`${basePath}/skill-gap`}>
                  Run Skill Gap Analysis
                </Button>
              </div>
            </>
          ) : null}
        </QueryStatus>
      </Card>

      <section className="mt-8">
        <SectionHeader
          title="Required skills preview"
          description="Essential and optional skills linked to the selected occupation."
          action={
            <div className="flex flex-wrap gap-2">
              {relationFilters.map((filter) => (
                <Button
                  key={filter.value || 'all'}
                  size="sm"
                  variant={relationFilter === filter.value ? 'primary' : 'secondary'}
                  onClick={() => {
                    setRelationFilter(filter.value)
                    setSkillsPage(1)
                    setSkillsLoading(true)
                  }}
                  disabled={!selectedId}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          }
        />
        <QueryStatus
          loading={skillsLoading}
          error={skillsError}
          empty={skillItems.length === 0}
          loadingLabel="Loading occupation skills…"
          emptyTitle="No skills are linked for this filter."
          emptyDescription="Try another relation filter, or choose a different occupation."
          onRetry={retrySkills}
        >
          <Table
            minWidthClass="min-w-[640px]"
            headers={['Skill', 'Skill type', 'Relation']}
            rows={skillItems.map((item) => [
              item.skill.preferredLabel,
              <Badge
                key={`${item.skill.id}-type`}
                tone={skillTypeTone(item.skill.skillType)}
                className="normal-case"
              >
                {formatSkillType(item.skill.skillType)}
              </Badge>,
              <Badge
                key={`${item.skill.id}-relation`}
                tone={relationTone(item.relationType)}
                className="normal-case"
              >
                {formatRelationType(item.relationType)}
              </Badge>,
            ])}
          />
          <PaginationBar
            page={skillsMeta.page}
            totalPages={skillsMeta.totalPages}
            total={skillsMeta.total}
            noun="skills"
            disabled={skillsLoading}
            onPrevious={() => {
              setSkillsLoading(true)
              setSkillsPage((current) => Math.max(1, current - 1))
            }}
            onNext={() => {
              setSkillsLoading(true)
              setSkillsPage((current) => current + 1)
            }}
          />
        </QueryStatus>
      </section>

      <Modal
        open={confirmClear}
        title="Clear career target"
        onClose={() => {
          if (!clearing) {
            setConfirmClear(false)
          }
        }}
        footer={
          <>
            <Button variant="secondary" disabled={clearing} onClick={() => setConfirmClear(false)}>
              Keep target
            </Button>
            <Button variant="danger" disabled={clearing} onClick={() => void handleClearTarget()}>
              {clearing ? 'Clearing…' : 'Confirm clear'}
            </Button>
          </>
        }
      >
        <p className="po-body">
          Clear the saved career target? Skill Gap and Learning Recommendations will show no saved target until you
          choose another occupation. Recorded skills are not removed.
        </p>
        {clearError ? (
          <p className="po-helper po-helper-error mt-4" role="alert">
            {clearError}
          </p>
        ) : null}
      </Modal>

      <Toast message={toast} />
    </PageContent>
  )
}

export default CareerTargetPage
