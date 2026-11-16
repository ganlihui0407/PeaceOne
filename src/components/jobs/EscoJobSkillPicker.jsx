import { Trash2 } from 'lucide-react'
import Badge from '../common/Badge.jsx'
import Button from '../common/Button.jsx'
import PaginationBar from '../common/PaginationBar.jsx'
import QueryStatus from '../common/QueryStatus.jsx'
import Table from '../common/Table.jsx'
import Card from '../cards/Card.jsx'
import SearchInput from '../forms/SearchInput.jsx'
import SelectInput from '../forms/SelectInput.jsx'
import SectionHeader from '../ui/SectionHeader.jsx'
import { fetchSkills, formatSkillType, skillTypeTone } from '../../api/esco.js'
import { JOB_REQUIRED_LEVELS, JOB_REQUIRED_SKILL_MAX } from '../../api/jobs.js'
import { hasJobSkill } from '../../api/jobForm.js'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'

function EscoJobSkillPicker({ skills, error, disabled, onChange }) {
  const catalogue = useEscoPagedSearch(fetchSkills)
  const atLimit = skills.length >= JOB_REQUIRED_SKILL_MAX

  function addSkill(skill) {
    if (disabled || atLimit || hasJobSkill(skills, skill.id)) {
      return
    }
    onChange([
      ...skills,
      {
        skillId: skill.id,
        preferredLabel: skill.preferredLabel,
        skillType: skill.skillType ?? null,
        requiredLevel: 'Beginner',
      },
    ])
  }

  function updateLevel(skillId, requiredLevel) {
    onChange(skills.map((skill) => (skill.skillId === skillId ? { ...skill, requiredLevel } : skill)))
  }

  function removeSkill(skillId) {
    onChange(skills.filter((skill) => skill.skillId !== skillId))
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeader
          title="Required ESCO skills"
          description="Search the ESCO catalogue and add skills expected for this vacancy. Duplicate skills cannot be added."
        />
        {error ? <p className="po-helper mt-3 text-danger">{error}</p> : null}
        {atLimit ? (
          <p className="po-helper mt-3">You have reached the maximum of {JOB_REQUIRED_SKILL_MAX} skills.</p>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <SearchInput
            id="job-skill-search"
            label="Search ESCO skills"
            value={catalogue.input}
            placeholder="SQL, Python, or an ESCO skill URI"
            disabled={disabled}
            onChange={(event) => catalogue.setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                catalogue.search()
              }
            }}
          />
          <div className="flex items-end">
            <Button type="button" disabled={disabled || catalogue.loading} onClick={() => catalogue.search()}>
              Search
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <QueryStatus
            loading={catalogue.loading}
            error={catalogue.error}
            empty={catalogue.items.length === 0}
            loadingLabel="Loading ESCO skills…"
            emptyTitle="No skills match this search yet."
            emptyDescription="Try a different skill name, or clear the search to browse the catalogue."
            onRetry={catalogue.retry}
          >
            <Table
              minWidthClass="min-w-[640px]"
              headers={['Skill', 'Skill type', 'Actions']}
              rows={catalogue.items.map((skill) => {
                const added = hasJobSkill(skills, skill.id)
                return [
                  skill.preferredLabel,
                  <Badge key={`${skill.id}-type`} tone={skillTypeTone(skill.skillType)} className="normal-case">
                    {formatSkillType(skill.skillType)}
                  </Badge>,
                  <Button
                    key={`${skill.id}-add`}
                    size="sm"
                    variant="secondary"
                    disabled={disabled || added || atLimit}
                    onClick={() => addSkill(skill)}
                  >
                    {added ? 'Added' : 'Add'}
                  </Button>,
                ]
              })}
            />
            <PaginationBar
              page={catalogue.meta.page}
              totalPages={catalogue.meta.totalPages}
              total={catalogue.meta.total}
              noun="skills"
              disabled={disabled || catalogue.loading}
              onPrevious={() => catalogue.goToPage(catalogue.page - 1)}
              onNext={() => catalogue.goToPage(catalogue.page + 1)}
            />
          </QueryStatus>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Selected skills" description="Set the required proficiency for each selected ESCO skill." />
        {skills.length === 0 ? (
          <p className="po-helper mt-4">No ESCO skills selected yet. Drafts can be saved without skills; publishing requires at least one.</p>
        ) : (
          <div className="mt-5">
            <Table
              minWidthClass="min-w-[640px]"
              headers={['Skill', 'Required level', 'Actions']}
              rows={skills.map((skill, index) => [
                skill.preferredLabel,
                <SelectInput
                  key={`${skill.skillId}-level`}
                  id={`job-skill-level-${skill.skillId}`}
                  label={`Required level for ${skill.preferredLabel}`}
                  value={skill.requiredLevel}
                  options={JOB_REQUIRED_LEVELS}
                  disabled={disabled}
                  onChange={(event) => updateLevel(skill.skillId, event.target.value)}
                />,
                <Button
                  key={`${skill.skillId}-remove`}
                  size="sm"
                  variant="danger"
                  disabled={disabled}
                  aria-label={`Remove skill ${index + 1}`}
                  onClick={() => removeSkill(skill.skillId)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Remove
                </Button>,
              ])}
            />
          </div>
        )}
      </Card>
    </div>
  )
}

export default EscoJobSkillPicker
