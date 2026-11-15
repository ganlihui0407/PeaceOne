import { useEffect, useRef, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import Field from '../../components/forms/Field.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import {
  ESCO_SEARCH_DEBOUNCE_MS,
  ESCO_SEARCH_MIN_CHARS,
  ESCO_UNAVAILABLE,
  fetchSkills,
  formatSkillType,
  isAbortError,
  skillTypeTone,
  userFacingLoadError,
} from '../../api/esco.js'
import {
  PROFICIENCY_LEVELS,
  createSavedSkill,
  deleteSavedSkill,
  fetchSavedSkills,
  updateSavedSkill,
  userFacingSkillError,
} from '../../api/userSkills.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

const emptyForm = {
  skillId: '',
  skillName: '',
  proficiencyLevel: 'Beginner',
}

function countByProficiency(skills, level) {
  return skills.filter((item) => item.proficiencyLevel === level).length
}

function EscoSkillNameField({ form, onChange, idPrefix, disabled = false }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    const query = form.skillName.trim()
    if (disabled || query.length < ESCO_SEARCH_MIN_CHARS) {
      setSuggestions([])
      setError('')
      setLoading(false)
      return undefined
    }

    setLoading(true)
    setError('')
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const result = await fetchSkills({
          q: query,
          page: 1,
          limit: 8,
          signal: controller.signal,
        })
        if (!controller.signal.aborted) {
          setSuggestions(result.items)
        }
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted) {
          return
        }
        setSuggestions([])
        setError(userFacingLoadError(err, ESCO_UNAVAILABLE.skills))
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, ESCO_SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [disabled, form.skillName, retryToken])

  return (
    <Field id={`${idPrefix}-name`} label="Skill Name">
      {(describedBy) => (
        <div>
          <input
            id={`${idPrefix}-name`}
            aria-describedby={describedBy}
            className="po-field"
            value={form.skillName}
            disabled={disabled}
            onChange={(event) => {
              const skillName = event.target.value
              const selected = suggestions.find((item) => item.preferredLabel === skillName)
              onChange({
                ...form,
                skillName,
                skillId: selected?.id || '',
              })
            }}
            placeholder="Python"
            autoComplete="off"
          />
          {disabled ? (
            <p className="po-helper mt-2">Recorded ESCO skills cannot be renamed. Change the proficiency level instead.</p>
          ) : form.skillName.trim().length >= ESCO_SEARCH_MIN_CHARS ? (
            <div className="mt-2 rounded-xl border border-line bg-page px-3 py-2">
              {loading ? (
                <p className="po-secondary" role="status">
                  Searching catalogue…
                </p>
              ) : null}
              {error ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="po-helper po-helper-error mt-0" role="alert">
                    {error}
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => setRetryToken((current) => current + 1)}>
                    Retry
                  </Button>
                </div>
              ) : null}
              {!loading && !error && suggestions.length === 0 ? (
                <p className="po-secondary">No matching ESCO skills.</p>
              ) : null}
              {!loading && !error && suggestions.length > 0 ? (
                <ul className="grid gap-1">
                  {suggestions.map((skill) => (
                    <li key={skill.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm text-ink hover:bg-surface"
                        onClick={() =>
                          onChange({
                            ...form,
                            skillId: skill.id,
                            skillName: skill.preferredLabel,
                          })
                        }
                      >
                        <span>{skill.preferredLabel}</span>
                        <Badge tone={skillTypeTone(skill.skillType)} className="normal-case">
                          {formatSkillType(skill.skillType)}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="po-helper mt-2">Select an official ESCO skill. Type at least two characters to search.</p>
          )}
        </div>
      )}
    </Field>
  )
}

function SkillFormFields({ form, onChange, idPrefix, editing = false }) {
  return (
    <div className="space-y-4">
      <EscoSkillNameField form={form} onChange={onChange} idPrefix={idPrefix} disabled={editing} />
      {form.skillId && !editing ? (
        <p className="po-secondary">Selected ESCO skill is ready to record.</p>
      ) : null}
      <SelectInput
        id={`${idPrefix}-level`}
        label="Proficiency Level"
        value={form.proficiencyLevel}
        onChange={(event) => onChange({ ...form, proficiencyLevel: event.target.value })}
        options={PROFICIENCY_LEVELS.map((value) => ({ value, label: value }))}
      />
    </div>
  )
}

function SkillsPage({ basePath }) {
  const catalogue = useEscoPagedSearch(fetchSkills)
  const [skills, setSkills] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState('')
  const [toast, setToast] = useState('')
  const listRequestRef = useRef(0)

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function loadSavedSkills() {
    const requestId = listRequestRef.current + 1
    listRequestRef.current = requestId
    setListLoading(true)
    setListError('')
    try {
      const items = await fetchSavedSkills()
      if (requestId !== listRequestRef.current) {
        return
      }
      setSkills(items)
    } catch (error) {
      if (requestId !== listRequestRef.current) {
        return
      }
      setSkills([])
      setListError(userFacingSkillError(error))
    } finally {
      if (requestId === listRequestRef.current) {
        setListLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadSavedSkills()
  }, [])

  function openAdd(skill = null) {
    setEditingId(null)
    setFormError('')
    setForm({
      ...emptyForm,
      skillId: skill?.id || '',
      skillName: skill?.preferredLabel || '',
    })
    setModalOpen(true)
  }

  function openEdit(record) {
    setEditingId(record.id)
    setFormError('')
    setForm({
      skillId: record.skill.id,
      skillName: record.skill.preferredLabel,
      proficiencyLevel: record.proficiencyLevel,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (saving) {
      return
    }

    if (!editingId && !form.skillId) {
      setFormError('Select an official ESCO skill before saving.')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      if (editingId) {
        await updateSavedSkill(editingId, { proficiencyLevel: form.proficiencyLevel })
        await loadSavedSkills()
        setModalOpen(false)
        showToast('Skill updated.')
      } else {
        await createSavedSkill({
          skillId: form.skillId,
          proficiencyLevel: form.proficiencyLevel,
        })
        await loadSavedSkills()
        setModalOpen(false)
        showToast('Skill added.')
      }
    } catch (error) {
      setFormError(userFacingSkillError(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id) {
    if (removingId || saving) {
      return
    }
    setRemovingId(id)
    try {
      await deleteSavedSkill(id)
      await loadSavedSkills()
      showToast('Skill removed.')
    } catch (error) {
      showToast(userFacingSkillError(error))
    } finally {
      setRemovingId('')
    }
  }

  return (
    <PageContent
      title="My Skills"
      description="Manage the skills used for career analysis and job matching. You can also identify skills from an uploaded resume."
      actions={
        <>
          <Button variant="outline" onClick={() => openAdd()} disabled={saving}>
            Add Skill
          </Button>
          <Button variant="secondary" to={`${basePath}/resume`}>
            My Resume
          </Button>
          <Button variant="secondary" to={`${basePath}/career-target`}>
            Career Target
          </Button>
          <Button to={`${basePath}/skill-gap`}>Run Skill Gap Analysis</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recorded Skills" value={listLoading ? '—' : String(skills.length)} />
        <StatCard label="Beginner" value={listLoading ? '—' : String(countByProficiency(skills, 'Beginner'))} />
        <StatCard label="Intermediate" value={listLoading ? '—' : String(countByProficiency(skills, 'Intermediate'))} />
        <StatCard label="Advanced" value={listLoading ? '—' : String(countByProficiency(skills, 'Advanced'))} />
      </div>

      <Card className="mt-8">
        <SectionHeader
          title="ESCO skill catalogue"
          description="Search official skill records and add a selected skill to your saved list."
        />
        <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={catalogue.search}>
          <SearchInput
            id="skill-catalogue-search"
            label="Search skills"
            value={catalogue.input}
            onChange={(event) => catalogue.setInput(event.target.value)}
            placeholder="ICT safety"
          />
          <div className="flex items-end">
            <Button type="submit" className="w-full md:w-auto" disabled={catalogue.loading}>
              Search
            </Button>
          </div>
        </form>
        <div className="mt-4">
          <QueryStatus
            loading={catalogue.loading}
            error={catalogue.error}
            empty={catalogue.items.length === 0}
            loadingLabel="Loading skills…"
            emptyTitle="No skills match this search yet."
            emptyDescription="Try a different skill name, or clear the search to browse the catalogue."
            onRetry={catalogue.retry}
          >
            <Table
              minWidthClass="min-w-[640px]"
              headers={['Skill', 'Skill type', 'Source', 'Actions']}
              rows={catalogue.items.map((skill) => [
                skill.preferredLabel,
                <Badge
                  key={`${skill.id}-type`}
                  tone={skillTypeTone(skill.skillType)}
                  className="normal-case"
                >
                  {formatSkillType(skill.skillType)}
                </Badge>,
                skill.sourceSystem || 'ESCO',
                <Button key={`${skill.id}-add`} size="sm" variant="secondary" onClick={() => openAdd(skill)}>
                  Add
                </Button>,
              ])}
            />
            <PaginationBar
              page={catalogue.meta.page}
              totalPages={catalogue.meta.totalPages}
              total={catalogue.meta.total}
              noun="skills"
              disabled={catalogue.loading}
              onPrevious={() => catalogue.goToPage(catalogue.page - 1)}
              onNext={() => catalogue.goToPage(catalogue.page + 1)}
            />
          </QueryStatus>
        </div>
      </Card>

      <div className="mt-8">
        <SectionHeader title="My skills" />
        <QueryStatus
          loading={listLoading}
          error={listError}
          empty={skills.length === 0}
          loadingLabel="Loading your recorded skills…"
          emptyTitle="No skills recorded yet."
          emptyDescription="Search the ESCO catalogue and add a skill with a proficiency level."
          onRetry={loadSavedSkills}
        >
          <Table
            minWidthClass="min-w-[720px]"
            headers={['Skill Name', 'Skill type', 'Proficiency Level', 'Actions']}
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
              <div key={`${record.id}-actions`} className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={Boolean(removingId) || saving}
                  onClick={() => openEdit(record)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={removingId === record.id || saving}
                  onClick={() => handleRemove(record.id)}
                >
                  {removingId === record.id ? 'Removing…' : 'Remove'}
                </Button>
              </div>,
            ])}
          />
        </QueryStatus>
      </div>

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit Skill' : 'Add Skill'}
        onClose={() => {
          if (!saving) {
            setModalOpen(false)
          }
        }}
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Skill' : 'Add Skill'}
            </Button>
          </>
        }
      >
        <SkillFormFields
          form={form}
          onChange={setForm}
          idPrefix={editingId ? 'edit-skill' : 'add-skill'}
          editing={Boolean(editingId)}
        />
        {formError ? (
          <p className="po-helper po-helper-error mt-4" role="alert">
            {formError}
          </p>
        ) : null}
      </Modal>

      <Toast message={toast} />
    </PageContent>
  )
}

export default SkillsPage
