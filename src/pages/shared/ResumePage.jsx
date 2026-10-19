import { useRef, useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import { mockExtractedSkills, mockResumes } from '../../data/resumes.js'

function ResumePage({ role = 'student' }) {
  const inputRef = useRef(null)
  const seed = mockResumes[role] || mockResumes.student
  const [resume, setResume] = useState(seed)
  const [extracted, setExtracted] = useState(mockExtractedSkills.map((name) => ({ name, added: false })))
  const [toast, setToast] = useState('')

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setResume({
      fileName: file.name,
      uploadedAt: '21 August 2026',
      processingStatus: 'Processed',
      isPrimary: true,
    })
    showToast('Resume uploaded successfully.')
    event.target.value = ''
  }

  function handlePreview() {
    showToast('Resume preview is not available yet.')
  }

  function handlePrimary() {
    setResume((current) => (current ? { ...current, isPrimary: true } : current))
    showToast('Primary resume updated.')
  }

  function handleRemoveResume() {
    setResume(null)
    showToast('Resume removed.')
  }

  function handleRemoveSkill(name) {
    setExtracted((current) => current.filter((skill) => skill.name !== name))
  }

  function handleKeepSkill(name) {
    showToast(`${name} kept in the list.`)
  }

  function handleAddToProfile(name) {
    setExtracted((current) =>
      current.map((skill) => (skill.name === name ? { ...skill, added: true } : skill)),
    )
    showToast(`${name} added to your skill profile.`)
  }

  return (
    <PageContent
      title="My Resume"
      description="Upload and manage resumes used for your PeaceOne career profile."
    >
      <Card>
        <h2 className="po-section-title">Upload resume</h2>
        <p className="po-secondary mt-2">PDF or DOCX. Maximum 5 MB.</p>
        <button
          type="button"
          className="mt-5 flex w-full flex-col items-center rounded-xl border border-dashed border-line bg-page px-6 py-10 text-center transition-colors duration-150 hover:border-primary/40 hover:bg-soft/60"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files?.[0]
            if (!file) {
              return
            }
            setResume({
              fileName: file.name,
              uploadedAt: '21 August 2026',
              processingStatus: 'Processed',
              isPrimary: true,
            })
            showToast('Resume uploaded successfully.')
          }}
        >
          <Upload size={22} className="text-primary" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-ink">Click to choose a file</p>
          <p className="po-helper mt-1">PDF or DOCX · Maximum 5 MB</p>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf"
          className="sr-only"
          aria-label="Choose resume file"
          onChange={handleFileChange}
        />
      </Card>

      <div className="mt-6">
        {resume ? (
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-soft text-primary">
                  <FileText size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="po-card-title">{resume.fileName}</h2>
                  <dl className="po-secondary mt-3 space-y-1">
                    <div>
                      <dt className="inline">Uploaded: </dt>
                      <dd className="inline text-ink">{resume.uploadedAt}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <dt>Status:</dt>
                      <dd>
                        <Badge status="processed" className="normal-case">
                          {resume.processingStatus}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Primary Resume: </dt>
                      <dd className="inline text-ink">{resume.isPrimary ? 'Yes' : 'No'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={handlePreview}>
                  Preview
                </Button>
                <Button size="sm" variant="secondary" onClick={handlePrimary}>
                  Set as Primary
                </Button>
                <Button size="sm" variant="ghost" onClick={handleRemoveResume}>
                  Remove
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="po-secondary">No resume is currently attached.</p>
          </Card>
        )}
      </div>

      <Card className="mt-6">
        <h2 className="po-section-title">Skills Identified from Resume</h2>
        <p className="po-secondary mt-2">Review the skills identified from your resume and add them to your profile.</p>
        <ul className="mt-5 divide-y divide-line">
          {extracted.length === 0 ? (
            <li className="py-3">
              <p className="po-secondary">No sample extracted skills are currently listed.</p>
            </li>
          ) : (
            extracted.map((skill) => (
              <li key={skill.name} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink">{skill.name}</p>
                  {skill.added ? (
                    <Badge tone="success" className="normal-case">
                      Added
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleKeepSkill(skill.name)}>
                    Keep
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveSkill(skill.name)}>
                    Remove
                  </Button>
                  <Button
                    size="sm"
                    disabled={skill.added}
                    onClick={() => handleAddToProfile(skill.name)}
                  >
                    Add to profile
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </Card>

      <Toast message={toast} />
    </PageContent>
  )
}

export default ResumePage
