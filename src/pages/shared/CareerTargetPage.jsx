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

function CareerTargetPage({ basePath }) {
  const [selectedId, setSelectedId] = useState('data-analyst')
  const [toast, setToast] = useState('')
  const target = careerTargets.find((item) => item.id === selectedId) || careerTargets[0]

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  return (
    <PageContent
      title="Career Target"
      description="Choose the career role you want to prepare for."
    >
      <Card>
        <SelectInput
          id="career-target"
          label="Select Career Target"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          options={careerTargets.map((item) => ({ value: item.id, label: item.careerName }))}
        />
      </Card>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="po-secondary">Career Name</p>
            <h2 className="po-section-title mt-1">{target.careerName}</h2>
            <p className="po-helper mt-2">Industry</p>
            <p className="text-sm font-medium text-ink">{target.industry}</p>
            <p className="po-helper mt-4">Career Description</p>
            <p className="po-secondary mt-1 max-w-2xl">{target.careerDescription}</p>
          </div>
          <div>
            <p className="po-helper">Status</p>
            <Badge status="active" className="mt-1 normal-case">
              {target.status}
            </Badge>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => showToast('Career target updated.')}>
            Set as Career Target
          </Button>
          <Button variant="secondary" to={`${basePath}/skill-gap`}>
            Run Skill Gap Analysis
          </Button>
        </div>
      </Card>

      <section className="mt-8">
        <SectionHeader title="Required skills preview" />
        <Table
          minWidthClass="min-w-[640px]"
          headers={['Skill', 'Required Level', 'Importance']}
          rows={target.requiredSkills.map((item) => [
            item.skill,
            item.requiredLevel,
            <Badge
              key={item.skill}
              tone={item.importance === 'High' ? 'primary' : 'default'}
              className="normal-case"
            >
              {item.importance}
            </Badge>,
          ])}
        />
      </section>

      <Toast message={toast} />
    </PageContent>
  )
}

export default CareerTargetPage
