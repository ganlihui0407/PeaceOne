import Card from '../../../components/cards/Card.jsx'
import Section from '../../../components/layout/Section.jsx'
import {
  BookOpen,
  Briefcase,
  Building2,
  FileText,
  ListChecks,
  Shield,
  Sparkles,
  Target,
} from 'lucide-react'

const features = [
  {
    title: 'Skill Profile',
    text: 'Record skills, proficiency and verification status in one place.',
    icon: Sparkles,
  },
  {
    title: 'Career Target',
    text: 'Choose a career direction and review the skills it typically requires.',
    icon: Target,
  },
  {
    title: 'Skill Gap Analysis',
    text: 'Compare current skills with a selected career target using predefined results.',
    icon: ListChecks,
  },
  {
    title: 'Learning Progress',
    text: 'Browse recommended learning content and follow progress in the workspace.',
    icon: BookOpen,
  },
  {
    title: 'Job Opportunities',
    text: 'Explore job postings related to skills and career direction.',
    icon: Briefcase,
  },
  {
    title: 'Application Tracking',
    text: 'Keep submitted applications and their status organised.',
    icon: FileText,
  },
  {
    title: 'Employer Recruitment',
    text: 'Create job postings, review applicants and schedule interviews.',
    icon: Building2,
  },
  {
    title: 'Administration Management',
    text: 'Oversee users, content, job postings and platform reports.',
    icon: Shield,
  },
]

function KeyFeaturesSection() {
  return (
    <Section className="bg-surface">
      <p className="po-secondary">Platform features</p>
      <h2 className="po-page-title mt-2 max-w-2xl">What PeaceOne helps you organise</h2>
      <p className="po-secondary mt-3 max-w-2xl">
        Each workspace presents the same career-development steps in a structured interface. These
        screens are demonstration views for the PeaceOne prototype.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon

          return (
            <Card key={feature.title} className="h-full">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-soft text-primary">
                <Icon size={20} aria-hidden="true" />
              </div>
              <h3 className="po-card-title">{feature.title}</h3>
              <p className="po-secondary mt-2">{feature.text}</p>
            </Card>
          )
        })}
      </div>
    </Section>
  )
}

export default KeyFeaturesSection
