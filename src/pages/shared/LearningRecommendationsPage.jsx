import { useMemo, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/cards/Card.jsx'
import CourseCard from '../../components/cards/CourseCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import {
  learningContentTypes,
  learningContents,
  learningDifficulties,
  learningSkills,
} from '../../data/learningContent.js'

function LearningRecommendationsPage({ basePath }) {
  const [query, setQuery] = useState('')
  const [skill, setSkill] = useState('All')
  const [difficulty, setDifficulty] = useState('All')
  const [contentType, setContentType] = useState('All')
  const [appliedQuery, setAppliedQuery] = useState('')

  const results = useMemo(() => {
    return learningContents.filter((item) => {
      const queryOk =
        !appliedQuery ||
        `${item.title} ${item.skill} ${item.description}`.toLowerCase().includes(appliedQuery.trim().toLowerCase())
      const skillOk = skill === 'All' || item.skill === skill
      const difficultyOk = difficulty === 'All' || item.difficulty === difficulty
      const typeOk = contentType === 'All' || item.contentType === contentType
      return queryOk && skillOk && difficultyOk && typeOk
    })
  }, [appliedQuery, contentType, difficulty, skill])

  const recommended = results.filter((item) => item.recommended)
  const catalogue = results.filter((item) => !item.recommended)

  function handleSearch(event) {
    event.preventDefault()
    setAppliedQuery(query)
  }

  return (
    <PageContent
      title="Learning Recommendations"
      description="Build the skills you need for your career target."
      actions={
        <Button variant="secondary" to={`${basePath}/learning/progress`}>
          Learning Progress
        </Button>
      }
    >
      <Card className="mb-8">
        <h2 className="po-section-title">Recommended for your Data Analyst career target</h2>
        <p className="po-secondary mt-2">Career Readiness: 72%</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge status="insufficient">SQL</Badge>
          <Badge status="insufficient">Data Visualization</Badge>
          <Badge status="missing">Machine Learning</Badge>
        </div>
        <div className="mt-5">
          <Button variant="secondary" to={`${basePath}/skill-gap`}>
            Review Skill Gap
          </Button>
        </div>
      </Card>

      <form
        className="mb-8 grid gap-4 rounded-xl border border-line bg-surface p-5 md:grid-cols-2 xl:grid-cols-5"
        onSubmit={handleSearch}
      >
        <div className="xl:col-span-2">
          <SearchInput
            id="search-learning"
            label="Search Learning"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="SQL, visualisation, communication"
          />
        </div>
        <SelectInput
          id="learning-skill"
          label="Skill"
          value={skill}
          onChange={(event) => setSkill(event.target.value)}
          options={learningSkills.map((value) => ({ value, label: value }))}
        />
        <SelectInput
          id="learning-difficulty"
          label="Difficulty"
          value={difficulty}
          onChange={(event) => setDifficulty(event.target.value)}
          options={learningDifficulties.map((value) => ({ value, label: value }))}
        />
        <SelectInput
          id="learning-type"
          label="Content Type"
          value={contentType}
          onChange={(event) => setContentType(event.target.value)}
          options={learningContentTypes.map((value) => ({ value, label: value }))}
        />
        <div className="flex items-end md:col-span-2 xl:col-span-5">
          <Button type="submit">Search</Button>
        </div>
      </form>

      <section>
        <SectionHeader title="Recommended learning" />
        <div className="grid gap-5 md:grid-cols-2">
          {recommended.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              actions={[{ label: 'View Learning', to: `${basePath}/learning/${course.id}` }]}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeader title="Learning catalogue" />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {catalogue.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              actions={[{ label: 'View Learning', to: `${basePath}/learning/${course.id}`, variant: 'secondary' }]}
            />
          ))}
        </div>
      </section>

      {results.length === 0 ? (
        <p className="po-secondary mt-8">No learning resources match these filters yet.</p>
      ) : null}
    </PageContent>
  )
}

export default LearningRecommendationsPage
