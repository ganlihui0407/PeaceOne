import { useMemo, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import {
  adminContentStatuses,
  adminContentTypes,
  adminLearningContents,
  adminLearningDifficulties,
  adminLearningSkills,
  adminLearningSummary,
} from '../../data/adminLearning.js'

function LearningManagement() {
  const [query, setQuery] = useState('')
  const [skill, setSkill] = useState('All')
  const [contentType, setContentType] = useState('All')
  const [difficulty, setDifficulty] = useState('All')
  const [status, setStatus] = useState('All')
  const [statusById, setStatusById] = useState({})
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState('')

  const rows = useMemo(() => {
    return adminLearningContents
      .map((item) => ({
        ...item,
        contentStatus: statusById[item.id] || item.contentStatus,
      }))
      .filter((item) => {
        const matchesSkill = skill === 'All' || item.skill === skill
        const matchesType = contentType === 'All' || item.contentType === contentType
        const matchesDifficulty = difficulty === 'All' || item.difficultyLevel === difficulty
        const matchesStatus = status === 'All' || item.contentStatus === status
        return (
          matchesSkill &&
          matchesType &&
          matchesDifficulty &&
          matchesStatus &&
          item.title.toLowerCase().includes(query.trim().toLowerCase())
        )
      })
  }, [query, skill, contentType, difficulty, status, statusById])

  function archiveItem(item) {
    setStatusById((current) => ({ ...current, [item.id]: 'Archived' }))
    setToast('Learning content archived.')
    window.setTimeout(() => setToast(''), 2500)
  }

  return (
    <PageContent
      title="Learning Content Management"
      description="Create and maintain learning resources used in PeaceOne recommendations."
      actions={<Button to="/admin/learning/create">Add Learning Content</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {adminLearningSummary.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="mt-8 mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SearchInput
          id="admin-learning-search"
          label="Search Content"
          value={query}
          placeholder="Search by title"
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectInput
          id="admin-learning-skill"
          label="Skill"
          value={skill}
          onChange={(event) => setSkill(event.target.value)}
          options={adminLearningSkills}
        />
        <SelectInput
          id="admin-learning-type"
          label="Content Type"
          value={contentType}
          onChange={(event) => setContentType(event.target.value)}
          options={['All', ...adminContentTypes]}
        />
        <SelectInput
          id="admin-learning-difficulty"
          label="Difficulty"
          value={difficulty}
          onChange={(event) => setDifficulty(event.target.value)}
          options={['All', ...adminLearningDifficulties]}
        />
        <SelectInput
          id="admin-learning-status"
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={['All', ...adminContentStatuses]}
        />
      </div>

      <Table
        minWidthClass="min-w-[880px]"
        headers={['Title', 'Content Type', 'Difficulty Level', 'Skill', 'Content Status', 'Actions']}
        rows={rows.map((item) => [
          item.title,
          item.contentType,
          item.difficultyLevel,
          item.skill,
          <Badge key={`${item.id}-status`} status={item.contentStatus.toLowerCase()} className="normal-case">
            {item.contentStatus}
          </Badge>,
          <div key={`${item.id}-actions`} className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelected(item)}>
              View
            </Button>
            <Button size="sm" variant="secondary" to={`/admin/learning/${item.id}/edit`}>
              Edit
            </Button>
            {item.contentStatus !== 'Archived' ? (
              <Button size="sm" variant="ghost" onClick={() => archiveItem(item)}>
                Archive
              </Button>
            ) : null}
          </div>,
        ])}
      />

      <Modal
        open={Boolean(selected)}
        title={selected ? selected.title : 'Learning content'}
        size="lg"
        onClose={() => setSelected(null)}
        footer={
          <Button variant="secondary" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="po-helper">Content Type</dt>
              <dd className="font-medium text-ink">{selected.contentType}</dd>
            </div>
            <div>
              <dt className="po-helper">Difficulty Level</dt>
              <dd className="font-medium text-ink">{selected.difficultyLevel}</dd>
            </div>
            <div>
              <dt className="po-helper">Resource URL</dt>
              <dd className="font-medium text-ink">{selected.resourceUrl}</dd>
            </div>
            <div>
              <dt className="po-helper">Content Status</dt>
              <dd>
                <Badge status={selected.contentStatus.toLowerCase()} className="normal-case">
                  {selected.contentStatus}
                </Badge>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="po-helper">Description</dt>
              <dd className="po-body mt-1">{selected.description}</dd>
            </div>
          </dl>
        ) : null}
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default LearningManagement
