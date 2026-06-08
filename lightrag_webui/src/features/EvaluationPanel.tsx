import { useState, useEffect, useCallback } from 'react'
import { useTabVisibility } from '@/contexts/useTabVisibility'
import { useTranslation } from 'react-i18next'
import {
  getEvaluationEnvironment,
  runEvaluation,
  getEvaluationStatus,
  getRunningEvaluation,
  listEvaluationResults,
  getEvaluationResult,
  deleteEvaluationResult,
  listEvaluationDatasets,
  EvaluationEnvironmentStatus,
  EvaluationResultSummary,
  EvaluationResult,
  EvaluationStatus,
  EvaluationDataset,
  PipelineConfig,
} from '@/api/lightrag'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Progress from '@/components/ui/Progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import {
  RefreshCwIcon,
  PlayIcon,
  TrashIcon,
  EyeIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  LoaderIcon,
  BeakerIcon,
  DownloadIcon,
  FileTextIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

function ScoreBar({ score, label }: { score: number; label: string }) {
  const percentage = Math.round(score * 100)
  const colorClass =
    percentage >= 80
      ? 'bg-green-500'
      : percentage >= 60
        ? 'bg-yellow-500'
        : 'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function MetricBarChart({
  metrics,
  labels,
}: {
  metrics: { key: string; value: number }[]
  labels: Record<string, string>
}) {
  return (
    <div className="space-y-3">
      {metrics.map(({ key, value }) => {
        const percentage = Math.round(value * 100)
        const barColor =
          percentage >= 80
            ? 'bg-emerald-500'
            : percentage >= 60
              ? 'bg-amber-500'
              : 'bg-red-500'
        const textColor =
          percentage >= 80
            ? 'text-emerald-600 dark:text-emerald-400'
            : percentage >= 60
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'

        return (
          <div key={key} className="flex items-center gap-3">
            <div className="w-36 text-sm font-medium text-muted-foreground truncate">
              {labels[key] || key}
            </div>
            <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
              <div
                className={`h-full ${barColor} transition-all duration-500 rounded-md`}
                style={{ width: `${percentage}%` }}
              />
              <div className="absolute inset-0 flex items-center px-2">
                <span className={`text-xs font-bold ${percentage > 50 ? 'text-white' : textColor}`}>
                  {value.toFixed(2)}
                </span>
              </div>
            </div>
            <div className={`w-12 text-right text-sm font-bold ${textColor}`}>
              {percentage}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ExpandableTestResult({
  result,
  labels,
}: {
  result: import('@/api/lightrag').EvaluationTestResult
  labels: Record<string, string>
}) {
  const [expanded, setExpanded] = useState(false)
  const percentage = Math.round(result.ragas_score * 100)
  const scoreColor =
    percentage >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : percentage >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'
  const barColor =
    percentage >= 80
      ? 'bg-emerald-500'
      : percentage >= 60
        ? 'bg-amber-500'
        : 'bg-red-500'

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Clickable header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 shrink-0">
          {expanded ? (
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-muted-foreground w-6">
            #{result.test_number}
          </span>
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {result.question_type && (
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                result.question_type === 'figure'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                  : result.question_type === 'table'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {result.question_type}
            </span>
          )}
          <p className="text-sm truncate">{result.question}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Mini bar */}
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className={`text-sm font-bold w-12 text-right ${scoreColor}`}>
            {percentage}%
          </span>
          {result.error ? (
            <XCircleIcon className="size-4 text-destructive shrink-0" />
          ) : (
            <CheckCircleIcon className="size-4 text-green-500 shrink-0" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-4 py-3 bg-muted/20 space-y-3">
          {/* Per-question metric bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {Object.entries(result.metrics).map(([key, value]) => {
              const pct = Math.round(value * 100)
              const color =
                pct >= 80
                  ? 'bg-emerald-500'
                  : pct >= 60
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              const txtColor =
                pct >= 80
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : pct >= 60
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-28 text-xs text-muted-foreground truncate">
                    {labels[key] || key}
                  </span>
                  <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                    <div
                      className={`h-full ${color} rounded`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`w-10 text-xs font-bold text-right ${txtColor}`}>
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>

          {/* Answer and Ground Truth */}
          {result.answer && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">RAG Answer</div>
              <div className="text-sm bg-background rounded p-2 border whitespace-pre-wrap">
                {result.answer}
              </div>
            </div>
          )}
          {result.ground_truth && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">Ground Truth</div>
              <div className="text-sm bg-background rounded p-2 border whitespace-pre-wrap">
                {result.ground_truth}
              </div>
            </div>
          )}
          {result.contexts && result.contexts.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                Retrieved Contexts ({result.contexts.length} chunks)
              </div>
              <div className="space-y-1.5 max-h-48 overflow-auto">
                {result.contexts.map((ctx, i) => (
                  <div
                    key={i}
                    className="text-xs bg-background rounded p-2 border text-muted-foreground whitespace-pre-wrap"
                  >
                    <span className="font-semibold text-foreground">[{i + 1}]</span> {ctx.length > 500 ? ctx.slice(0, 500) + '...' : ctx}
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.error && (
            <div>
              <div className="text-xs font-semibold text-destructive mb-1">Error</div>
              <div className="text-sm bg-red-50 dark:bg-red-900/20 rounded p-2 border border-red-200 dark:border-red-800">
                {result.error}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PipelineBadge({ config }: { config?: PipelineConfig | null }) {
  if (!config) return <span className="text-xs text-muted-foreground">—</span>

  // Engine abbreviation
  const engineMap: Record<string, string> = {
    docling_vision: 'D+V',
    docling: 'Docling',
    DEFAULT: 'Default',
  }
  const engine = engineMap[config.extraction_engine || ''] || config.extraction_engine || '?'

  // Chunking abbreviation
  const chunkingMap: Record<string, string> = {
    TOKEN_SIZE: 'Token',
    SEMANTIC: 'Sem',
    HYBRID: 'Hybrid',
  }
  const chunking = chunkingMap[config.chunking_method || ''] || config.chunking_method || ''

  const label = chunking ? `${engine} · ${chunking}` : engine

  // Tooltip with full details
  const details = [
    `Engine: ${config.extraction_engine || 'N/A'}`,
    `Chunking: ${config.chunking_method || 'N/A'}`,
    `Chunk Size: ${config.chunk_size || 'N/A'}`,
    `Overlap: ${config.chunk_overlap_size || 'N/A'}`,
    config.vision_enabled ? `Vision: ${config.vision_model || 'enabled'}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <span
      title={details}
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 cursor-default whitespace-nowrap"
    >
      {label}
    </span>
  )
}

export default function EvaluationPanel() {
  const { t } = useTranslation()
  const { isTabVisible } = useTabVisibility()
  const isEvaluationTabVisible = isTabVisible('evaluation')

  const [environment, setEnvironment] = useState<EvaluationEnvironmentStatus | null>(null)
  const [results, setResults] = useState<EvaluationResultSummary[]>([])
  const [datasets, setDatasets] = useState<EvaluationDataset[]>([])
  const [selectedDataset, setSelectedDataset] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Running evaluation state
  const [runningEvalId, setRunningEvalId] = useState<string | null>(null)
  const [runningStatus, setRunningStatus] = useState<EvaluationStatus | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  // Detail modal state
  const [detailResult, setDetailResult] = useState<EvaluationResult | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [envData, resultsData, datasetsData] = await Promise.all([
        getEvaluationEnvironment(),
        listEvaluationResults(),
        listEvaluationDatasets(),
      ])
      setEnvironment(envData)
      setResults(resultsData.results)
      setDatasets(datasetsData.datasets)
      // Set default dataset if available
      if (datasetsData.datasets.length > 0 && !selectedDataset) {
        const defaultDs = datasetsData.datasets.find(d => d.is_default)
        setSelectedDataset(defaultDs?.filename || datasetsData.datasets[0].filename)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('evaluationPanel.loadError'))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedDataset is read conditionally, not a real dependency
  }, [t])

  // Fetch data when tab becomes visible
  useEffect(() => {
    if (isEvaluationTabVisible) {
      fetchData()
    }
  }, [isEvaluationTabVisible, fetchData])

  // Check for running evaluation on mount (for page refresh recovery)
  useEffect(() => {
    const checkRunningEvaluation = async () => {
      try {
        const running = await getRunningEvaluation()
        if (running.running && running.eval_id && running.status) {
          setRunningEvalId(running.eval_id)
          setRunningStatus(running.status)
        }
      } catch (err) {
        console.error('Failed to check running evaluation:', err)
      }
    }
    checkRunningEvaluation()
  }, [])

  // Poll for running evaluation status
  useEffect(() => {
    if (!runningEvalId) return

    const pollInterval = setInterval(async () => {
      try {
        const status = await getEvaluationStatus(runningEvalId)
        setRunningStatus(status)

        if (status.status === 'completed' || status.status === 'failed') {
          setRunningEvalId(null)
          setRunningStatus(null)
          // Refresh results list
          const resultsData = await listEvaluationResults()
          setResults(resultsData.results)
        }
      } catch (err) {
        console.error('Failed to poll evaluation status:', err)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [runningEvalId])

  const handleRunEvaluation = async () => {
    setIsStarting(true)
    try {
      const response = await runEvaluation({
        dataset_filename: selectedDataset,
      })
      if (response.status === 'started' && response.eval_id) {
        setRunningEvalId(response.eval_id)
        setRunningStatus({
          status: 'running',
          progress: 0,
          total: response.total_tests,
          started_at: new Date().toISOString(),
        })
      } else if (response.status === 'busy') {
        setError(response.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('evaluationPanel.runError'))
    } finally {
      setIsStarting(false)
    }
  }

  const handleViewResult = async (filename: string) => {
    setDetailLoading(true)
    setDetailOpen(true)
    try {
      const result = await getEvaluationResult(filename)
      setDetailResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('evaluationPanel.loadResultError'))
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDeleteResult = async (filename: string) => {
    if (!confirm(t('evaluationPanel.confirmDelete'))) return

    try {
      await deleteEvaluationResult(filename)
      setResults((prev) => prev.filter((r) => r.filename !== filename))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('evaluationPanel.deleteError'))
    }
  }

  const handleDownloadCsv = (filename: string) => {
    const csvFilename = filename.replace('.json', '.csv')
    window.open(`/evaluation/results/${csvFilename}`, '_blank')
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs.toFixed(0)}s`
  }

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString()
  }

  // Use CSS to hide content when tab is not visible
  return (
    <div className={`size-full overflow-auto p-6 ${isEvaluationTabVisible ? '' : 'hidden'}`}>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('evaluationPanel.title')}</h1>
            <p className="text-muted-foreground">{t('evaluationPanel.description')}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              tooltip={t('evaluationPanel.refresh')}
            >
              <RefreshCwIcon className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('evaluationPanel.refresh')}
            </Button>
            <Button
              size="sm"
              onClick={handleRunEvaluation}
              disabled={isStarting || !!runningEvalId || !environment?.ragas_available || !selectedDataset}
              tooltip={
                !environment?.ragas_available
                  ? t('evaluationPanel.ragasNotAvailable')
                  : runningEvalId
                    ? t('evaluationPanel.evaluationRunning')
                    : t('evaluationPanel.runTooltip')
              }
            >
              {isStarting ? (
                <LoaderIcon className="size-4 mr-2 animate-spin" />
              ) : (
                <PlayIcon className="size-4 mr-2" />
              )}
              {t('evaluationPanel.runEvaluation')}
            </Button>
          </div>
        </div>

        {/* Environment Status */}
        {environment && !environment.ragas_available && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertCircleIcon className="size-5 text-yellow-600" />
                <p className="text-yellow-700 dark:text-yellow-400">
                  {t('evaluationPanel.ragasNotInstalled')}
                </p>
              </div>
              <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-2">
                {t('evaluationPanel.installCommand')}: <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">pip install lightrag-hku[evaluation]</code>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Dataset Selector */}
        {environment?.ragas_available && datasets.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileTextIcon className="size-4" />
                {t('evaluationPanel.selectDataset')}
              </CardTitle>
              <CardDescription>
                {t('evaluationPanel.selectDatasetDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('evaluationPanel.selectDatasetPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.filename} value={dataset.filename}>
                      <div className="flex items-center gap-2">
                        <span>{dataset.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({dataset.test_count} {t('evaluationPanel.tests')})
                        </span>
                        {dataset.source_pdf && (
                          <span className={`text-xs ${dataset.source_pdf_exists ? 'text-green-600' : 'text-yellow-600'}`}>
                            {dataset.source_pdf_exists ? '✓ PDF' : '⚠ PDF'}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Show selected dataset info */}
              {selectedDataset && datasets.find(d => d.filename === selectedDataset)?.description && (
                <p className="text-xs text-muted-foreground mt-2">
                  {datasets.find(d => d.filename === selectedDataset)?.description}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Running Evaluation Progress */}
        {runningStatus && (
          <Card className="border-blue-500 bg-blue-50 dark:bg-blue-900/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <LoaderIcon className="size-4 animate-spin" />
                {t('evaluationPanel.evaluationInProgress')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('evaluationPanel.progress')}</span>
                  <span>
                    {runningStatus.progress} / {runningStatus.total}
                  </span>
                </div>
                <Progress
                  value={runningStatus.total > 0 ? (runningStatus.progress / runningStatus.total) * 100 : 0}
                  className="h-3"
                />
                <p className="text-xs text-muted-foreground">
                  {t('evaluationPanel.startedAt')}: {formatDate(runningStatus.started_at)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {loading && !results.length && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="text-muted-foreground">{t('evaluationPanel.loading')}</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircleIcon className="size-5 text-destructive" />
                <p className="text-destructive">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Table */}
        {!loading && results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BeakerIcon className="size-4" />
                {t('evaluationPanel.pastResults')}
              </CardTitle>
              <CardDescription>
                {t('evaluationPanel.resultsCount', { count: results.length })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">{t('evaluationPanel.timestamp')}</th>
                      <th className="text-center py-2 px-2 font-medium">{t('evaluationPanel.pipeline')}</th>
                      <th className="text-center py-2 px-2 font-medium">{t('evaluationPanel.tests')}</th>
                      <th className="text-center py-2 px-2 font-medium">{t('evaluationPanel.ragasScore')}</th>
                      <th className="text-center py-2 px-2 font-medium">{t('evaluationPanel.duration')}</th>
                      <th className="text-center py-2 px-2 font-medium">{t('evaluationPanel.successRate')}</th>
                      <th className="text-right py-2 px-2 font-medium">{t('evaluationPanel.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result) => (
                      <tr key={result.filename} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 px-2">{formatDate(result.timestamp)}</td>
                        <td className="text-center py-2 px-2">
                          <PipelineBadge config={result.pipeline_config} />
                        </td>
                        <td className="text-center py-2 px-2">{result.total_tests}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16">
                              <ScoreBar score={result.avg_ragas_score} label="" />
                            </div>
                            <span className="text-xs font-medium">
                              {Math.round(result.avg_ragas_score * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-2 px-2">{formatTime(result.elapsed_time)}</td>
                        <td className="text-center py-2 px-2">
                          {result.success_rate >= 100 ? (
                            <CheckCircleIcon className="size-4 text-green-500 inline" />
                          ) : (
                            <span>{result.success_rate.toFixed(0)}%</span>
                          )}
                        </td>
                        <td className="text-right py-2 px-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewResult(result.filename)}
                              tooltip={t('evaluationPanel.viewDetails')}
                            >
                              <EyeIcon className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadCsv(result.filename)}
                              tooltip={t('evaluationPanel.downloadCsv')}
                            >
                              <DownloadIcon className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteResult(result.filename)}
                              tooltip={t('evaluationPanel.delete')}
                            >
                              <TrashIcon className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!loading && results.length === 0 && environment?.ragas_available && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <BeakerIcon className="size-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">{t('evaluationPanel.noResults')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('evaluationPanel.noResultsDescription')}
                </p>
                <Button onClick={handleRunEvaluation} disabled={isStarting || !!runningEvalId || !selectedDataset}>
                  <PlayIcon className="size-4 mr-2" />
                  {t('evaluationPanel.runFirstEvaluation')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detail Modal — near full screen */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] overflow-hidden flex flex-col">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoaderIcon className="size-8 animate-spin" />
              </div>
            ) : detailResult ? (
              <>
                <DialogHeader className="shrink-0">
                  <DialogTitle className="text-xl">{t('evaluationPanel.evaluationDetails')}</DialogTitle>
                  <DialogDescription>
                    {formatDate(detailResult.timestamp)} — {detailResult.total_tests} {t('evaluationPanel.tests')} — {formatTime(detailResult.elapsed_time_seconds)}
                  </DialogDescription>
                </DialogHeader>

                {/* Top section: Metrics bar chart + Summary stats side by side */}
                <div className="shrink-0 grid grid-cols-1 lg:grid-cols-3 gap-4 my-4">
                  {/* Metrics Bar Chart — 2/3 width */}
                  <div className="lg:col-span-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t('evaluationPanel.metricsOverview')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <MetricBarChart
                          metrics={[
                            { key: 'faithfulness', value: detailResult.benchmark_stats.average_metrics.faithfulness },
                            { key: 'answer_relevance', value: detailResult.benchmark_stats.average_metrics.answer_relevance },
                            { key: 'context_recall', value: detailResult.benchmark_stats.average_metrics.context_recall },
                            { key: 'context_precision', value: detailResult.benchmark_stats.average_metrics.context_precision },
                            { key: 'ragas_score', value: detailResult.benchmark_stats.average_metrics.ragas_score },
                          ]}
                          labels={{
                            faithfulness: t('evaluationPanel.faithfulness'),
                            answer_relevance: t('evaluationPanel.answerRelevance'),
                            context_recall: t('evaluationPanel.contextRecall'),
                            context_precision: t('evaluationPanel.contextPrecision'),
                            ragas_score: t('evaluationPanel.overallScore'),
                          }}
                        />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Summary Stats — 1/3 width */}
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 gap-4 text-center h-full content-center">
                        <div>
                          <div className="text-3xl font-bold text-primary">
                            {Math.round(detailResult.benchmark_stats.average_metrics.ragas_score * 100)}%
                          </div>
                          <div className="text-xs text-muted-foreground">{t('evaluationPanel.overallScore')}</div>
                        </div>
                        <div>
                          <div className="text-3xl font-bold">
                            {detailResult.benchmark_stats.successful_tests}/{detailResult.benchmark_stats.total_tests}
                          </div>
                          <div className="text-xs text-muted-foreground">{t('evaluationPanel.testsSucceeded')}</div>
                        </div>
                        <div>
                          <div className="text-3xl font-bold">
                            {formatTime(detailResult.elapsed_time_seconds)}
                          </div>
                          <div className="text-xs text-muted-foreground">{t('evaluationPanel.totalDuration')}</div>
                        </div>
                        <div>
                          <div className="text-3xl font-bold">
                            {Math.round(detailResult.benchmark_stats.min_ragas_score * 100)}-{Math.round(detailResult.benchmark_stats.max_ragas_score * 100)}%
                          </div>
                          <div className="text-xs text-muted-foreground">{t('evaluationPanel.scoreRange')}</div>
                        </div>
                        {detailResult.pipeline_config && (
                          <div className="col-span-2 border-t pt-3 mt-1">
                            <div className="text-xs text-muted-foreground mb-1">{t('evaluationPanel.pipeline')}</div>
                            <div className="flex flex-wrap gap-1.5 justify-center">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                {detailResult.pipeline_config.extraction_engine || 'N/A'}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                {detailResult.pipeline_config.chunking_method || 'N/A'}
                                {detailResult.pipeline_config.chunk_size ? ` (${detailResult.pipeline_config.chunk_size})` : ''}
                              </span>
                              {detailResult.pipeline_config.vision_enabled && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                  {detailResult.pipeline_config.vision_model || 'Vision'}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Individual Results — scrollable */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <h4 className="font-medium mb-2 shrink-0">
                    {t('evaluationPanel.individualResults')}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({t('evaluationPanel.clickToExpand')})
                    </span>
                  </h4>
                  <div className="flex-1 overflow-auto space-y-1 pr-1">
                    {detailResult.results.map((result) => (
                      <ExpandableTestResult
                        key={result.test_number}
                        result={result}
                        labels={{
                          faithfulness: t('evaluationPanel.faithfulness'),
                          answer_relevance: t('evaluationPanel.answerRelevance'),
                          context_recall: t('evaluationPanel.contextRecall'),
                          context_precision: t('evaluationPanel.contextPrecision'),
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
