import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import Field from '../../components/forms/Field.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import { skillCatalogue } from '../../data/skills.js'
import {
  adminContentStatuses,
  adminContentTypes,
  adminLearningDifficulties,
  getAdminLearningContent,
} from '../../data/adminLearning.js'

function nextSkillId() {
  return `lc-skill-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function createDefaults() {
  return {
    title: '',
    contentType: 'Course',
    description: '',
    resourceUrl: '',
    difficultyLevel: 'Beginner',
    contentStatus: 'Draft',
    skillsCovered: [{ id: nextSkillId(), skill: 'SQL', targetLevel: 'Intermediate' }],
  }
}

function contentToForm(item) {
  return {
    title: item.title,
    contentType: item.contentType,
    description: item.description,
    resourceUrl: item.resourceUrl,
    difficultyLevel: item.difficultyLevel,
    contentStatus: item.contentStatus,
    skillsCovered: item.skillsCovered.map((skill) => ({ ...skill })),
  }
}

function LearningContentFormPage() {
  const { contentId } = useParams()
  return <LearningContentForm key={contentId || 'create'} contentId={contentId} />
}

function LearningContentForm({ contentId }) {
  const existing = contentId ? getAdminLearningContent(contentId) : null
  const isEdit = Boolean(existing)
  const [form, setForm] = useState(() => (existing ? contentToForm(existing) : createDefaults()))
  const [toast, setToast] = useState('')

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateSkill(skillId, key, value) {
    setForm((current) => ({
      ...current,
      skillsCovered: current.skillsCovered.map((skill) =>
        skill.id === skillId ? { ...skill, [key]: value } : skill,
      ),
    }))
  }

  function addSkill() {
    setForm((current) => ({
      ...current,
      skillsCovered: [...current.skillsCovered, { id: nextSkillId(), skill: '', targetLevel: 'Beginner' }],
    }))
  }

  function removeSkill(skillId) {
    setForm((current) => ({
      ...current,
      skillsCovered: current.skillsCovered.filter((skill) => skill.id !== skillId),
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setToast('Learning content saved.')
    window.setTimeout(() => setToast(''), 2500)
  }

  if (contentId && !existing) {
    return (
      <PageContent title="Learning content not found">
        <Card>
          <p className="po-body">This learning resource could not be found.</p>
          <div className="mt-5">
            <Button to="/admin/learning" variant="secondary">
              Back to Learning Content
            </Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  return (
    <PageContent
      title={isEdit ? 'Edit Learning Content' : 'Create Learning Content'}
      description="Create and maintain learning resources used in PeaceOne recommendations."
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card>
          <h2 className="po-section-title">Content Information</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <TextInput
                id="lc-title"
                label="Title"
                value={form.title}
                placeholder="Advanced SQL for Data Analysis"
                onChange={(event) => updateField('title', event.target.value)}
              />
            </div>
            <SelectInput
              id="lc-type"
              label="Content Type"
              value={form.contentType}
              onChange={(event) => updateField('contentType', event.target.value)}
              options={adminContentTypes}
            />
            <SelectInput
              id="lc-difficulty"
              label="Difficulty Level"
              value={form.difficultyLevel}
              onChange={(event) => updateField('difficultyLevel', event.target.value)}
              options={adminLearningDifficulties}
            />
            <div className="md:col-span-2">
              <TextArea
                id="lc-description"
                label="Description"
                rows={5}
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </div>
            <TextInput
              id="lc-url"
              label="Resource URL"
              value={form.resourceUrl}
              placeholder="https://learning.peaceone.example/sql"
              onChange={(event) => updateField('resourceUrl', event.target.value)}
            />
            <SelectInput
              id="lc-status"
              label="Content Status"
              value={form.contentStatus}
              onChange={(event) => updateField('contentStatus', event.target.value)}
              options={adminContentStatuses}
            />
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Skills Covered"
            description="Map this resource to one or more skills."
            action={
              <Button type="button" variant="outline" onClick={addSkill}>
                Add Skill
              </Button>
            }
          />

          <div className="space-y-4">
            {form.skillsCovered.map((skill, index) => (
              <div
                key={skill.id}
                className="grid gap-4 rounded-xl border border-line bg-page/60 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-end"
              >
                <Field id={`${skill.id}-name`} label="Skill">
                  {(describedBy) => (
                    <>
                      <input
                        id={`${skill.id}-name`}
                        list={`${skill.id}-options`}
                        aria-describedby={describedBy}
                        className="po-field"
                        value={skill.skill}
                        placeholder="SQL"
                        onChange={(event) => updateSkill(skill.id, 'skill', event.target.value)}
                      />
                      <datalist id={`${skill.id}-options`}>
                        {skillCatalogue.map((item) => (
                          <option key={item.skillName} value={item.skillName} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <SelectInput
                  id={`${skill.id}-level`}
                  label="Target Level"
                  value={skill.targetLevel}
                  onChange={(event) => updateSkill(skill.id, 'targetLevel', event.target.value)}
                  options={adminLearningDifficulties}
                />
                <div className="flex items-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    className="w-full md:w-auto"
                    aria-label={`Remove skill ${index + 1}`}
                    onClick={() => removeSkill(skill.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" to="/admin/learning">
            Cancel
          </Button>
          <Button type="submit">Save Learning Content</Button>
        </div>
      </form>
      <Toast message={toast} />
    </PageContent>
  )
}

export default LearningContentFormPage
