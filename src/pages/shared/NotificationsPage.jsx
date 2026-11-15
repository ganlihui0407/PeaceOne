import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import NotificationList from '../../components/notifications/NotificationList.jsx'
import { useAuth } from '../../auth/useAuth.js'
import { isAbortError } from '../../api/esco.js'
import {
  NOTIFICATION_EMPTY,
  NOTIFICATION_LIST_LIMIT,
  NOTIFICATION_UNREAD_EMPTY,
  NOTIFICATIONS_CHANGED_EVENT,
  announceNotificationsChanged,
  fetchNotifications,
  isNotificationUnread,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
  userFacingNotificationError,
} from '../../api/notifications.js'

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
]

function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ items: [], page: 1, totalPages: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [toast, setToast] = useState('')
  const [openingId, setOpeningId] = useState('')
  const [markingId, setMarkingId] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  const unreadOnly = filter === 'unread'
  const emptyCopy = unreadOnly ? NOTIFICATION_UNREAD_EMPTY : NOTIFICATION_EMPTY

  useEffect(() => {
    let cancelled = false
    const controllers = []

    function load({ withLoader }) {
      const controller = new AbortController()
      controllers.push(controller)
      if (withLoader) {
        setLoading(true)
        setError('')
      }
      fetchNotifications({
        unread: unreadOnly ? true : undefined,
        page,
        limit: NOTIFICATION_LIST_LIMIT,
        signal: controller.signal,
      })
        .then((next) => {
          if (!cancelled && !controller.signal.aborted) {
            setResult(next)
            setError('')
          }
        })
        .catch((loadError) => {
          if (isAbortError(loadError) || cancelled || controller.signal.aborted) {
            return
          }
          setError(userFacingNotificationError(loadError))
        })
        .finally(() => {
          if (!cancelled && !controller.signal.aborted && withLoader) {
            setLoading(false)
          }
        })
    }

    load({ withLoader: true })
    function handleChanged() {
      load({ withLoader: false })
    }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChanged)
    return () => {
      cancelled = true
      controllers.forEach((controller) => controller.abort())
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChanged)
    }
  }, [page, unreadOnly, retryNonce])

  async function handleMarkRead(notification) {
    if (markingId || !isNotificationUnread(notification)) {
      return
    }
    setMarkingId(notification.id)
    setActionError('')
    try {
      await markNotificationRead(notification.id)
      announceNotificationsChanged()
    } catch (action) {
      setActionError(userFacingNotificationError(action))
    } finally {
      setMarkingId('')
    }
  }

  async function handleMarkAll() {
    if (markingAll) {
      return
    }
    setMarkingAll(true)
    setActionError('')
    try {
      const { updatedCount } = await markAllNotificationsRead()
      announceNotificationsChanged()
      setToast(updatedCount === 0 ? 'No unread notifications to update.' : 'All notifications marked as read.')
    } catch (action) {
      setActionError(userFacingNotificationError(action))
    } finally {
      setMarkingAll(false)
    }
  }

  async function handleOpen(notification) {
    if (openingId) {
      return
    }
    setOpeningId(notification.id)
    setActionError('')
    try {
      if (isNotificationUnread(notification)) {
        await markNotificationRead(notification.id)
        announceNotificationsChanged()
      }
      const target = await resolveNotificationTarget(user?.role, notification)
      if (!target.available) {
        setActionError(target.message)
        return
      }
      navigate(target.path)
    } catch (action) {
      setActionError(userFacingNotificationError(action))
    } finally {
      setOpeningId('')
    }
  }

  return (
    <PageContent
      title="Notifications"
      description="Review application and interview updates stored for this account."
      actions={
        <Button variant="secondary" disabled={markingAll} onClick={handleMarkAll}>
          {markingAll ? 'Updating…' : 'Mark all as read'}
        </Button>
      }
    >
      <div className="mb-6 max-w-xs">
        <SelectInput
          id="notification-filter"
          label="Show"
          value={filter}
          options={FILTER_OPTIONS}
          onChange={(event) => {
            setFilter(event.target.value)
            setPage(1)
          }}
        />
      </div>

      {actionError ? (
        <p className="po-helper po-helper-error mt-0 mb-4" role="alert">
          {actionError}
        </p>
      ) : null}

      <QueryStatus
        loading={loading}
        error={error}
        empty={!loading && !error && result.items.length === 0}
        loadingLabel="Loading notifications…"
        emptyTitle={emptyCopy.title}
        emptyDescription={emptyCopy.description}
        onRetry={() => setRetryNonce((current) => current + 1)}
      >
        <NotificationList
          items={result.items}
          onOpen={handleOpen}
          onMarkRead={handleMarkRead}
          openingId={openingId}
          markingId={markingId}
        />
        <PaginationBar
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          noun="notifications"
          disabled={loading}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      </QueryStatus>

      <Toast message={toast} />
    </PageContent>
  )
}

export default NotificationsPage
