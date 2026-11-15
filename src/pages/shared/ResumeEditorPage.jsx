import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import Modal from '../../components/common/Modal.jsx'
import PaginationBar from '../../components/common/PaginationBar.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Toast from '../../components/common/Toast.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import Checkbox from '../../components/forms/Checkbox.jsx'
import DateInput from '../../components/forms/DateInput.jsx'
import SearchInput from '../../components/forms/SearchInput.jsx'
import SelectInput from '../../components/forms/SelectInput.jsx'
import TextArea from '../../components/forms/TextArea.jsx'
import TextInput from '../../components/forms/TextInput.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import { fetchSkills, formatSkillType, skillTypeTone } from '../../api/esco.js'
import {
  RESUME_CERT_STORAGE_COPY,
  RESUME_FIELD_LIMITS,
  RESUME_FILE_ACCEPT,
  RESUME_FILE_TYPES_COPY,
  RESUME_SECTION_LIMITS,
  RESUME_SKILL_PROFICIENCY_LEVELS,
  RESUME_YEAR_MAX,
  RESUME_YEAR_MIN,
  formatResumeFileSize,
} from '../../api/resumes.js'
import { canAddSection } from '../../api/resumeForm.js'
import ResumePreview from '../../components/resume/ResumePreview.jsx'
import ResumeSkillReview from '../../components/resume/ResumeSkillReview.jsx'
import ResumeTemplatePicker from '../../components/resume/ResumeTemplatePicker.jsx'
import { useEscoPagedSearch } from '../../hooks/useEscoPagedSearch.js'
import { useResumeEditor } from '../../hooks/useResumeEditor.js'
import { useResumeExtraction } from '../../hooks/useResumeExtraction.js'

const PROFICIENCY_OPTIONS = [
  { value: '', label: 'No proficiency' },
  ...RESUME_SKILL_PROFICIENCY_LEVELS.map((value) => ({ value, label: value })),
]

function rowError(errors, key, field) {
  return errors?.[key]?.[field] || ''
}

function ReorderActions({ index, total, disabled, onMove, onRemove }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={disabled || index === 0} onClick={() => onMove(-1)}>
        Move up
      </Button>
      <Button size="sm" variant="secondary" disabled={disabled || index === total - 1} onClick={() => onMove(1)}>
        Move down
      </Button>
      <Button size="sm" variant="ghost" disabled={disabled} onClick={onRemove}>
        Remove
      </Button>
    </div>
  )
}

function ResumeEditorPage({ basePath }) {
  const { resumeId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const editor = useResumeEditor(resumeId)
  const extraction = useResumeExtraction(resumeId, editor.resume?.file?.sha256)
  const catalogue = useEscoPagedSearch(fetchSkills)
  const fileInputRef = useRef(null)
  const [customLabel, setCustomLabel] = useState('')
  const [customLevel, setCustomLevel] = useState('')
  const [pendingRemoveFile, setPendingRemoveFile] = useState(false)
  const [autoIdentify, setAutoIdentify] = useState(searchParams.get('identify') === '1')
  const form = editor.form
  const errors = editor.fieldErrors
  const disabled = editor.saving
  const fileDisabled = editor.saving || editor.fileBusy

  function openFilePicker() {
    if (fileDisabled) {
      return
    }
    editor.setFileError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    await editor.uploadDocument(file)
  }

  async function handleRemoveFile() {
    const removed = await editor.removeDocument()
    if (removed) {
      setPendingRemoveFile(false)
    }
  }

  useEffect(() => {
    if (!autoIdentify || editor.loading || !editor.resume?.file || extraction.busy || extraction.extraction) {
      return undefined
    }
    setAutoIdentify(false)
    const next = new URLSearchParams(searchParams)
    next.delete('identify')
    setSearchParams(next, { replace: true })
    void extraction.identify()
    return undefined
  }, [
    autoIdentify,
    editor.loading,
    editor.resume?.file,
    extraction.busy,
    extraction.extraction,
    extraction.identify,
    searchParams,
    setSearchParams,
  ])

  function goBack() {
    if (editor.confirmLeave()) {
      navigate(`${basePath}/resume`)
    }
  }

  function handleSave() {
    void editor.save()
  }

  function handleAddCustom(event) {
    event.preventDefault()
    if (editor.addCustomSkill(customLabel, customLevel)) {
      setCustomLabel('')
      setCustomLevel('')
    }
  }

  return (
    <PageContent
      title="Edit Resume"
      description="Update the saved resume. Preview uses the current editor. The downloaded PDF uses the last saved version."
      actions={
        <>
          <Button variant="secondary" onClick={goBack} disabled={editor.saving}>
            Back
          </Button>
          <Button
            variant="secondary"
            onClick={() => void editor.downloadPdf()}
            disabled={editor.loading || editor.pdfBusy || editor.fileBusy || !form}
          >
            {editor.pdfBusy ? 'Generating PDF…' : 'Download PDF'}
          </Button>
          <Button onClick={handleSave} disabled={editor.loading || editor.saving || !form}>
            {editor.saving ? 'Saving…' : 'Save Resume'}
          </Button>
        </>
      }
    >
      {editor.saveError ? (
        <p className="po-helper mt-0 mb-4 text-danger" role="alert">
          {editor.saveError}
        </p>
      ) : null}
      {editor.pdfError ? (
        <p className="po-helper mt-0 mb-4 text-danger" role="alert">
          {editor.pdfError}
        </p>
      ) : null}
      {editor.dirty && !editor.saving ? <p className="po-helper mt-0 mb-4">You have unsaved changes.</p> : null}

      <QueryStatus
        loading={editor.loading}
        error={editor.loadError}
        empty={!form}
        loadingLabel="Loading resume…"
        emptyTitle="This resume is not available."
        emptyDescription="Open a resume from My Resume, or create a new one."
        onRetry={editor.retry}
      >
        {form ? (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-start lg:gap-6">
            <div className="space-y-8">
            <Card>
              <SectionHeader
                title="Resume template"
                description="Switch layouts without changing education, experience, skills or certifications."
              />
              <ResumeTemplatePicker
                value={form.templateKey}
                disabled={disabled || editor.pdfBusy}
                onChange={(templateKey) => void editor.persistTemplate(templateKey)}
              />
            </Card>
            <Card>
              <SectionHeader title="Personal information" description="Contact details printed on this resume." />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  id="resume-full-name"
                  label="Full name"
                  required
                  value={form.fullName}
                  error={errors.fullName}
                  disabled={disabled}
                  maxLength={RESUME_FIELD_LIMITS.fullName}
                  onChange={(event) => editor.setField('fullName', event.target.value)}
                />
                <TextInput
                  id="resume-email"
                  label="Email"
                  type="email"
                  required
                  value={form.email}
                  error={errors.email}
                  disabled={disabled}
                  maxLength={RESUME_FIELD_LIMITS.email}
                  onChange={(event) => editor.setField('email', event.target.value)}
                />
                <TextInput
                  id="resume-phone"
                  label="Phone"
                  value={form.phone}
                  error={errors.phone}
                  disabled={disabled}
                  maxLength={RESUME_FIELD_LIMITS.phone}
                  onChange={(event) => editor.setField('phone', event.target.value)}
                />
                <TextInput
                  id="resume-location"
                  label="Location"
                  value={form.location}
                  error={errors.location}
                  disabled={disabled}
                  maxLength={RESUME_FIELD_LIMITS.location}
                  onChange={(event) => editor.setField('location', event.target.value)}
                />
              </div>
            </Card>

            <Card>
              <SectionHeader
                title="Resume Document"
                description={`Original uploaded PDF or DOCX, separate from Download PDF. ${RESUME_FILE_TYPES_COPY}`}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={RESUME_FILE_ACCEPT}
                onChange={handleFileSelected}
              />
              {editor.fileError ? (
                <p className="po-helper mt-0 mb-3 text-danger" role="alert">
                  {editor.fileError}
                </p>
              ) : null}
              {editor.fileSuccess ? <p className="po-helper mt-0 mb-3">{editor.fileSuccess}</p> : null}
              {editor.fileBusy ? (
                <p className="po-helper mt-0 mb-3">
                  {editor.uploadProgress == null ? 'Uploading…' : `Uploading… ${editor.uploadProgress}%`}
                </p>
              ) : null}
              {editor.resume?.file ? (
                <div className="mb-4">
                  <p className="po-body">
                    {editor.resume.file.originalFilename} ({formatResumeFileSize(editor.resume.file.byteSize)})
                  </p>
                  <div className="mt-2">
                    <Badge tone="success" className="normal-case">
                      File uploaded
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="po-secondary mb-4">No resume file uploaded.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={fileDisabled} onClick={openFilePicker}>
                  {editor.resume?.file ? 'Replace' : 'Upload'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={fileDisabled || !editor.resume?.file}
                  onClick={() => editor.downloadDocument()}
                >
                  Download uploaded file
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={fileDisabled || !editor.resume?.file}
                  onClick={() => setPendingRemoveFile(true)}
                >
                  Remove
                </Button>
                {editor.fileError ? (
                  <Button size="sm" variant="secondary" disabled={fileDisabled} onClick={openFilePicker}>
                    Try again
                  </Button>
                ) : null}
              </div>
            </Card>

            <ResumeSkillReview
              hasFile={Boolean(editor.resume?.file)}
              disabled={fileDisabled}
              extractionState={extraction}
              onConfirmed={() => editor.reloadSavedSkills()}
            />

            <Card>
              <SectionHeader title="Professional summary" />
              <div className="grid gap-4">
                <TextInput
                  id="resume-title"
                  label="Resume title"
                  required
                  value={form.title}
                  error={errors.title}
                  disabled={disabled}
                  maxLength={RESUME_FIELD_LIMITS.title}
                  onChange={(event) => editor.setField('title', event.target.value)}
                />
                <TextArea
                  id="resume-summary"
                  label="Summary"
                  rows={5}
                  value={form.summary}
                  error={errors.summary}
                  disabled={disabled}
                  maxLength={RESUME_FIELD_LIMITS.summary}
                  onChange={(event) => editor.setField('summary', event.target.value)}
                />
              </div>
            </Card>

            <Card>
              <SectionHeader
                title="Education"
                description="Add institutions in the order they should appear."
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={disabled || !canAddSection(form, 'education')}
                    onClick={() => editor.addItem('education')}
                  >
                    Add education
                  </Button>
                }
              />
              {errors.educationLimit ? <p className="po-helper po-helper-error">{errors.educationLimit}</p> : null}
              {form.education.length === 0 ? (
                <p className="po-secondary">No education entries yet.</p>
              ) : (
                <div className="space-y-4">
                  {form.education.map((item, index) => (
                    <div key={item.key} className="rounded-xl border border-line p-4">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="po-card-title">Education {index + 1}</h3>
                        <ReorderActions
                          index={index}
                          total={form.education.length}
                          disabled={disabled}
                          onMove={(offset) => editor.moveItem('education', item.key, offset)}
                          onRemove={() => editor.removeItem('education', item.key)}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput
                          id={`edu-institution-${item.key}`}
                          label="Institution"
                          required
                          value={item.institution}
                          error={rowError(errors.education, item.key, 'institution')}
                          disabled={disabled}
                          maxLength={RESUME_FIELD_LIMITS.institution}
                          onChange={(event) => editor.updateItem('education', item.key, { institution: event.target.value })}
                        />
                        <TextInput
                          id={`edu-qualification-${item.key}`}
                          label="Qualification"
                          value={item.qualification}
                          error={rowError(errors.education, item.key, 'qualification')}
                          disabled={disabled}
                          maxLength={RESUME_FIELD_LIMITS.qualification}
                          onChange={(event) =>
                            editor.updateItem('education', item.key, { qualification: event.target.value })
                          }
                        />
                        <TextInput
                          id={`edu-field-${item.key}`}
                          label="Field of study"
                          value={item.fieldOfStudy}
                          error={rowError(errors.education, item.key, 'fieldOfStudy')}
                          disabled={disabled}
                          maxLength={RESUME_FIELD_LIMITS.fieldOfStudy}
                          onChange={(event) =>
                            editor.updateItem('education', item.key, { fieldOfStudy: event.target.value })
                          }
                        />
                        <TextInput
                          id={`edu-start-${item.key}`}
                          label="Start year"
                          type="number"
                          min={RESUME_YEAR_MIN}
                          max={RESUME_YEAR_MAX}
                          value={item.startYear}
                          error={rowError(errors.education, item.key, 'startYear')}
                          disabled={disabled}
                          onChange={(event) => editor.updateItem('education', item.key, { startYear: event.target.value })}
                        />
                        <TextInput
                          id={`edu-end-${item.key}`}
                          label="End year"
                          type="number"
                          min={RESUME_YEAR_MIN}
                          max={RESUME_YEAR_MAX}
                          value={item.endYear}
                          error={rowError(errors.education, item.key, 'endYear')}
                          disabled={disabled}
                          onChange={(event) => editor.updateItem('education', item.key, { endYear: event.target.value })}
                        />
                      </div>
                      <div className="mt-4">
                        <TextArea
                          id={`edu-notes-${item.key}`}
                          label="Description"
                          rows={3}
                          value={item.notes}
                          error={rowError(errors.education, item.key, 'notes')}
                          disabled={disabled}
                          maxLength={RESUME_FIELD_LIMITS.notes}
                          onChange={(event) => editor.updateItem('education', item.key, { notes: event.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <SectionHeader
                title="Work experience"
                description="Add roles in the order they should appear."
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={disabled || !canAddSection(form, 'experience')}
                    onClick={() => editor.addItem('experience')}
                  >
                    Add experience
                  </Button>
                }
              />
              {errors.experienceLimit ? <p className="po-helper po-helper-error">{errors.experienceLimit}</p> : null}
              {form.experience.length === 0 ? (
                <p className="po-secondary">No work experience entries yet.</p>
              ) : (
                <div className="space-y-4">
                  {form.experience.map((item, index) => (
                    <div key={item.key} className="rounded-xl border border-line p-4">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="po-card-title">Experience {index + 1}</h3>
                        <ReorderActions
                          index={index}
                          total={form.experience.length}
                          disabled={disabled}
                          onMove={(offset) => editor.moveItem('experience', item.key, offset)}
                          onRemove={() => editor.removeItem('experience', item.key)}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput
                          id={`exp-title-${item.key}`}
                          label="Job title"
                          required
                          value={item.jobTitle}
                          error={rowError(errors.experience, item.key, 'jobTitle')}
                          disabled={disabled}
                          maxLength={RESUME_FIELD_LIMITS.jobTitle}
                          onChange={(event) => editor.updateItem('experience', item.key, { jobTitle: event.target.value })}
                        />
                        <TextInput
                          id={`exp-company-${item.key}`}
                          label="Company"
                          required
                          value={item.organization}
                          error={rowError(errors.experience, item.key, 'organization')}
                          disabled={disabled}
                          maxLength={RESUME_FIELD_LIMITS.organization}
                          onChange={(event) =>
                            editor.updateItem('experience', item.key, { organization: event.target.value })
                          }
                        />
                        <TextInput
                          id={`exp-location-${item.key}`}
                          label="Location"
                          value={item.location}
                          error={rowError(errors.experience, item.key, 'location')}
                          disabled={disabled}
                          maxLength={RESUME_FIELD_LIMITS.location}
                          onChange={(event) => editor.updateItem('experience', item.key, { location: event.target.value })}
                        />
                        <DateInput
                          id={`exp-start-${item.key}`}
                          label="Start date"
                          value={item.startDate}
                          error={rowError(errors.experience, item.key, 'startDate')}
                          disabled={disabled}
                          onChange={(event) => editor.updateItem('experience', item.key, { startDate: event.target.value })}
                        />
                        <DateInput
                          id={`exp-end-${item.key}`}
                          label="End date"
                          value={item.isCurrent ? '' : item.endDate}
                          error={rowError(errors.experience, item.key, 'endDate')}
                          disabled={disabled || item.isCurrent}
                          onChange={(event) => editor.updateItem('experience', item.key, { endDate: event.target.value })}
                        />
                        <div className="flex items-end">
                          <Checkbox
                            id={`exp-current-${item.key}`}
                            label="Currently working"
                            checked={item.isCurrent}
                            disabled={disabled}
                            onChange={(event) =>
                              editor.updateItem('experience', item.key, {
                                isCurrent: event.target.checked,
                                endDate: event.target.checked ? '' : item.endDate,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <TextArea
                          id={`exp-description-${item.key}`}
                          label="Description"
                          rows={3}
                          value={item.description}
                          error={rowError(errors.experience, item.key, 'description')}
                          disabled={disabled}
                          maxLength={RESUME_FIELD_LIMITS.description}
                          onChange={(event) =>
                            editor.updateItem('experience', item.key, { description: event.target.value })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <SectionHeader
                title="Skills"
                description="Custom skills stay on this resume only. Recorded ESCO skills are copied as a snapshot and are not changed in My Skills."
              />
              {errors.skillsLimit ? <p className="po-helper po-helper-error">{errors.skillsLimit}</p> : null}
              {editor.skillNotice ? <p className="po-helper mb-4">{editor.skillNotice}</p> : null}

              <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]" onSubmit={handleAddCustom}>
                <TextInput
                  id="resume-custom-skill"
                  label="Custom skill"
                  value={customLabel}
                  disabled={disabled || !canAddSection(form, 'skills')}
                  maxLength={RESUME_FIELD_LIMITS.skillLabel}
                  onChange={(event) => setCustomLabel(event.target.value)}
                />
                <SelectInput
                  id="resume-custom-level"
                  label="Proficiency"
                  value={customLevel}
                  disabled={disabled}
                  options={PROFICIENCY_OPTIONS}
                  onChange={(event) => setCustomLevel(event.target.value)}
                />
                <div className="flex items-end">
                  <Button type="submit" variant="secondary" disabled={disabled || !canAddSection(form, 'skills')}>
                    Add skill
                  </Button>
                </div>
              </form>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled || editor.savedSkillsLoading || editor.availableSavedSkills.length === 0}
                  onClick={() => editor.importSavedSkills()}
                >
                  Import saved ESCO skills
                </Button>
                <p className="po-helper mt-0">
                  {editor.savedSkillsLoading
                    ? 'Loading recorded skills…'
                    : editor.savedSkillsError
                      ? editor.savedSkillsError
                      : `${editor.availableSavedSkills.length} recorded skill${
                          editor.availableSavedSkills.length === 1 ? '' : 's'
                        } available to copy.`}
                </p>
              </div>

              <div className="mt-6">
                <SectionHeader
                  title="ESCO skill catalogue"
                  description="Search official skills and copy a printed label onto this resume."
                />
                <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={catalogue.search}>
                  <SearchInput
                    id="resume-skill-catalogue-search"
                    label="Search skills"
                    value={catalogue.input}
                    onChange={(event) => catalogue.setInput(event.target.value)}
                    placeholder="ICT safety"
                  />
                  <div className="flex items-end">
                    <Button type="submit" className="w-full md:w-auto" disabled={catalogue.loading}>
                      Search
                    </Button>
                  </div>
                </form>
                <div className="mt-4">
                  <QueryStatus
                    loading={catalogue.loading}
                    error={catalogue.error}
                    empty={catalogue.items.length === 0}
                    loadingLabel="Loading skills…"
                    emptyTitle="No skills match this search yet."
                    emptyDescription="Try a different skill name, or clear the search to browse the catalogue."
                    onRetry={catalogue.retry}
                  >
                    <Table
                      minWidthClass="min-w-[640px]"
                      headers={['Skill', 'Skill type', 'Source', 'Actions']}
                      rows={catalogue.items.map((skill) => [
                        skill.preferredLabel,
                        <Badge key={`${skill.id}-type`} tone={skillTypeTone(skill.skillType)} className="normal-case">
                          {formatSkillType(skill.skillType)}
                        </Badge>,
                        skill.sourceSystem || 'ESCO',
                        <Button
                          key={`${skill.id}-add`}
                          size="sm"
                          variant="secondary"
                          disabled={disabled || !canAddSection(form, 'skills')}
                          onClick={() => editor.addCatalogueSkill(skill)}
                        >
                          Add to resume
                        </Button>,
                      ])}
                    />
                    <PaginationBar
                      page={catalogue.meta.page}
                      totalPages={catalogue.meta.totalPages}
                      total={catalogue.meta.total}
                      noun="skills"
                      disabled={catalogue.loading}
                      onPrevious={() => catalogue.goToPage(catalogue.page - 1)}
                      onNext={() => catalogue.goToPage(catalogue.page + 1)}
                    />
                  </QueryStatus>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="po-card-title mb-3">Skills on this resume</h3>
                {form.skills.length === 0 ? (
                  <p className="po-secondary">No skills on this resume yet.</p>
                ) : (
                  <div className="space-y-3">
                    {form.skills.map((item) => (
                      <div key={item.key} className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="po-body font-medium">{item.label || 'Untitled skill'}</p>
                          <p className="po-helper mt-1">
                            {item.skillId ? 'ESCO snapshot' : 'Custom skill'}
                            {item.proficiencyLevel ? ` · ${item.proficiencyLevel}` : ''}
                          </p>
                          {rowError(errors.skills, item.key, 'label') || rowError(errors.skills, item.key, 'skillId') ? (
                            <p className="po-helper po-helper-error mt-1">
                              {rowError(errors.skills, item.key, 'label') || rowError(errors.skills, item.key, 'skillId')}
                            </p>
                          ) : null}
                        </div>
                        <SelectInput
                          id={`skill-level-${item.key}`}
                          label="Proficiency"
                          value={item.proficiencyLevel}
                          disabled={disabled}
                          options={PROFICIENCY_OPTIONS}
                          onChange={(event) =>
                            editor.updateItem('skills', item.key, { proficiencyLevel: event.target.value })
                          }
                        />
                        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => editor.removeItem('skills', item.key)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <SectionHeader
                title="Certifications"
                description={RESUME_CERT_STORAGE_COPY}
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={disabled || !canAddSection(form, 'certifications')}
                    onClick={() => editor.addItem('certifications')}
                  >
                    Add certification
                  </Button>
                }
              />
              {errors.certificationsLimit ? (
                <p className="po-helper po-helper-error">{errors.certificationsLimit}</p>
              ) : null}
              {form.certifications.length === 0 ? (
                <p className="po-secondary">No certifications yet.</p>
              ) : (
                <div className="space-y-4">
                  {form.certifications.map((item, index) => (
                    <div key={item.key} className="rounded-xl border border-line p-4">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="po-card-title">Certification {index + 1}</h3>
                        <ReorderActions
                          index={index}
                          total={form.certifications.length}
                          disabled={disabled}
                          onMove={(offset) => editor.moveItem('certifications', item.key, offset)}
                          onRemove={() => editor.removeItem('certifications', item.key)}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput
                          id={`cert-name-${item.key}`}
                          label="Certification name"
                          required
                          value={item.name}
                          error={rowError(errors.certifications, item.key, 'name')}
                          disabled={disabled}
                          maxLength={RESUME_FIELD_LIMITS.certificationName}
                          onChange={(event) => editor.updateItem('certifications', item.key, { name: event.target.value })}
                        />
                        <TextInput
                          id={`cert-issuer-${item.key}`}
                          label="Issuing organisation"
                          value={item.issuer}
                          error={rowError(errors.certifications, item.key, 'issuer')}
                          disabled={disabled}
                          maxLength={RESUME_FIELD_LIMITS.issuer}
                          onChange={(event) => editor.updateItem('certifications', item.key, { issuer: event.target.value })}
                        />
                        <TextInput
                          id={`cert-year-${item.key}`}
                          label="Year issued"
                          type="number"
                          min={RESUME_YEAR_MIN}
                          max={RESUME_YEAR_MAX}
                          value={item.year}
                          error={rowError(errors.certifications, item.key, 'year')}
                          disabled={disabled}
                          onChange={(event) => editor.updateItem('certifications', item.key, { year: event.target.value })}
                        />
                        <TextInput
                          id={`cert-credential-${item.key}`}
                          label="Credential ID"
                          value={item.credentialId}
                          error={rowError(errors.certifications, item.key, 'credentialId')}
                          disabled={disabled}
                          maxLength={RESUME_FIELD_LIMITS.credentialId}
                          onChange={(event) =>
                            editor.updateItem('certifications', item.key, { credentialId: event.target.value })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="po-helper mt-4">You can save up to {RESUME_SECTION_LIMITS.certifications} certifications.</p>
            </Card>
            </div>
            <aside className="mt-8 lg:mt-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-auto">
              <Card>
                <SectionHeader
                  title="Live preview"
                  description="This preview updates as you type. Empty sections stay hidden."
                />
                <ResumePreview form={form} />
              </Card>
            </aside>
          </div>
        ) : null}
      </QueryStatus>

      <Modal
        open={pendingRemoveFile}
        title="Remove resume file"
        onClose={() => {
          if (!editor.fileBusy) {
            setPendingRemoveFile(false)
          }
        }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingRemoveFile(false)} disabled={editor.fileBusy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRemoveFile} disabled={editor.fileBusy}>
              Remove file
            </Button>
          </>
        }
      >
        <p className="po-body">
          Remove the uploaded file? The structured resume and unsaved form changes are kept.
        </p>
      </Modal>

      <Toast message={editor.saveSuccess || editor.pdfSuccess} />
    </PageContent>
  )
}

export default ResumeEditorPage
