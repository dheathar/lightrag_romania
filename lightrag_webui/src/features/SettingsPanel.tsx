import { useState, useEffect } from 'react'
import { useTabVisibility } from '@/contexts/useTabVisibility'
import { useTranslation } from 'react-i18next'
import { getServerConfig, ServerConfig } from '@/api/lightrag'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { RefreshCwIcon, Settings2Icon, SearchIcon, SplitIcon, FilterIcon } from 'lucide-react'
import Button from '@/components/ui/Button'

function ConfigSection({
  title,
  description,
  icon: Icon,
  children
}: {
  title: string
  description: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ConfigRow({ label, value, tooltip }: { label: string; value: string | number | boolean; tooltip?: string }) {
  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value.toString()

  return (
    <div className="grid grid-cols-[200px_1fr] gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground" title={tooltip}>
        {label}
      </span>
      <span className="text-sm font-medium">{displayValue}</span>
    </div>
  )
}

export default function SettingsPanel() {
  const { t } = useTranslation()
  const { isTabVisible } = useTabVisibility()
  const isSettingsTabVisible = isTabVisible('settings')
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getServerConfig()
      setConfig(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isSettingsTabVisible) {
      fetchConfig()
    }
  }, [isSettingsTabVisible])

  // Use CSS to hide content when tab is not visible
  return (
    <div className={`size-full overflow-auto p-6 ${isSettingsTabVisible ? '' : 'hidden'}`}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('settingsPanel.title')}</h1>
            <p className="text-muted-foreground">{t('settingsPanel.description')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfig}
            disabled={loading}
            tooltip={t('settingsPanel.refresh')}
          >
            <RefreshCwIcon className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('settingsPanel.refresh')}
          </Button>
        </div>

        {/* Loading state */}
        {loading && !config && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
              <p className="text-muted-foreground">{t('settingsPanel.loading')}</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Config sections */}
        {config && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Chunking Configuration */}
            <ConfigSection
              title={t('settingsPanel.chunking.title')}
              description={t('settingsPanel.chunking.description')}
              icon={SplitIcon}
            >
              <div className="space-y-0">
                <ConfigRow
                  label={t('settingsPanel.chunking.method')}
                  value={config.chunking.method}
                  tooltip={t('settingsPanel.chunking.methodTooltip')}
                />
                <ConfigRow
                  label={t('settingsPanel.chunking.chunkSize')}
                  value={config.chunking.chunk_size}
                  tooltip={t('settingsPanel.chunking.chunkSizeTooltip')}
                />
                <ConfigRow
                  label={t('settingsPanel.chunking.chunkOverlap')}
                  value={config.chunking.chunk_overlap_size}
                  tooltip={t('settingsPanel.chunking.chunkOverlapTooltip')}
                />
                <ConfigRow
                  label={t('settingsPanel.chunking.semanticThreshold')}
                  value={config.chunking.semantic_similarity_threshold}
                  tooltip={t('settingsPanel.chunking.semanticThresholdTooltip')}
                />
                <ConfigRow
                  label={t('settingsPanel.chunking.semanticMinSize')}
                  value={config.chunking.semantic_min_chunk_size}
                  tooltip={t('settingsPanel.chunking.semanticMinSizeTooltip')}
                />
                <ConfigRow
                  label={t('settingsPanel.chunking.semanticMaxTokens')}
                  value={config.chunking.semantic_max_tokens}
                  tooltip={t('settingsPanel.chunking.semanticMaxTokensTooltip')}
                />
              </div>
            </ConfigSection>

            {/* Query Configuration */}
            <ConfigSection
              title={t('settingsPanel.query.title')}
              description={t('settingsPanel.query.description')}
              icon={SearchIcon}
            >
              <div className="space-y-0">
                <ConfigRow
                  label={t('settingsPanel.query.topK')}
                  value={config.query.top_k}
                  tooltip={t('settingsPanel.query.topKTooltip')}
                />
                <ConfigRow
                  label={t('settingsPanel.query.chunkTopK')}
                  value={config.query.chunk_top_k}
                  tooltip={t('settingsPanel.query.chunkTopKTooltip')}
                />
                <ConfigRow
                  label={t('settingsPanel.query.maxEntityTokens')}
                  value={config.query.max_entity_tokens}
                  tooltip={t('settingsPanel.query.maxEntityTokensTooltip')}
                />
                <ConfigRow
                  label={t('settingsPanel.query.maxRelationTokens')}
                  value={config.query.max_relation_tokens}
                  tooltip={t('settingsPanel.query.maxRelationTokensTooltip')}
                />
                <ConfigRow
                  label={t('settingsPanel.query.maxTotalTokens')}
                  value={config.query.max_total_tokens}
                  tooltip={t('settingsPanel.query.maxTotalTokensTooltip')}
                />
                <ConfigRow
                  label={t('settingsPanel.query.historyTurns')}
                  value={config.query.history_turns}
                  tooltip={t('settingsPanel.query.historyTurnsTooltip')}
                />
              </div>
            </ConfigSection>

            {/* Reranking Configuration */}
            <ConfigSection
              title={t('settingsPanel.rerank.title')}
              description={t('settingsPanel.rerank.description')}
              icon={FilterIcon}
            >
              <div className="space-y-0">
                <ConfigRow
                  label={t('settingsPanel.rerank.enabled')}
                  value={config.rerank.enabled}
                />
                <ConfigRow
                  label={t('settingsPanel.rerank.binding')}
                  value={config.rerank.binding || '-'}
                />
                <ConfigRow
                  label={t('settingsPanel.rerank.model')}
                  value={config.rerank.model || '-'}
                />
                <ConfigRow
                  label={t('settingsPanel.rerank.minScore')}
                  value={config.rerank.min_score}
                  tooltip={t('settingsPanel.rerank.minScoreTooltip')}
                />
              </div>
            </ConfigSection>

            {/* Summary Configuration */}
            <ConfigSection
              title={t('settingsPanel.summary.title')}
              description={t('settingsPanel.summary.description')}
              icon={Settings2Icon}
            >
              <div className="space-y-0">
                <ConfigRow
                  label={t('settingsPanel.summary.language')}
                  value={config.summary.language}
                />
                <ConfigRow
                  label={t('settingsPanel.summary.maxTokens')}
                  value={config.summary.max_tokens}
                  tooltip={t('settingsPanel.summary.maxTokensTooltip')}
                />
                <ConfigRow
                  label={t('settingsPanel.summary.contextSize')}
                  value={config.summary.context_size}
                  tooltip={t('settingsPanel.summary.contextSizeTooltip')}
                />
              </div>
            </ConfigSection>
          </div>
        )}

        {/* Note about editing */}
        {config && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                {t('settingsPanel.editNote')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
