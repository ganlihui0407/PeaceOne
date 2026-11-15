import Badge from '../common/Badge.jsx'
import Button from '../common/Button.jsx'
import Card from '../cards/Card.jsx'
import { cn } from '../../utils/cn.js'
import {
  formatNotificationTime,
  isNotificationUnread,
} from '../../api/notifications.js'

function NotificationList({
  items,
  onOpen,
  onMarkRead,
  openingId = '',
  markingId = '',
  compact = false,
}) {
  return (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      {items.map((item) => {
        const unread = isNotificationUnread(item)
        return (
          <Card
            key={item.id}
            padding={compact ? 'sm' : 'sm'}
            className={cn(unread && 'border-primary/20 bg-soft/40')}
          >
            <article>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="po-card-title">{item.title}</h2>
                <div className="flex items-center gap-2">
                  {unread ? (
                    <Badge tone="info" className="normal-case">
                      Unread
                    </Badge>
                  ) : (
                    <span className="po-helper mt-0">Read</span>
                  )}
                  <p className="po-helper mt-0">{formatNotificationTime(item.createdAt)}</p>
                </div>
              </div>
              <p className="po-secondary mt-1">{item.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={openingId === item.id}
                  onClick={() => onOpen?.(item)}
                >
                  {openingId === item.id ? 'Opening…' : 'Open'}
                </Button>
                {unread && onMarkRead ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={markingId === item.id}
                    onClick={() => onMarkRead(item)}
                  >
                    {markingId === item.id ? 'Saving…' : 'Mark as read'}
                  </Button>
                ) : null}
              </div>
            </article>
          </Card>
        )
      })}
    </div>
  )
}

export default NotificationList
