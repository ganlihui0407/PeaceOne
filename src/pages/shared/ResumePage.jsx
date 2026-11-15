import { useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import {
  MAX_RESUMES_PER_USER,
  RESUME_EMPTY,
  RESUME_FILE_ACCEPT,
  RESUME_FILE_TYPES_COPY,
  RESUME_LIMIT_COPY,
  RESUME_TITLE_MAX,
  formatResumeFileSize,
  formatResumeUpdatedAt,
  resumeEditorPath,
} from '../../api/resumes.js'
import { useResumeList } from '../../hooks/useResumeList.js'

function ResumePage({ basePath }) {
  const {
    items,
    loading,
    error,
    busy,
    actionError,
    atLimit,
    retry,
    create,
    setPrimary,
    remove,
    uploadFile,
    downloadFile,
    removeFile,
    setActionError,
  } = useResumeList()
  const fileInputRef = useRef(null)
  const [toast, setToast] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createFieldError, setCreateFieldError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingRemoveFile, setPendingRemoveFile] = useState(null)
  const [uploadTargetId, setUploadTargetId] = useState(null)

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  function openCreate() {
    if (atLimit || busy || loading) {
      return
    }
    setCreateTitle('')
    setCreateFieldError('')
    setActionError('')
    setCreateOpen(true)
  }

  function closeCreate() {
    if (busy) {
      return
    }
    setCreateOpen(false)
    setCreateTitle('')
    setCreateFieldError('')
  }

  async function handleCreate(event) {
    event.preventDefault()
    const title = createTitle.trim()
    if (!title) {
      setCreateFieldError('Enter a resume title.')
      return
    }
    if (title.length > RESUME_TITLE_MAX) {
      setCreateFieldError(`Title must be ${RESUME_TITLE_MAX} characters or fewer.`)
      return
    }
    setCreateFieldError('')
    const created = await create(title)
    if (created) {
      setCreateOpen(false)
      setCreateTitle('')
      showToast('Resume created.')
    }
  }

  async function handlePrimary(id) {
    const updated = await setPrimary(id)
    if (updated) {
      showToast('Primary resume updated.')
    }
  }

  async function handleDelete() {
    if (!pendingDelete) {
      return
    }
    const deleted = await remove(pendingDelete.id)
    if (deleted) {
      setPendingDelete(null)
      showToast('Resume deleted.')
    }
  }

  function openFilePicker(id) {
    if (busy || loading) {
      return
    }
    setActionError('')
    setUploadTargetId(id)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    const resumeId = uploadTargetId
    event.target.value = ''
    if (!file || !resumeId) {
      return
    }
    const uploaded = await uploadFile(resumeId, file)
    if (uploaded?.unchanged) {
      showToast('This file is already uploaded.')
    } else if (uploaded) {
      showToast('Resume file uploaded.')
    }
  }

  async function handleDownload(id) {
    const downloaded = await downloadFile(id)
    if (downloaded) {
      showToast('Uploaded file downloaded.')
    }
  }

  async function handleRemoveFile() {
    if (!pendingRemoveFile) {
      return
    }
    const removed = await removeFile(pendingRemoveFile.id)
    if (removed) {
      setPendingRemoveFile(null)
      showToast('Uploaded file removed.')
    }
  }

  return (
    <PageContent
      title="My Resume"
      description="Create and manage resumes saved to your PeaceOne account. Uploaded files and generated PDFs are stored separately. Open a resume to choose a template and download a generated PDF."
      actions={
        <Button onClick={openCreate} disabled={loading || busy || atLimit}>
          Create Resume
        </Button>
      }
    >
      {atLimit ? <p className="po-helper mt-0 mb-4">{RESUME_LIMIT_COPY}</p> : null}
      {actionError ? <p className="po-helper mt-0 mb-4 text-danger">{actionError}</p> : null}

      <QueryStatus
        loading={loading}
        error={error}
        empty={items.length === 0}
        loadingLabel="Loading your resumes…"
        emptyTitle={RESUME_EMPTY.title}
        emptyDescription={RESUME_EMPTY.description}
        emptyAction={
          <Button onClick={openCreate} disabled={busy}>
            Create Resume
          </Button>
        }
        onRetry={retry}
      >
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-soft text-primary">
                    <FileText size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="po-card-title">{item.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {item.isPrimary ? (
                        <Badge tone="success" className="normal-case">
                          Primary
                        </Badge>
                      ) : (
                        <Badge className="normal-case">Not primary</Badge>
                      )}
                    </div>
                    <p className="po-secondary mt-2">
                      Last updated: {formatResumeUpdatedAt(item.updatedAt)}
                    </p>
                    <p className="po-secondary mt-2">
                      {item.file
                        ? `Uploaded file: ${item.file.originalFilename} (${formatResumeFileSize(item.file.byteSize)})`
                        : 'No resume file uploaded.'}
                    </p>
                    <div className="mt-2">
                      {item.file ? (
                        <Badge tone="success" className="normal-case">
                          File uploaded
                        </Badge>
                      ) : (
                        <Badge className="normal-case">No file</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" to={resumeEditorPath(basePath, item.id)} disabled={busy}>
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    to={`${resumeEditorPath(basePath, item.id)}?identify=1`}
                    disabled={busy || !item.file}
                  >
                    Identify skills
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => openFilePicker(item.id)}>
                    {item.file ? 'Replace resume file' : 'Upload resume'}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy || !item.file} onClick={() => handleDownload(item.id)}>
                    Download uploaded file
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || !item.file}
                    onClick={() => {
                      setActionError('')
                      setPendingRemoveFile(item)
                    }}
                  >
                    Remove resume file
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || item.isPrimary}
                    onClick={() => handlePrimary(item.id)}
                  >
                    Set as Primary
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setActionError('')
                      setPendingDelete(item)
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </QueryStatus>

      <Modal
        open={createOpen}
        title="Create Resume"
        onClose={closeCreate}
        footer={
          <>
            <Button variant="secondary" onClick={closeCreate} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="create-resume-form" disabled={busy}>
              Create Resume
            </Button>
          </>
        }
      >
        <form id="create-resume-form" onSubmit={handleCreate}>
          <TextInput
            id="resume-title"
            label="Resume title"
            required
            value={createTitle}
            error={createFieldError}
            disabled={busy}
            maxLength={RESUME_TITLE_MAX}
            onChange={(event) => setCreateTitle(event.target.value)}
          />
          <p className="po-helper mt-3">
            You can save up to {MAX_RESUMES_PER_USER} resumes. Contact details are copied from your profile.
          </p>
        </form>
      </Modal>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={RESUME_FILE_ACCEPT}
        onChange={handleFileSelected}
      />

      <Modal
        open={Boolean(pendingRemoveFile)}
        title="Remove resume file"
        onClose={() => {
          if (!busy) {
            setPendingRemoveFile(null)
          }
        }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingRemoveFile(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRemoveFile} disabled={busy}>
              Remove file
            </Button>
          </>
        }
      >
        {pendingRemoveFile ? (
          <p className="po-body">
            Remove the uploaded file from “{pendingRemoveFile.title}”? The structured resume is kept. {RESUME_FILE_TYPES_COPY}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(pendingDelete)}
        title="Delete resume"
        onClose={() => {
          if (!busy) {
            setPendingDelete(null)
          }
        }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={busy}>
              Delete
            </Button>
          </>
        }
      >
        {pendingDelete ? (
          <p className="po-body">
            Delete “{pendingDelete.title}”? This removes the saved resume from your account. Recorded skills are not
            deleted.
          </p>
        ) : null}
      </Modal>

      <Toast message={toast} />
    </PageContent>
  )
}

export default ResumePage
