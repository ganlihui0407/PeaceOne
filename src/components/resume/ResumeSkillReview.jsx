import Badge from '../common/Badge.jsx'
import Button from '../common/Button.jsx'
import Card from '../cards/Card.jsx'
import Checkbox from '../forms/Checkbox.jsx'
import SectionHeader from '../ui/SectionHeader.jsx'
import {
  EXTRACTION_EMPTY,
  EXTRACTION_SCANNED,
  EXTRACTION_UNREADABLE,
  matchingExplanation,
} from '../../api/resumeExtraction.js'
import { formatSkillType } from '../../api/esco.js'

function ResumeSkillReview({
  hasFile,
  disabled = false,
  extractionState,
  onConfirmed,
}) {
  const {
    busy,
    confirming,
    error,
    success,
    extraction,
    selectedIds,
    statusLabel,
    identify,
    toggle,
    cancel,
    confirm,
  } = extractionState

  const locked = disabled || busy || confirming
  const suggestions = extraction?.suggestions ?? []
  const selectedCount = suggestions.filter((item) => selectedIds.has(item.skillId)).length

  async function handleConfirm() {
    const result = await confirm()
    if (result && onConfirmed) {
      onConfirmed(result)
    }
  }

  return (
    <Card>
      <SectionHeader
        title="Skills Identified from Your Resume"
        description="Review skills found in the uploaded document. Nothing is added to your career skill profile until you confirm."
      />
      {error ? (
        <p className="po-helper mt-0 mb-3 text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {success ? <p className="po-helper mt-0 mb-3">{success}</p> : null}
      {busy ? <p className="po-helper mt-0 mb-3">{statusLabel}</p> : null}
      {!hasFile ? (
        <p className="po-secondary mb-4">Upload a PDF or DOCX resume to identify skills.</p>
      ) : null}
      {extraction?.unreadable ? (
        <div className="mb-4">
          <p className="po-body">{EXTRACTION_UNREADABLE}</p>
          <p className="po-secondary mt-2">{EXTRACTION_SCANNED}</p>
        </div>
      ) : null}
      {extraction && !extraction.unreadable && suggestions.length === 0 ? (
        <p className="po-body mb-4">{EXTRACTION_EMPTY}</p>
      ) : null}
      {extraction?.truncated ? (
        <p className="po-secondary mb-4">The extracted text was truncated. Some later skills may be missing.</p>
      ) : null}
      {suggestions.length > 0 ? (
        <div className="mb-4 space-y-4">
          {suggestions.map((item) => (
            <div key={item.skillId} className="rounded-md border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Checkbox
                  id={`extract-skill-${item.skillId}`}
                  label={item.preferredLabel}
                  checked={selectedIds.has(item.skillId)}
                  disabled={locked || item.alreadySaved}
                  onChange={() => toggle(item.skillId)}
                />
                <div className="flex flex-wrap gap-2">
                  <Badge className="normal-case">{formatSkillType(item.skillType)}</Badge>
                  {item.alreadySaved ? (
                    <Badge tone="success" className="normal-case">
                      Already saved
                      {item.existingProficiency ? ` · ${item.existingProficiency}` : ''}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <p className="po-secondary mt-2">ESCO label: {item.preferredLabel}</p>
              {item.matchedLabel !== item.preferredLabel ? (
                <p className="po-secondary mt-1">Matched as: {item.matchedLabel}</p>
              ) : null}
              <p className="po-secondary mt-1">{matchingExplanation(item)}</p>
              <p className="po-body mt-2">Evidence: {item.evidence}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={locked || !hasFile} onClick={() => identify()}>
          {extraction ? 'Identify skills again' : 'Identify skills from this document'}
        </Button>
        <Button
          size="sm"
          disabled={locked || !extraction?.reviewToken || selectedCount === 0}
          onClick={() => void handleConfirm()}
        >
          {confirming ? 'Saving…' : 'Confirm selected skills'}
        </Button>
        <Button size="sm" variant="secondary" disabled={locked || !extraction} onClick={cancel}>
          Return without saving
        </Button>
        {error ? (
          <Button size="sm" variant="secondary" disabled={locked || !hasFile} onClick={() => identify()}>
            Try again
          </Button>
        ) : null}
      </div>
    </Card>
  )
}

export default ResumeSkillReview
