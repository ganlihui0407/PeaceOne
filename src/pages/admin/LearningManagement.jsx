import { useEffect, useState } from 'react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import StatCard from '../../components/cards/StatCard.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import {
  LEARNING_CATEGORIES,
  LEARNING_DIFFICULTIES,
  LEARNING_STATUSES,
  archiveAdminCourse,
  fetchAdminCourseEnrollments,
  fetchAdminCourses,
  fetchAdminLearningStats,
  formatCategory,
  formatCourseStatus,
  formatDifficulty,
  formatEnrollmentStatus,
  publishAdminCourse,
  unpublishAdminCourse,
  userFacingLearningError,
} from '../../api/learning.js'

function statusTone(status) {
  if (status === 'PUBLISHED') return 'active'
  if (status === 'ARCHIVED') return 'default'
  return 'inprogress'
}

function LearningManagement() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState(null)
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [enrollmentsFor, setEnrollmentsFor] = useState(null)
  const [enrollments, setEnrollments] = useState([])
  const [confirmArchive, setConfirmArchive] = useState(null)

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  function load(nextPage = page, filters) {
    const nextQuery = filters?.query ?? query
    const nextCategory = filters?.category ?? category
    const nextDifficulty = filters?.difficulty ?? difficulty
    const nextStatus = filters?.status ?? status
    setLoading(true)
    setError('')
    Promise.all([
      fetchAdminLearningStats(),
      fetchAdminCourses({
        q: nextQuery,
        category: nextCategory,
        difficulty: nextDifficulty,
        status: nextStatus,
        page: nextPage,
        limit: 20,
      }),
    ])
      .then(([nextStats, nextCourses]) => {
        setStats(nextStats)
        setPayload(nextCourses)
      })
      .catch((loadError) => {
        setError(userFacingLearningError(loadError))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  function handleSearch(event) {
    event.preventDefault()
    setPage(1)
    load(1)
  }

  function handleReset() {
    setQuery('')
    setCategory('')
    setDifficulty('')
    setStatus('')
    setPage(1)
    load(1, { query: '', category: '', difficulty: '', status: '' })
  }

  async function changeStatus(course, action) {
    try {
      if (action === 'publish') await publishAdminCourse(course.id)
      if (action === 'unpublish') await unpublishAdminCourse(course.id)
      if (action === 'archive') {
        await archiveAdminCourse(course.id)
        setConfirmArchive(null)
      }
      showToast('Course updated.')
      load()
    } catch (actionError) {
      setError(userFacingLearningError(actionError))
    }
  }

  async function openEnrollments(course) {
    try {
      const next = await fetchAdminCourseEnrollments(course.id)
      setEnrollmentsFor(course)
      setEnrollments(next.enrollments ?? [])
    } catch (enrollError) {
      setError(userFacingLearningError(enrollError))
    }
  }

  const courses = payload?.courses ?? []

  return (
    <PageContent
      title="Learning Content Management"
      description="Create and publish PeaceOne demonstration courses stored in PostgreSQL."
      actions={<Button to="/admin/learning/create">Add course</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Courses" value={String(stats?.courses ?? '—')} />
        <StatCard label="Published" value={String(stats?.published ?? '—')} />
        <StatCard label="Enrolments" value={String(stats?.enrollments ?? '—')} />
        <StatCard label="Completed" value={String(stats?.completed ?? '—')} />
      </div>

      <form className="mt-8 mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleSearch}>
        <SearchInput
          id="admin-learning-search"
          label="Search courses"
          value={query}
          placeholder="Title or slug"
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectInput
          id="admin-learning-category"
          label="Category"
          value={category}
          options={LEARNING_CATEGORIES}
          helperText="Applied when you press Search."
          onChange={(event) => setCategory(event.target.value)}
        />
        <SelectInput
          id="admin-learning-difficulty"
          label="Difficulty"
          value={difficulty}
          options={LEARNING_DIFFICULTIES}
          onChange={(event) => setDifficulty(event.target.value)}
        />
        <SelectInput
          id="admin-learning-status"
          label="Status"
          value={status}
          options={LEARNING_STATUSES}
          onChange={(event) => setStatus(event.target.value)}
        />
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" disabled={loading}>Search</Button>
          <Button type="button" variant="secondary" disabled={loading} onClick={handleReset}>
            Reset filters
          </Button>
        </div>
      </form>
      <p className="po-secondary -mt-2 mb-6">
        Press Search to apply the keyword and filters. Changing a dropdown does not update the list until you search.
      </p>

      <QueryStatus
        loading={loading}
        error={error}
        empty={!loading && !error && courses.length === 0}
        loadingLabel="Loading courses…"
        emptyTitle="No courses match these filters."
        emptyDescription="Create a course or run npm run db:seed:learning."
        onRetry={load}
      >
        <Table
          minWidthClass="min-w-[960px]"
          headers={['Title', 'Category', 'Difficulty', 'Status', 'Enrolments', 'Actions']}
          rows={courses.map((item) => [
            item.title,
            formatCategory(item.category),
            formatDifficulty(item.difficulty),
            <Badge key={`${item.id}-status`} status={statusTone(item.status)} className="normal-case">
              {formatCourseStatus(item.status)}
            </Badge>,
            String(item.enrollmentCount ?? 0),
            <div key={`${item.id}-actions`} className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" to={`/admin/learning/${item.id}/edit`}>
                Edit
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openEnrollments(item)}>
                Enrolments
              </Button>
              {item.status === 'DRAFT' ? (
                <Button size="sm" onClick={() => changeStatus(item, 'publish')}>Publish</Button>
              ) : null}
              {item.status === 'PUBLISHED' ? (
                <Button size="sm" variant="secondary" onClick={() => changeStatus(item, 'unpublish')}>
                  Unpublish
                </Button>
              ) : null}
              {item.status !== 'ARCHIVED' ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirmArchive(item)}>
                  Archive
                </Button>
              ) : null}
            </div>,
          ])}
        />
        {payload ? (
          <PaginationBar
            page={payload.page}
            totalPages={payload.totalPages}
            total={payload.total}
            noun="courses"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        ) : null}
      </QueryStatus>

      <Modal
        open={Boolean(enrollmentsFor)}
        title={enrollmentsFor ? `Enrolments · ${enrollmentsFor.title}` : 'Enrolments'}
        size="lg"
        onClose={() => setEnrollmentsFor(null)}
        footer={
          <Button variant="secondary" onClick={() => setEnrollmentsFor(null)}>
            Close
          </Button>
        }
      >
        {enrollments.length === 0 ? (
          <p className="po-secondary">No enrolments yet.</p>
        ) : (
          <Table
            headers={['Learner', 'Status', 'Progress', 'Enrolled']}
            rows={enrollments.map((item) => [
              `${item.user.fullName} (${item.user.email})`,
              formatEnrollmentStatus(item.status),
              `${item.progressPercent}%`,
              new Date(item.enrolledAt).toLocaleString(),
            ])}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(confirmArchive)}
        title="Archive this course?"
        onClose={() => setConfirmArchive(null)}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmArchive(null)}>Cancel</Button>
            <Button onClick={() => changeStatus(confirmArchive, 'archive')}>Archive</Button>
          </div>
        }
      >
        <p className="po-secondary">
          Archived courses leave the student catalogue. Existing enrolments are kept. This is saved to the database.
        </p>
      </Modal>
      <Toast message={toast} />
    </PageContent>
  )
}

export default LearningManagement
