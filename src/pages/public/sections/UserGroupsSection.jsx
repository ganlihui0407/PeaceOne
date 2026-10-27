import Card from '../../../components/cards/Card.jsx'
import Section from '../../../components/layout/Section.jsx'
import { Building2, GraduationCap, Shield } from 'lucide-react'

const groups = [
  {
    title: 'Student / Job Seeker',
    text: 'Build a skill profile, set a career target, review skill gaps, follow learning and explore job opportunities.',
    note: 'Current Position: Student or Job Seeker',
    icon: GraduationCap,
  },
  {
    title: 'Company Staff',
    text: 'Create job postings, review applicants and organise interviews from a recruitment workspace.',
    icon: Building2,
  },
  {
    title: 'Admin',
    text: 'Oversee users, job postings, learning content and platform reports.',
    icon: Shield,
  },
]

function UserGroupsSection() {
  return (
    <Section className="bg-surface">
      <p className="po-secondary">Who uses PeaceOne</p>
      <h2 className="po-page-title mt-2 max-w-2xl">Built for the people in the career journey</h2>
      <p className="po-secondary mt-3 max-w-2xl">
        Registration uses three primary roles. Student / Job Seeker then choose a current position
        for the logged-in workspace.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {groups.map((group) => {
          const Icon = group.icon

          return (
            <Card key={group.title} className="h-full">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-soft text-primary">
                <Icon size={20} aria-hidden="true" />
              </div>
              <h3 className="po-card-title">{group.title}</h3>
              <p className="po-secondary mt-2">{group.text}</p>
              {group.note ? <p className="po-helper mt-3">{group.note}</p> : null}
            </Card>
          )
        })}
      </div>
    </Section>
  )
}

export default UserGroupsSection
