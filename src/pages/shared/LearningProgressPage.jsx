import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import ProgressBar from '../../components/common/ProgressBar.jsx'
import Card from '../../components/cards/Card.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { learningContents } from '../../data/learningContent.js'
import { learningProgressItems, learningProgressSummary } from '../../data/learningProgress.js'

function statusKey(status) {
  return status === 'In Progress' ? 'inprogress' : status.toLowerCase()
}

function LearningProgressPage({ basePath }) {
  const items = learningProgressItems.map((item) => ({
    ...item,
    content: learningContents.find((content) => content.id === item.contentId),
  }))

  return (
    <PageContent
      title="Learning Progress"
      description="Track learning activities connected to your career target."
      actions={
        <Button variant="secondary" to={`${basePath}/learning`}>
          Back to Recommendations
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="In Progress" value={String(learningProgressSummary.inProgress)} />
        <StatCard label="Completed" value={String(learningProgressSummary.completed)} />
        <StatCard label="Skills Improved" value={String(learningProgressSummary.skillsImproved)} />
      </div>

      <div className="mt-8 space-y-4">
        {items.map((item) => (
          <Card key={item.contentId}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="po-card-title">{item.content?.title || 'Learning item'}</h2>
                <p className="po-helper mt-1">Progress: {item.progressPercentage}%</p>
                <div className="mt-3 max-w-xl">
                  <ProgressBar value={item.progressPercentage} />
                </div>
                <dl className="po-secondary mt-4 grid gap-2 sm:grid-cols-3">
                  <div>
                    <dt className="po-helper">Status</dt>
                    <dd>
                      <Badge status={statusKey(item.completionStatus)} className="normal-case">
                        {item.completionStatus}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="po-helper">Started</dt>
                    <dd className="font-medium text-ink">{item.startedAt}</dd>
                  </div>
                  {item.completedAt ? (
                    <div>
                      <dt className="po-helper">Completed</dt>
                      <dd className="font-medium text-ink">{item.completedAt}</dd>
                    </div>
                  ) : null}
                  {item.verificationStatus ? (
                    <div>
                      <dt className="po-helper">Verification</dt>
                      <dd>
                        <Badge status={item.verificationStatus.toLowerCase()} className="normal-case">
                          {item.verificationStatus}
                        </Badge>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <Button to={`${basePath}/learning/${item.contentId}`} size="sm" className="shrink-0">
                Continue Learning
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </PageContent>
  )
}

export default LearningProgressPage
