import Card from '../../../components/cards/Card.jsx'
import Section from '../../../components/layout/Section.jsx'
import { ClipboardList, Target, BookOpen, Briefcase } from 'lucide-react'

const stages = [
  {
    step: '1',
    title: 'Understand Your Skills',
    text: 'Build a skill profile and review the capabilities you already have.',
    icon: ClipboardList,
  },
  {
    step: '2',
    title: 'Set a Career Target',
    text: 'Choose a career direction and compare it with your current skills.',
    icon: Target,
  },
  {
    step: '3',
    title: 'Follow Related Learning',
    text: 'Browse learning content connected to the skills you want to develop.',
    icon: BookOpen,
  },
  {
    step: '4',
    title: 'Explore Opportunities',
    text: 'Review job postings and keep applications organised in one place.',
    icon: Briefcase,
  },
]

function JourneySection() {
  return (
    <Section>
      <p className="po-secondary">How PeaceOne works</p>
      <h2 className="po-page-title mt-2 max-w-2xl">A clearer path from skills to opportunity</h2>
      <p className="po-secondary mt-3 max-w-2xl">
        PeaceOne organises career planning as a sequence of workspace steps, so each stage stays
        easy to follow.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage) => {
          const Icon = stage.icon

          return (
            <Card key={stage.step} className="h-full">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-soft text-primary">
                <Icon size={20} aria-hidden="true" />
              </div>
              <p className="po-helper mb-1">Step {stage.step}</p>
              <h3 className="po-card-title">{stage.title}</h3>
              <p className="po-secondary mt-2">{stage.text}</p>
            </Card>
          )
        })}
      </div>
    </Section>
  )
}

export default JourneySection
