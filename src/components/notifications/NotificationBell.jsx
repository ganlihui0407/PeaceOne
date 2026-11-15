import { useEffect, useId, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../common/Button.jsx'
import EmptyState from '../common/EmptyState.jsx'
import { useAuth } from '../../auth/useAuth.js'
import { isAbortError } from '../../api/esco.js'
import {
  NOTIFICATION_DROPDOWN_LIMIT,
  NOTIFICATION_EMPTY,
  NOTIFICATIONS_CHANGED_EVENT,
  announceNotificationsChanged,
  fetchNotifications,
  fetchUnreadNotificationCount,
  formatUnreadBadge,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
  userFacingNotificationError,
} from '../../api/notifications.js'
import NotificationList from './NotificationList.jsx'

function NotificationBell({ centreTo }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const panelId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [openingId, setOpeningId] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  const badge = formatUnreadBadge(unreadCount)
  const label = badge
    ? `Notifications, ${unreadCount > 99 ? '99+' : unreadCount} unread`
    : 'Notifications, no unread'

  useEffect(() => {
    const controller = new AbortController()

    function loadCount() {
      fetchUnreadNotificationCount({ signal: controller.signal })
        .then((result) => {
          if (!controller.signal.aborted) {
            setUnreadCount(result.unreadCount)
          }
        })
        .catch((loadError) => {
          if (isAbortError(loadError) || controller.signal.aborted) {
            return
          }
          setUnreadCount(0)
        })
    }

    loadCount()

    function handleChanged() {
      loadCount()
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        loadCount()
      }
    }

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChanged)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      controller.abort()
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChanged)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return undefined
    }
    let cancelled = false
    const controllers = []

    function load({ withLoader }) {
      const controller = new AbortController()
      controllers.push(controller)
      if (withLoader) {
        setLoading(true)
        setError('')
        setActionError('')
      }
      fetchNotifications({ page: 1, limit: NOTIFICATION_DROPDOWN_LIMIT, signal: controller.signal })
        .then((result) => {
          if (!cancelled && !controller.signal.aborted) {
            setItems(result.items)
            setError('')
          }
        })
        .catch((loadError) => {
          if (isAbortError(loadError) || cancelled || controller.signal.aborted) {
            return
          }
          setItems([])
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
  }, [open, retryNonce])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    function handlePointer(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleKey(event) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  async function refreshCount() {
    try {
      const result = await fetchUnreadNotificationCount()
      setUnreadCount(result.unreadCount)
    } catch (loadError) {
      if (!isAbortError(loadError)) {
        setUnreadCount(0)
      }
    }
  }

  async function handleMarkAll() {
    if (markingAll) {
      return
    }
    setMarkingAll(true)
    setActionError('')
    try {
      await markAllNotificationsRead()
      setItems((current) => current.map((item) => (
        item.readAt ? item : { ...item, readAt: new Date().toISOString() }
      )))
      announceNotificationsChanged()
      await refreshCount()
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
      if (!notification.readAt) {
        const updated = await markNotificationRead(notification.id)
        setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)))
        announceNotificationsChanged()
        await refreshCount()
      }
      const target = await resolveNotificationTarget(user?.role, notification)
      if (!target.available) {
        setActionError(target.message)
        return
      }
      setOpen(false)
      navigate(target.path)
    } catch (action) {
      setActionError(userFacingNotificationError(action))
    } finally {
      setOpeningId('')
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-page hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => {
            const next = !current
            if (next) {
              setLoading(true)
              setError('')
              setActionError('')
            }
            return next
          })
        }}
      >
        <Bell size={18} aria-hidden="true" />
        {badge ? (
          <span className="absolute -top-0.5 -right-0.5 inline-flex min-h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Recent notifications"
          className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-lift)]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">Notifications</p>
            <Button size="sm" variant="ghost" disabled={markingAll || unreadCount === 0} onClick={handleMarkAll}>
              {markingAll ? 'Updating…' : 'Mark all as read'}
            </Button>
          </div>

          {actionError ? (
            <p className="po-helper po-helper-error mt-0 mb-3" role="alert">
              {actionError}
            </p>
          ) : null}

          {loading ? (
            <p className="po-secondary px-2 py-6 text-center" role="status">
              Loading notifications…
            </p>
          ) : error ? (
            <EmptyState
              title="Unable to load data"
              description={error}
              action={
                <Button variant="secondary" size="sm" onClick={() => setRetryNonce((current) => current + 1)}>
                  Retry
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState title={NOTIFICATION_EMPTY.title} description={NOTIFICATION_EMPTY.description} />
          ) : (
            <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
              <NotificationList items={items} compact onOpen={handleOpen} openingId={openingId} />
            </div>
          )}

          {centreTo ? (
            <div className="mt-3 border-t border-line pt-3">
              <Link
                to={centreTo}
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                View all notifications
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default NotificationBell
