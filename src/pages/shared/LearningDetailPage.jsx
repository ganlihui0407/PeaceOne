import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Toast from '../../components/common/Toast.jsx'
import ProgressBar from '../../components/common/ProgressBar.jsx'
import Card from '../../components/cards/Card.jsx'
import MediaImage from '../../components/common/MediaImage.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { learningContents } from '../../data/learningContent.js'
import { learningProgressItems } from '../../data/learningProgress.js'

function LearningDetailPage({ basePath }) {
  const { contentId } = useParams()
  const content = learningContents.find((item) => item.id === contentId)
  const existing = learningProgressItems.find((item) => item.contentId === contentId)
  const [started, setStarted] = useState(Boolean(existing))
  const [toast, setToast] = useState('')
  const progress = existing?.progressPercentage ?? 12

  if (!content) {
    return (
      <PageContent title="Learning">
        <Card>
          <p className="po-body">This learning resource could not be found.</p>
          <div className="mt-5">
            <Button to={`${basePath}/learning`}>Back to Learning</Button>
          </div>
        </Card>
      </PageContent>
    )
  }

  function handleStart() {
    setStarted(true)
    setToast('Learning activity started.')
    window.setTimeout(() => setToast(''), 2500)
  }

  return (
    <PageContent>
      <Link to={`${basePath}/learning`} className="text-sm font-medium text-primary">
        Back to Learning
      </Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex flex-wrap gap-2">
            <Badge tone="primary">{content.contentType}</Badge>
            <Badge tone="default">{content.difficulty}</Badge>
            <Badge tone="default">{content.skill}</Badge>
          </div>
          <h1 className="po-page-title mt-4">{content.title}</h1>
          <dl className="po-secondary mt-5 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="po-helper">Skill</dt>
              <dd className="font-medium text-ink">{content.skill}</dd>
            </div>
            <div>
              <dt className="po-helper">Content Type</dt>
              <dd className="font-medium text-ink">{content.contentType}</dd>
            </div>
            <div>
              <dt className="po-helper">Difficulty</dt>
              <dd className="font-medium text-ink">{content.difficulty}</dd>
            </div>
            <div>
              <dt className="po-helper">Estimated Duration</dt>
              <dd className="font-medium text-ink">{content.duration}</dd>
            </div>
            <div>
              <dt className="po-helper">Status</dt>
              <dd>
                <Badge status="active" className="normal-case">
                  {content.contentStatus}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="po-helper">Resource</dt>
              <dd className="font-medium text-ink">{content.resourceUrl}</dd>
            </div>
          </dl>
          <h2 className="po-section-title mt-8">Description</h2>
          <p className="po-secondary mt-2">{content.description}</p>
          <h2 className="po-section-title mt-8">What You Will Learn</h2>
          <ul className="po-secondary mt-3 list-disc space-y-1 pl-5">
            {content.whatYouWillLearn.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h2 className="po-section-title mt-8">Recommended Because</h2>
          <p className="po-secondary mt-2">{content.reason}</p>
          {started ? (
            <div className="mt-8">
              <p className="po-helper mb-2">Progress {progress}%</p>
              <ProgressBar value={progress} />
            </div>
          ) : null}
          <div className="mt-8">
            <Button onClick={handleStart}>{started ? 'Continue Learning' : 'Start Learning'}</Button>
          </div>
        </Card>
        <Card padding="none" className="overflow-hidden">
          <MediaImage src={content.image} alt={content.imageAlt} aspect="4/3" rounded={false} />
        </Card>
      </div>
      <Toast message={toast} />
    </PageContent>
  )
}

export default LearningDetailPage
