import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge.jsx'
import Button from '../../components/common/Button.jsx'
import QueryStatus from '../../components/common/QueryStatus.jsx'
import Table from '../../components/common/Table.jsx'
import Card from '../../components/cards/Card.jsx'
import PageContent from '../../components/layout/PageContent.jsx'
import DetailItem from '../../components/ui/DetailItem.jsx'
import {
  MASCO_UNAVAILABLE,
  fetchMascoOccupation,
  fetchMascoOccupationCrosswalks,
  formatMascoStatusLabel,
  formatRecordScope,
  isAbortError,
  isMascoNotFoundError,
  isMascoOccupationCode,
  mappingStatusTone,
  mascoCrosswalksPath,
  mascoOccupationsPath,
  recordScopeTone,
  reviewDecisionTone,
  sourceMetadataEntries,
  userFacingLoadError,
} from '../../api/masco.js'

function BackToCatalogue() {
  return (
    <Button variant="secondary" to={mascoOccupationsPath()}>
      Back to MASCO Catalogue
    </Button>
  )
}

function MascoOccupationDetails() {
  const { code } = useParams()
  return <MascoOccupationDetailsView key={code} code={code} />
}

function MascoOccupationDetailsView({ code }) {
  const validCode = isMascoOccupationCode(code)
  const [occupation, setOccupation] = useState(null)
  const [loading, setLoading] = useState(validCode)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [crosswalks, setCrosswalks] = useState([])
  const [crosswalksLoading, setCrosswalksLoading] = useState(validCode)
  const [crosswalksError, setCrosswalksError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    if (!validCode) {
      return undefined
    }

    const controller = new AbortController()
    let occupationLoaded = false

    fetchMascoOccupation(code, { signal: controller.signal })
      .then((record) => {
        if (controller.signal.aborted) {
          return null
        }
        occupationLoaded = true
        setOccupation(record)
        setNotFound(false)
        setError('')
        return fetchMascoOccupationCrosswalks(code, { signal: controller.signal })
      })
      .then((result) => {
        if (!result || controller.signal.aborted) {
          return
        }
        setCrosswalks(result.items)
        setCrosswalksError('')
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) {
          return
        }
        if (occupationLoaded) {
          setCrosswalks([])
          setCrosswalksError(userFacingLoadError(err, MASCO_UNAVAILABLE.crosswalks))
          return
        }
        setOccupation(null)
        setCrosswalks([])
        setCrosswalksError('')
        if (isMascoNotFoundError(err)) {
          setNotFound(true)
          setError('')
          return
        }
        setNotFound(false)
        setError(userFacingLoadError(err, MASCO_UNAVAILABLE.occupation))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
          setCrosswalksLoading(false)
        }
      })

    return () => controller.abort()
  }, [code, retryNonce, validCode])

  function retry() {
    if (!validCode) {
      return
    }
    setLoading(true)
    setCrosswalksLoading(true)
    setError('')
    setCrosswalksError('')
    setNotFound(false)
    setOccupation(null)
    setCrosswalks([])
    setRetryNonce((current) => current + 1)
  }

  function retryCrosswalks() {
    if (!validCode) {
      return
    }
    setCrosswalksLoading(true)
    setCrosswalksError('')
    setRetryNonce((current) => current + 1)
  }

  const metadata = sourceMetadataEntries(occupation?.sourceMetadata)
  const empty = !validCode || notFound

  return (
    <PageContent
      title={occupation?.title || 'MASCO Occupation'}
      description="Official MASCO 2020 occupation record. This catalogue is independent of ESCO and does not set Career Target, Skill Gap or course recommendations."
      breadcrumb={code || 'Unknown code'}
      actions={
        <div className="flex flex-wrap gap-2">
          <BackToCatalogue />
          <Button variant="secondary" to={mascoCrosswalksPath()}>
            MASCO Crosswalks
          </Button>
        </div>
      }
    >
      <QueryStatus
        loading={loading}
        error={error}
        empty={empty}
        loadingLabel="Loading MASCO occupation…"
        emptyTitle={validCode ? 'MASCO occupation not found' : 'Invalid MASCO occupation code'}
        emptyDescription={
          validCode
            ? 'This code is not in the imported MASCO 2020 catalogue.'
            : 'Occupation codes look like 2411-01. Open a record from the catalogue instead of typing an unknown code.'
        }
        emptyAction={<BackToCatalogue />}
        onRetry={error ? retry : undefined}
      >
        {occupation ? (
          <div className="space-y-6">
            <Card>
              <h2 className="po-section-title">Occupation</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailItem label="Occupation code" value={occupation.code} />
                <DetailItem label="Occupation title" value={occupation.title} />
                <DetailItem label="Classification" value={occupation.classification} />
                <DetailItem label="Version" value={occupation.version} />
                <DetailItem label="Record scope">
                  <Badge tone={recordScopeTone(occupation.recordScope)} className="normal-case">
                    {formatRecordScope(occupation.recordScope)}
                  </Badge>
                </DetailItem>
              </dl>
            </Card>

            <Card>
              <h2 className="po-section-title">Unit group</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailItem label="Unit group code" value={occupation.unitGroup.code} />
                <DetailItem label="Unit group title" value={occupation.unitGroup.title} />
                <div className="sm:col-span-2">
                  <DetailItem label="Unit group description">
                    <p className="whitespace-pre-wrap font-medium text-ink">
                      {occupation.unitGroup.description || '—'}
                    </p>
                  </DetailItem>
                </div>
                <div className="sm:col-span-2">
                  <DetailItem label="Occupational tasks">
                    <p className="whitespace-pre-wrap font-medium text-ink">
                      {occupation.unitGroup.tasks || '—'}
                    </p>
                  </DetailItem>
                </div>
              </dl>
            </Card>

            <Card>
              <h2 className="po-section-title">Historical crosswalks</h2>
              <p className="po-secondary mt-2">MASCO 2013 codes mapped to this 2020 occupation.</p>
              <div className="mt-5">
                <QueryStatus
                  loading={crosswalksLoading}
                  error={crosswalksError}
                  empty={crosswalks.length === 0}
                  loadingLabel="Loading historical mappings…"
                  emptyTitle="No historical mappings recorded"
                  emptyDescription="This MASCO 2020 occupation has no imported 2013–2020 crosswalk records."
                  onRetry={crosswalksError ? retryCrosswalks : undefined}
                >
                  <Table
                    minWidthClass="min-w-[720px]"
                    headers={[
                      'Historical code',
                      'Source version',
                      'Target version',
                      'Mapping status',
                      'Review decision',
                    ]}
                    rows={crosswalks.map((item) => [
                      item.historicalCode,
                      item.sourceVersion,
                      item.targetVersion,
                      <Badge
                        key={`${item.historicalCode}-status`}
                        tone={mappingStatusTone(item.mappingStatus)}
                        className="normal-case"
                      >
                        {formatMascoStatusLabel(item.mappingStatus)}
                      </Badge>,
                      <Badge
                        key={`${item.historicalCode}-review`}
                        tone={reviewDecisionTone(item.reviewDecision)}
                        className="normal-case"
                      >
                        {formatMascoStatusLabel(item.reviewDecision)}
                      </Badge>,
                    ])}
                  />
                </QueryStatus>
              </div>
            </Card>

            <Card>
              <h2 className="po-section-title">Source metadata</h2>
              {metadata.length === 0 ? (
                <p className="po-secondary mt-5">No source metadata is recorded for this occupation.</p>
              ) : (
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  {metadata.map((item) => (
                    <DetailItem key={item.key} label={item.key} value={item.value} />
                  ))}
                </dl>
              )}
            </Card>
          </div>
        ) : null}
      </QueryStatus>
    </PageContent>
  )
}

export default MascoOccupationDetails
