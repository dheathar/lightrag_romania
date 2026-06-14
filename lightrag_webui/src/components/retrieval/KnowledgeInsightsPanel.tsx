import { useState, memo } from 'react'
import { KnowledgeInsights, KGEntity, KGRelationship, KGChunk } from '@/api/lightrag'
import { BrainIcon, LoaderIcon, FileTextIcon, InfoIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface KnowledgeInsightsPanelProps {
  insights: KnowledgeInsights
  isGeneratingReasoning?: boolean
}

// [dot bg class, badge bg class, badge text class]
type ColorConfig = [string, string, string]

const entityTypeConfig: Record<string, ColorConfig> = {
  'ORGANIZATION':   ['bg-purple-400',  'bg-purple-100 dark:bg-purple-900/40',  'text-purple-700 dark:text-purple-300'],
  'PERSON':         ['bg-blue-400',    'bg-blue-100 dark:bg-blue-900/40',      'text-blue-700 dark:text-blue-300'],
  'LOCATION':       ['bg-green-400',   'bg-green-100 dark:bg-green-900/40',    'text-green-700 dark:text-green-300'],
  'PROJECT':        ['bg-indigo-400',  'bg-indigo-100 dark:bg-indigo-900/40',  'text-indigo-700 dark:text-indigo-300'],
  'PROGRAMME':      ['bg-violet-400',  'bg-violet-100 dark:bg-violet-900/40',  'text-violet-700 dark:text-violet-300'],
  'REGULATION':     ['bg-rose-400',    'bg-rose-100 dark:bg-rose-900/40',      'text-rose-700 dark:text-rose-300'],
  'INDICATOR':      ['bg-amber-400',   'bg-amber-100 dark:bg-amber-900/40',    'text-amber-700 dark:text-amber-300'],
  'ACTIVITY':       ['bg-orange-400',  'bg-orange-100 dark:bg-orange-900/40',  'text-orange-700 dark:text-orange-300'],
  'POLICY':         ['bg-rose-500',    'bg-rose-100 dark:bg-rose-900/40',      'text-rose-700 dark:text-rose-300'],
  'FINANCIALDATA':  ['bg-emerald-400', 'bg-emerald-100 dark:bg-emerald-900/40','text-emerald-700 dark:text-emerald-300'],
  'BENEFICIARY':    ['bg-teal-400',    'bg-teal-100 dark:bg-teal-900/40',      'text-teal-700 dark:text-teal-300'],
  'FINDING':        ['bg-yellow-400',  'bg-yellow-100 dark:bg-yellow-900/40',  'text-yellow-700 dark:text-yellow-300'],
  'GEOGRAPHICUNIT': ['bg-lime-400',    'bg-lime-100 dark:bg-lime-900/40',      'text-lime-700 dark:text-lime-300'],
  'DOCUMENT':       ['bg-amber-500',   'bg-amber-100 dark:bg-amber-900/40',    'text-amber-700 dark:text-amber-300'],
  'CONCEPT':        ['bg-cyan-400',    'bg-cyan-100 dark:bg-cyan-900/40',      'text-cyan-700 dark:text-cyan-300'],
  // Legacy fallbacks
  'EVENT':          ['bg-orange-400',  'bg-orange-100 dark:bg-orange-900/40',  'text-orange-700 dark:text-orange-300'],
  'TECHNOLOGY':     ['bg-indigo-400',  'bg-indigo-100 dark:bg-indigo-900/40',  'text-indigo-700 dark:text-indigo-300'],
  'DEFAULT':        ['bg-gray-400',    'bg-gray-100 dark:bg-gray-800/40',      'text-gray-700 dark:text-gray-300'],
}

const getTypeConfig = (type: string): ColorConfig => {
  const upper = type?.toUpperCase() || 'DEFAULT'
  return entityTypeConfig[upper] || entityTypeConfig['DEFAULT']
}

const SectionLabel = ({ children, info }: { children: React.ReactNode; info?: string }) => (
  <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
    <span>{children}</span>
    {info && (
      <span title={info} className="cursor-help">
        <InfoIcon className="w-3 h-3 opacity-50 hover:opacity-100 transition-opacity" />
      </span>
    )}
  </div>
)

const EntityCard = memo(({ entity }: { entity: KGEntity }) => {
  const [expanded, setExpanded] = useState(false)
  const hasDescription = entity.description && entity.description.length > 50
  const [dotClass, badgeBg, badgeText] = getTypeConfig(entity.entity_type)

  return (
    <div
      className={cn(
        'lumen-glass-soft p-3 rounded-xl transition-shadow',
        hasDescription && 'cursor-pointer hover:shadow-[0_8px_20px_-12px_rgba(146,80,31,0.4)]'
      )}
      onClick={() => hasDescription && setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />
        <span className="font-semibold text-xs text-foreground flex-1 truncate" title={entity.entity_name}>
          {entity.entity_name}
        </span>
        <span className={cn('text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md shrink-0', badgeBg, badgeText)}>
          {entity.entity_type || 'ENTITY'}
        </span>
      </div>
      {entity.description && (
        <div className={cn('text-[11px] text-muted-foreground mt-1.5 leading-relaxed pl-4', !expanded && 'line-clamp-2')}>
          {entity.description}
        </div>
      )}
    </div>
  )
})
EntityCard.displayName = 'EntityCard'

const RelationshipCard = memo(({ relationship }: { relationship: KGRelationship }) => {
  const [expanded, setExpanded] = useState(false)
  const hasDescription = relationship.description && relationship.description.length > 30
  const verb = relationship.keywords
    ? relationship.keywords.split(',')[0].trim()
    : '→'

  return (
    <div
      className={cn(
        'lumen-glass-soft px-3 py-2.5 rounded-xl transition-shadow',
        hasDescription && 'cursor-pointer hover:shadow-[0_8px_20px_-12px_rgba(146,80,31,0.4)]'
      )}
      onClick={() => hasDescription && setExpanded(!expanded)}
    >
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        <span className="font-semibold text-foreground truncate max-w-[90px]" title={relationship.src_id}>
          {relationship.src_id}
        </span>
        <span className="text-primary text-[10px] font-medium italic shrink-0">
          {verb}
        </span>
        <span className="font-semibold text-foreground truncate max-w-[90px]" title={relationship.tgt_id}>
          {relationship.tgt_id}
        </span>
      </div>
      {hasDescription && (
        <div className={cn('text-[11px] text-muted-foreground mt-1 leading-relaxed', !expanded && 'line-clamp-1')}>
          {relationship.description}
        </div>
      )}
    </div>
  )
})
RelationshipCard.displayName = 'RelationshipCard'

const SourceCard = memo(({ chunk }: { chunk: KGChunk }) => {
  const [expanded, setExpanded] = useState(false)
  const fileName = chunk.file_path?.split('/').pop() || chunk.file_path || 'Unknown source'
  const preview = chunk.content?.slice(0, 150) || ''
  const hasMore = (chunk.content?.length || 0) > 150

  return (
    <div
      className={cn(
        'lumen-glass-soft p-3 rounded-xl transition-shadow',
        hasMore && 'cursor-pointer hover:shadow-[0_8px_20px_-12px_rgba(146,80,31,0.4)]'
      )}
      onClick={() => hasMore && setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <FileTextIcon className="w-3 h-3 shrink-0 text-primary" />
        <span className="font-semibold text-xs text-foreground truncate flex-1" title={chunk.file_path}>
          {fileName}
        </span>
      </div>
      <div className={cn('text-[11px] text-muted-foreground leading-relaxed', !expanded && 'line-clamp-3')}>
        {expanded ? chunk.content : preview}{hasMore && !expanded && '…'}
      </div>
    </div>
  )
})
SourceCard.displayName = 'SourceCard'

export const KnowledgeInsightsPanel = memo(({ insights, isGeneratingReasoning }: KnowledgeInsightsPanelProps) => {
  const { t } = useTranslation()
  const hasEntities = insights.entities && insights.entities.length > 0
  const hasRelationships = insights.relationships && insights.relationships.length > 0
  const hasHighKeywords = insights.keywords?.high_level && insights.keywords.high_level.length > 0
  const hasLowKeywords = insights.keywords?.low_level && insights.keywords.low_level.length > 0
  const hasKeywords = hasHighKeywords || hasLowKeywords
  const hasAnything = hasEntities || hasRelationships || hasKeywords || insights.reasoning || isGeneratingReasoning

  if (!hasAnything) return null

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-0.5 pb-2">

      {/* AI REASONING */}
      {(insights.reasoning || isGeneratingReasoning) && (
        <div>
          <SectionLabel>AI REASONING</SectionLabel>
          <div className="lumen-reason p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary mb-1.5">
              <BrainIcon className="w-3.5 h-3.5" />
              <span>Synthesis over retrieved graph</span>
              {isGeneratingReasoning && <LoaderIcon className="w-3 h-3 animate-spin ml-auto" />}
            </div>
            {insights.reasoning ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                className="prose dark:prose-invert max-w-none text-[11px] leading-relaxed text-foreground/85 prose-p:my-1 prose-headings:text-[12px] prose-headings:font-semibold prose-headings:my-1.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-strong:font-semibold"
              >
                {insights.reasoning}
              </ReactMarkdown>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">
                {t('retrievePanel.insights.generatingReasoning', 'Analyzing knowledge graph context...')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ENTITIES */}
      {hasEntities && (
        <div>
          <SectionLabel info={t('retrievePanel.insights.entitiesTooltip', 'Entities are the key things the system found in your documents — organisations, people, places, programmes, indicators, and concepts. They are the nodes of the knowledge map.')}>{t('retrievePanel.insights.entities', 'ENTITIES')}</SectionLabel>
          <div className="space-y-2">
            {insights.entities.slice(0, 10).map((entity, idx) => (
              <EntityCard key={`entity-${idx}`} entity={entity} />
            ))}
          </div>
        </div>
      )}

      {/* RELATIONSHIPS */}
      {hasRelationships && (
        <div>
          <SectionLabel info={t('retrievePanel.insights.relationsTooltip', 'Relationships are the connections between entities — how a programme relates to an authority, an indicator, or a finding. They are the links of the knowledge map.')}>{t('retrievePanel.insights.relations', 'RELATIONSHIPS')}</SectionLabel>
          <div className="space-y-2">
            {insights.relationships.slice(0, 10).map((rel, idx) => (
              <RelationshipCard key={`rel-${idx}`} relationship={rel} />
            ))}
          </div>
        </div>
      )}

      {/* KEYWORDS */}
      {hasKeywords && (
        <div>
          <SectionLabel>KEYWORDS</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {insights.keywords.high_level?.map((kw, idx) => (
              <span key={`high-${idx}`} className="text-[10px] px-2.5 py-1 rounded-full bg-primary/12 text-primary font-medium">
                {kw}
              </span>
            ))}
            {insights.keywords.low_level?.slice(0, 6).map((kw, idx) => (
              <span key={`low-${idx}`} className="text-[10px] px-2.5 py-1 rounded-full bg-white/55 dark:bg-white/5 text-muted-foreground border border-white/60 dark:border-white/10">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SOURCES */}
      {insights.chunks && insights.chunks.length > 0 && (
        <div>
          <SectionLabel>SOURCES</SectionLabel>
          <div className="space-y-2">
            {insights.chunks.slice(0, 8).map((chunk, idx) => (
              <SourceCard key={`chunk-${idx}`} chunk={chunk} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
KnowledgeInsightsPanel.displayName = 'KnowledgeInsightsPanel'

export default KnowledgeInsightsPanel
