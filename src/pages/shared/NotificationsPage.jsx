import { Bell } from 'lucide-react'
import Card from '../../components/cards/Card.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { cn } from '../../utils/cn.js'

function NotificationsPage({ items = [] }) {
  return (
    <PageContent
      title="Notifications"
      description="Stay up to date with activity across your PeaceOne workspace."
    >
      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="No notifications"
            description="New updates about applications, learning and interviews will appear here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} padding="sm" className={cn(item.unread && 'border-primary/20 bg-soft/40')}>
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-soft text-primary">
                  <Bell size={18} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="po-card-title">{item.title}</h2>
                    <p className="po-helper mt-0">{item.time}</p>
                  </div>
                  <p className="po-secondary mt-1">{item.message}</p>
                  <p className="mt-2 text-xs font-medium text-muted">{item.unread ? 'Unread' : 'Read'}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContent>
  )
}

export default NotificationsPage
