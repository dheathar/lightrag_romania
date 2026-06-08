import { useState, useEffect, useCallback } from 'react'
import { useTabVisibility } from '@/contexts/useTabVisibility'
import { useTranslation } from 'react-i18next'
import {
  getServerConfig,
  updateServerConfig,
  ServerConfig,
  DocumentProcessingConfigUpdate,
  ChunkingConfigUpdate,
} from '@/api/lightrag'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Checkbox from '@/components/ui/Checkbox'
import NumberInput from '@/components/ui/NumberInput'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import {
  RefreshCwIcon,
  FileTextIcon,
  EyeIcon,
  NetworkIcon,
  SplitIcon,
  SaveIcon,
  RotateCcwIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from 'lucide-react'

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  badge,
}: {
  title: string
  description: string
  icon: React.ElementType
  children: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {badge}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function FormRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-4 py-3 border-b border-border/50 last:border-0 items-start">
      <div>
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}

function ReadOnlyRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{String(value)}</span>
    </div>
  )
}

export default function DocumentProcessingPanel() {
  const { t } = useTranslation()
  const { isTabVisible } = useTabVisibility()
  const isVisible = isTabVisible('doc-processing')
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Editable form state for document processing
  const [formEngine, setFormEngine] = useState('DEFAULT')
  const [formVisionEnabled, setFormVisionEnabled] = useState(false)
  const [formVisionModel, setFormVisionModel] = useState('')
  const [formVisionBaseUrl, setFormVisionBaseUrl] = useState('')
  const [formVisionPrompt, setFormVisionPrompt] = useState('')
  const [formImagesScale, setFormImagesScale] = useState(2.0)
  const [formMaxFigures, setFormMaxFigures] = useState(20)

  // Editable form state for chunking
  const [formChunkingMethod, setFormChunkingMethod] = useState('TOKEN_SIZE')
  const [formChunkSize, setFormChunkSize] = useState(1200)
  const [formChunkOverlap, setFormChunkOverlap] = useState(100)
  const [formSemanticThreshold, setFormSemanticThreshold] = useState(0.5)
  const [formSemanticMinSize, setFormSemanticMinSize] = useState(50)
  const [formSemanticMaxTokens, setFormSemanticMaxTokens] = useState(500000)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getServerConfig()
      setConfig(data)
      // Populate form state from server config
      if (data.document_processing) {
        setFormEngine(data.document_processing.engine)
        setFormVisionEnabled(data.document_processing.vision_enabled)
        setFormVisionModel(data.document_processing.vision_model)
        setFormVisionBaseUrl(data.document_processing.vision_base_url)
        setFormVisionPrompt(data.document_processing.vision_prompt)
        setFormImagesScale(data.document_processing.docling_images_scale)
        setFormMaxFigures(data.document_processing.max_figures_per_doc)
      }
      // Populate chunking form state
      if (data.chunking) {
        setFormChunkingMethod(data.chunking.method)
        setFormChunkSize(data.chunking.chunk_size)
        setFormChunkOverlap(data.chunking.chunk_overlap_size)
        setFormSemanticThreshold(data.chunking.semantic_similarity_threshold)
        setFormSemanticMinSize(data.chunking.semantic_min_chunk_size)
        setFormSemanticMaxTokens(data.chunking.semantic_max_tokens)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isVisible) {
      fetchConfig()
    }
  }, [isVisible, fetchConfig])

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage(null)
    try {
      const update: DocumentProcessingConfigUpdate = {
        engine: formEngine,
        vision_enabled: formVisionEnabled,
        vision_model: formVisionModel,
        vision_base_url: formVisionBaseUrl,
        vision_prompt: formVisionPrompt,
        docling_images_scale: formImagesScale,
        max_figures_per_doc: formMaxFigures,
      }
      const chunkingUpdate: ChunkingConfigUpdate = {
        method: formChunkingMethod,
        chunk_size: formChunkSize,
        chunk_overlap_size: formChunkOverlap,
        semantic_similarity_threshold: formSemanticThreshold,
        semantic_min_chunk_size: formSemanticMinSize,
        semantic_max_tokens: formSemanticMaxTokens,
      }
      const result = await updateServerConfig({ document_processing: update, chunking: chunkingUpdate })
      setSaveMessage({
        type: 'success',
        text: result.message || `Updated ${result.updated_fields.length} field(s)`,
      })
      // Refresh config to show current state
      await fetchConfig()
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save configuration',
      })
    } finally {
      setSaving(false)
    }
  }

  // Auto-clear save message after 5 seconds (with cleanup on unmount)
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [saveMessage])

  const handleReset = () => {
    if (config?.document_processing) {
      setFormEngine(config.document_processing.engine)
      setFormVisionEnabled(config.document_processing.vision_enabled)
      setFormVisionModel(config.document_processing.vision_model)
      setFormVisionBaseUrl(config.document_processing.vision_base_url)
      setFormVisionPrompt(config.document_processing.vision_prompt)
      setFormImagesScale(config.document_processing.docling_images_scale)
      setFormMaxFigures(config.document_processing.max_figures_per_doc)
    }
    if (config?.chunking) {
      setFormChunkingMethod(config.chunking.method)
      setFormChunkSize(config.chunking.chunk_size)
      setFormChunkOverlap(config.chunking.chunk_overlap_size)
      setFormSemanticThreshold(config.chunking.semantic_similarity_threshold)
      setFormSemanticMinSize(config.chunking.semantic_min_chunk_size)
      setFormSemanticMaxTokens(config.chunking.semantic_max_tokens)
    }
  }

  const doclingAvailable = config?.document_processing?.docling_available ?? false

  return (
    <div className={`size-full overflow-auto p-6 ${isVisible ? '' : 'hidden'}`}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('docProcessingPanel.title', 'Document Processing')}
            </h1>
            <p className="text-muted-foreground">
              {t('docProcessingPanel.description', 'Configure how PDFs are extracted, how figures are described, and how text is chunked.')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfig}
            disabled={loading}
            tooltip={t('docProcessingPanel.refresh', 'Refresh')}
          >
            <RefreshCwIcon className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('docProcessingPanel.refresh', 'Refresh')}
          </Button>
        </div>

        {/* Loading state */}
        {loading && !config && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="text-muted-foreground">{t('docProcessingPanel.loading', 'Loading configuration...')}</p>
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

        {config && (
          <div className="space-y-6">
            {/* Section 1: Extraction Engine */}
            <SectionCard
              title={t('docProcessingPanel.engine.title', 'Extraction Engine')}
              description={t('docProcessingPanel.engine.description', 'Choose how PDFs are parsed. Docling provides layout-aware extraction with proper table and figure handling.')}
              icon={FileTextIcon}
              badge={
                <Badge variant={doclingAvailable ? 'default' : 'destructive'} className="text-xs">
                  {doclingAvailable
                    ? t('docProcessingPanel.engine.doclingAvailable', 'Docling Available')
                    : t('docProcessingPanel.engine.doclingUnavailable', 'Docling Not Installed')}
                </Badge>
              }
            >
              <div className="space-y-0">
                <FormRow
                  label={t('docProcessingPanel.engine.engineLabel', 'Engine')}
                  description={t('docProcessingPanel.engine.engineDesc', 'DEFAULT uses pypdf (text only). DOCLING preserves tables, figures, and structure.')}
                >
                  <Select value={formEngine} onValueChange={setFormEngine}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEFAULT">DEFAULT (pypdf)</SelectItem>
                      <SelectItem value="DOCLING">DOCLING</SelectItem>
                    </SelectContent>
                  </Select>
                </FormRow>
                <FormRow
                  label={t('docProcessingPanel.engine.imagesScaleLabel', 'Image Resolution Scale')}
                  description={t('docProcessingPanel.engine.imagesScaleDesc', 'Scale for extracted figure images. 1.0 = 72 DPI, 2.0 = 144 DPI. Higher = better quality but larger.')}
                >
                  <NumberInput
                    value={formImagesScale}
                    onValueChange={(v) => setFormImagesScale(v ?? 2.0)}
                    min={0.5}
                    max={4.0}
                    stepper={0.5}
                    className="w-32"
                  />
                </FormRow>
              </div>
            </SectionCard>

            {/* Section 2: Vision Model */}
            <SectionCard
              title={t('docProcessingPanel.vision.title', 'Vision Model')}
              description={t('docProcessingPanel.vision.description', 'When enabled, figures and charts are sent to a vision LLM for text descriptions that flow into the RAG pipeline.')}
              icon={EyeIcon}
              badge={
                formVisionEnabled ? (
                  <Badge variant="default" className="text-xs bg-emerald-500">
                    {t('docProcessingPanel.vision.enabled', 'Enabled')}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {t('docProcessingPanel.vision.disabled', 'Disabled')}
                  </Badge>
                )
              }
            >
              <div className="space-y-0">
                <FormRow
                  label={t('docProcessingPanel.vision.enabledLabel', 'Enable Vision')}
                  description={t('docProcessingPanel.vision.enabledDesc', 'Requires Docling engine. Each figure is sent to the vision model for description.')}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={formVisionEnabled}
                      onCheckedChange={(checked) => setFormVisionEnabled(checked === true)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {formVisionEnabled
                        ? t('docProcessingPanel.vision.willDescribe', 'Figures will be described by vision model')
                        : t('docProcessingPanel.vision.willSkip', 'Figures will not be processed')}
                    </span>
                  </div>
                </FormRow>
                <FormRow
                  label={t('docProcessingPanel.vision.modelLabel', 'Model')}
                  description={t('docProcessingPanel.vision.modelDesc', 'Vision-capable model ID (e.g., google/gemini-2.0-flash-001)')}
                >
                  <Input
                    value={formVisionModel}
                    onChange={(e) => setFormVisionModel(e.target.value)}
                    placeholder="google/gemini-2.0-flash-001"
                    className="max-w-md"
                    disabled={!formVisionEnabled}
                  />
                </FormRow>
                <FormRow
                  label={t('docProcessingPanel.vision.baseUrlLabel', 'API Base URL')}
                  description={t('docProcessingPanel.vision.baseUrlDesc', 'OpenAI-compatible API endpoint (e.g., OpenRouter, Azure)')}
                >
                  <Input
                    value={formVisionBaseUrl}
                    onChange={(e) => setFormVisionBaseUrl(e.target.value)}
                    placeholder="https://openrouter.ai/api/v1"
                    className="max-w-md"
                    disabled={!formVisionEnabled}
                  />
                </FormRow>
                <FormRow
                  label={t('docProcessingPanel.vision.maxFiguresLabel', 'Max Figures/Doc')}
                  description={t('docProcessingPanel.vision.maxFiguresDesc', 'Safety limit on vision API calls per document to control costs.')}
                >
                  <NumberInput
                    value={formMaxFigures}
                    onValueChange={(v) => setFormMaxFigures(v ?? 20)}
                    min={1}
                    max={100}
                    stepper={5}
                    className="w-32"
                    disabled={!formVisionEnabled}
                  />
                </FormRow>
                <FormRow
                  label={t('docProcessingPanel.vision.promptLabel', 'Vision Prompt')}
                  description={t('docProcessingPanel.vision.promptDesc', 'The text prompt sent alongside each figure image to the vision model.')}
                >
                  <Textarea
                    value={formVisionPrompt}
                    onChange={(e) => setFormVisionPrompt(e.target.value)}
                    rows={3}
                    className="max-w-lg"
                    disabled={!formVisionEnabled}
                  />
                </FormRow>
                <div className="mt-3 p-3 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground">
                    {t('docProcessingPanel.vision.apiKeyNote', 'API Key is configured server-side via the VISION_API_KEY environment variable for security. It cannot be changed from the UI.')}
                  </p>
                </div>
              </div>
            </SectionCard>

            {/* Section 3: Chunking Configuration (editable) */}
            <SectionCard
              title={t('docProcessingPanel.chunking.title', 'Chunking')}
              description={t('docProcessingPanel.chunking.description', 'How extracted text is split into chunks before entity extraction and embedding. Semantic chunking works well with Docling output.')}
              icon={SplitIcon}
            >
              <div className="space-y-0">
                <FormRow
                  label={t('docProcessingPanel.chunking.method', 'Method')}
                  description={t('docProcessingPanel.chunking.methodDesc', 'TOKEN_SIZE: fixed-size chunks. SEMANTIC: split by meaning shifts. HYBRID: semantic with token-size fallback.')}
                >
                  <Select value={formChunkingMethod} onValueChange={setFormChunkingMethod}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TOKEN_SIZE">TOKEN_SIZE</SelectItem>
                      <SelectItem value="SEMANTIC">SEMANTIC</SelectItem>
                      <SelectItem value="HYBRID">HYBRID</SelectItem>
                    </SelectContent>
                  </Select>
                </FormRow>
                <FormRow
                  label={t('docProcessingPanel.chunking.chunkSize', 'Chunk Size (tokens)')}
                  description={t('docProcessingPanel.chunking.chunkSizeDesc', 'Maximum tokens per chunk (100-10,000). Larger chunks retain more context but cost more per embedding.')}
                >
                  <NumberInput
                    value={formChunkSize}
                    onValueChange={(v) => setFormChunkSize(v ?? 1200)}
                    min={100}
                    max={10000}
                    stepper={100}
                    className="w-36"
                  />
                </FormRow>
                <FormRow
                  label={t('docProcessingPanel.chunking.overlap', 'Chunk Overlap (tokens)')}
                  description={t('docProcessingPanel.chunking.overlapDesc', 'Tokens shared between adjacent chunks (0-1,000). Must be less than chunk size.')}
                >
                  <NumberInput
                    value={formChunkOverlap}
                    onValueChange={(v) => setFormChunkOverlap(v ?? 100)}
                    min={0}
                    max={1000}
                    stepper={10}
                    className="w-36"
                  />
                </FormRow>
                {formChunkingMethod !== 'TOKEN_SIZE' && (
                  <>
                    <FormRow
                      label={t('docProcessingPanel.chunking.semanticThreshold', 'Semantic Threshold')}
                      description={t('docProcessingPanel.chunking.semanticThresholdDesc', 'Percentile threshold for semantic breakpoint detection (0.0-1.0). Higher = fewer, larger chunks.')}
                    >
                      <NumberInput
                        value={formSemanticThreshold}
                        onValueChange={(v) => setFormSemanticThreshold(v ?? 0.5)}
                        min={0}
                        max={1}
                        stepper={0.05}
                        decimalScale={2}
                        fixedDecimalScale
                        className="w-36"
                      />
                    </FormRow>
                    <FormRow
                      label={t('docProcessingPanel.chunking.semanticMinSize', 'Semantic Min Chunk Size')}
                      description={t('docProcessingPanel.chunking.semanticMinSizeDesc', 'Minimum tokens per semantic chunk (10-1,000). Prevents overly small fragments.')}
                    >
                      <NumberInput
                        value={formSemanticMinSize}
                        onValueChange={(v) => setFormSemanticMinSize(v ?? 50)}
                        min={10}
                        max={1000}
                        stepper={10}
                        className="w-36"
                      />
                    </FormRow>
                    <FormRow
                      label={t('docProcessingPanel.chunking.semanticMaxTokens', 'Semantic Max Tokens')}
                      description={t('docProcessingPanel.chunking.semanticMaxTokensDesc', 'Maximum content tokens before falling back to token-based chunking (1,000-500,000).')}
                    >
                      <NumberInput
                        value={formSemanticMaxTokens}
                        onValueChange={(v) => setFormSemanticMaxTokens(v ?? 500000)}
                        min={1000}
                        max={500000}
                        stepper={1000}
                        className="w-44"
                      />
                    </FormRow>
                  </>
                )}
                <div className="mt-3 p-3 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground">
                    {t('docProcessingPanel.chunking.note', 'TOKEN_SIZE splits by fixed token count. SEMANTIC detects meaning shifts via embedding similarity. HYBRID uses semantic splitting with a token-size safety net for very large documents.')}
                  </p>
                </div>
              </div>
            </SectionCard>

            {/* Section 4: Entity Extraction (read-only) */}
            <SectionCard
              title={t('docProcessingPanel.extraction.title', 'Entity Extraction')}
              description={t('docProcessingPanel.extraction.description', 'How entities and relationships are extracted from chunks. Configure via .env file.')}
              icon={NetworkIcon}
            >
              <div className="space-y-0">
                <ReadOnlyRow
                  label={t('docProcessingPanel.extraction.language', 'Language')}
                  value={config.entity_extraction.summary_language}
                />
                <ReadOnlyRow
                  label={t('docProcessingPanel.extraction.maxGleaning', 'Max Gleaning Iterations')}
                  value={config.entity_extraction.max_gleaning}
                />
                <ReadOnlyRow
                  label={t('docProcessingPanel.extraction.maxInputTokens', 'Max Extract Input Tokens')}
                  value={config.entity_extraction.max_extract_input_tokens}
                />
                <ReadOnlyRow
                  label={t('docProcessingPanel.extraction.forceMerge', 'Force Summary on Merge')}
                  value={config.entity_extraction.force_llm_summary_on_merge}
                />
                <div className="py-2">
                  <span className="text-sm text-muted-foreground">
                    {t('docProcessingPanel.extraction.entityTypesLabel', 'Entity Types')}
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {config.entity_extraction.entity_types.map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Save/Reset Footer */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  <SaveIcon className={`size-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
                  {saving
                    ? t('docProcessingPanel.saving', 'Saving...')
                    : t('docProcessingPanel.save', 'Save Changes')}
                </Button>
                <Button variant="outline" onClick={handleReset} disabled={saving}>
                  <RotateCcwIcon className="size-4 mr-2" />
                  {t('docProcessingPanel.reset', 'Reset')}
                </Button>
              </div>
              {saveMessage && (
                <div
                  className={`flex items-center gap-2 text-sm ${
                    saveMessage.type === 'success' ? 'text-emerald-600' : 'text-destructive'
                  }`}
                >
                  {saveMessage.type === 'success' ? (
                    <CheckCircle2Icon className="size-4" />
                  ) : (
                    <AlertCircleIcon className="size-4" />
                  )}
                  {saveMessage.text}
                </div>
              )}
            </div>

            {/* Info Note */}
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  {t('docProcessingPanel.infoNote', 'Changes apply immediately to new document uploads but reset on server restart. For persistent configuration, update the .env file.')}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
