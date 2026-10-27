import { useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import Field from '../../components/forms/Field.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import {
  addSkillSourceTypes,
  initialUserSkills,
  proficiencyLevels,
  skillCatalogue,
  skillCategories,
  skillsSummary,
} from '../../data/skills.js'

const emptyForm = {
  skillName: '',
  skillCategory: 'Programming',
  proficiencyLevel: 'Beginner',
  sourceType: 'Self-Claim',
}

function SkillFormFields({ form, onChange, idPrefix }) {
  return (
    <div className="space-y-4">
      <Field id={`${idPrefix}-name`} label="Skill Name">
        {(describedBy) => (
          <>
            <input
              id={`${idPrefix}-name`}
              list={`${idPrefix}-skill-options`}
              aria-describedby={describedBy}
              className="po-field"
              value={form.skillName}
              onChange={(event) => onChange({ ...form, skillName: event.target.value })}
              placeholder="Python"
            />
            <datalist id={`${idPrefix}-skill-options`}>
              {skillCatalogue.map((skill) => (
                <option key={skill.skillName} value={skill.skillName} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <SelectInput
        id={`${idPrefix}-category`}
        label="Skill Category"
        value={form.skillCategory}
        onChange={(event) => onChange({ ...form, skillCategory: event.target.value })}
        options={skillCategories.map((value) => ({ value, label: value }))}
      />
      <SelectInput
        id={`${idPrefix}-level`}
        label="Proficiency Level"
        value={form.proficiencyLevel}
        onChange={(event) => onChange({ ...form, proficiencyLevel: event.target.value })}
        options={proficiencyLevels.map((value) => ({ value, label: value }))}
      />
      <SelectInput
        id={`${idPrefix}-source`}
        label="Source Type"
        value={form.sourceType}
        onChange={(event) => onChange({ ...form, sourceType: event.target.value })}
        options={addSkillSourceTypes.map((value) => ({ value, label: value }))}
      />
    </div>
  )
}

function SkillsPage({ basePath }) {
  const [skills, setSkills] = useState(initialUserSkills)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(skill) {
    setEditingId(skill.id)
    setForm({
      skillName: skill.skillName,
      skillCategory: skill.skillCategory,
      proficiencyLevel: skill.proficiencyLevel,
      sourceType: skill.sourceType === 'Resume' ? 'Self-Claim' : skill.sourceType,
    })
    setModalOpen(true)
  }

  function handleSave() {
    const skillName = form.skillName.trim()
    if (!skillName) {
      showToast('Enter a skill name to continue.')
      return
    }

    const catalogueMatch = skillCatalogue.find(
      (item) => item.skillName.toLowerCase() === skillName.toLowerCase(),
    )

    if (editingId) {
      setSkills((current) =>
        current.map((skill) =>
          skill.id === editingId
            ? {
                ...skill,
                skillName,
                skillCategory: form.skillCategory,
                proficiencyLevel: form.proficiencyLevel,
                sourceType: form.sourceType,
              }
            : skill,
        ),
      )
      showToast('Skill updated.')
    } else {
      setSkills((current) => [
        ...current,
        {
          id: `skill-${Date.now()}`,
          skillName,
          skillCategory: catalogueMatch?.skillCategory || form.skillCategory,
          proficiencyLevel: form.proficiencyLevel,
          sourceType: form.sourceType,
          verificationStatus: 'Pending',
        },
      ])
      showToast('Skill added.')
    }

    setModalOpen(false)
  }

  function handleRemove(id) {
    setSkills((current) => current.filter((skill) => skill.id !== id))
    showToast('Skill removed.')
  }

  return (
    <PageContent
      title="My Skills"
      description="Manage the skills used for career analysis and job matching."
      actions={
        <>
          <Button variant="outline" onClick={openAdd}>
            Add Skill
          </Button>
          <Button variant="secondary" to={`${basePath}/resume`}>
            Upload Resume
          </Button>
          <Button variant="secondary" to={`${basePath}/career-target`}>
            Career Target
          </Button>
          <Button to={`${basePath}/skill-gap`}>Run Skill Gap Analysis</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Skills" value={String(skillsSummary.totalSkills)} />
        <StatCard label="Verified Skills" value={String(skillsSummary.verifiedSkills)} />
        <StatCard label="Pending Verification" value={String(skillsSummary.pendingVerification)} />
        <StatCard label="Resume Extracted" value={String(skillsSummary.resumeExtracted)} />
      </div>

      <div className="mt-8">
        <Table
          minWidthClass="min-w-[720px]"
          headers={['Skill Name', 'Proficiency Level', 'Source Type', 'Verification Status', 'Actions']}
          rows={skills.map((skill) => [
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
            <div key={`${skill.id}-actions`} className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => openEdit(skill)}>
                Edit
              </Button>
              <Button size="sm" variant="danger" onClick={() => handleRemove(skill.id)}>
                Remove
              </Button>
            </div>,
          ])}
        />
      </div>

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit Skill' : 'Add Skill'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editingId ? 'Save Skill' : 'Add Skill'}</Button>
          </>
        }
      >
        <SkillFormFields form={form} onChange={setForm} idPrefix={editingId ? 'edit-skill' : 'add-skill'} />
      </Modal>

      <Toast message={toast} />
    </PageContent>
  )
}

export default SkillsPage
