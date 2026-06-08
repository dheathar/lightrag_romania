import { useState, memo } from 'react'
import { KnowledgeInsights, KGEntity, KGRelationship } from '@/api/lightrag'
import { ChevronDownIcon, BrainIcon, NetworkIcon, LinkIcon, SparklesIcon, LoaderIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface KnowledgeInsightsPanelProps {
  insights: KnowledgeInsights
  isGeneratingReasoning?: boolean
}

const entityTypeColors: Record<string, string> = {
  'PERSON': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'ORGANIZATION': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  'LOCATION': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  'EVENT': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  'CONCEPT': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  'TECHNOLOGY': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  'POLICY': 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  'DOCUMENT': 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  'DEFAULT': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
}

const getEntityColor = (type: string): string => {
  const upperType = type?.toUpperCase() || 'DEFAULT'
  return entityTypeColors[upperType] || entityTypeColors['DEFAULT']
}

const EntityCard = memo(({ entity }: { entity: KGEntity }) => {
  const [expanded, setExpanded] = useState(false)
  const hasDescription = entity.description && entity.description.length > 50

  return (
    <div
      className={cn(
        'lumen-glass-soft p-2.5 rounded-xl transition-shadow hover:shadow-[0_8px_20px_-12px_rgba(146,80,31,0.4)]',
        hasDescription && 'cursor-pointer'
      )}
      onClick={() => hasDescription && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <span className={cn('px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase shrink-0', getEntityColor(entity.entity_type))}>
          {entity.entity_type || 'ENTITY'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-xs text-foreground truncate" title={entity.entity_name}>
            {entity.entity_name}
          </div>
          {entity.description && (
            <div className={cn('text-[10px] text-muted-foreground mt-0.5', !expanded && 'line-clamp-2')}>
              {entity.description}
            </div>
          )}
        </div>
        {hasDescription && (
          <ChevronDownIcon className={cn('w-3 h-3 text-muted-foreground shrink-0 transition-transform', expanded && 'rotate-180')} />
        )}
      </div>
    </div>
  )
})
EntityCard.displayName = 'EntityCard'

const RelationshipCard = memo(({ relationship }: { relationship: KGRelationship }) => {
  const [expanded, setExpanded] = useState(false)
  const hasDescription = relationship.description && relationship.description.length > 30

  return (
    <div
      className={cn(
        'lumen-glass-soft p-2.5 rounded-xl transition-shadow hover:shadow-[0_8px_20px_-12px_rgba(146,80,31,0.4)]',
        hasDescription && 'cursor-pointer'
      )}
      onClick={() => hasDescription && setExpanded(!expanded)}
    >
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-semibold text-foreground truncate max-w-[80px]" title={relationship.src_id}>
          {relationship.src_id}
        </span>
        <span className="text-primary shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10">→</span>
        <span className="font-semibold text-foreground truncate max-w-[80px]" title={relationship.tgt_id}>
          {relationship.tgt_id}
        </span>
        {relationship.weight !== undefined && (
          <span className="ml-auto text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
            {(relationship.weight * 100).toFixed(0)}%
          </span>
        )}
      </div>
      {relationship.keywords && (
        <div className="flex flex-wrap gap-1 mt-1">
          {relationship.keywords.split(',').slice(0, 3).map((keyword, idx) => (
            <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {keyword.trim()}
            </span>
          ))}
        </div>
      )}
      {relationship.description && (
        <div className={cn('text-[10px] text-muted-foreground mt-1', !expanded && 'line-clamp-1')}>
          {relationship.description}
        </div>
      )}
    </div>
  )
})
RelationshipCard.displayName = 'RelationshipCard'

export const KnowledgeInsightsPanel = memo(({ insights, isGeneratingReasoning }: KnowledgeInsightsPanelProps) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState<'entities' | 'relations'>('entities')

  const hasEntities = insights.entities && insights.entities.length > 0
  const hasRelationships = insights.relationships && insights.relationships.length > 0
  const hasContent = hasEntities || hasRelationships || insights.reasoning

  if (!hasContent && !isGeneratingReasoning) return null

  const stats = insights.processingInfo || {}

  return (
    <div className="mt-3 pt-3 border-t border-primary/15">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
          <SparklesIcon className="w-3.5 h-3.5" />
          <span>{t('retrievePanel.insights.title', 'Knowledge Insights')}</span>
          {(hasEntities || hasRelationships) && (
            <span className="text-[10px] font-medium text-muted-foreground bg-white/60 dark:bg-white/10 px-2 py-0.5 rounded-full">
              {(insights.entities?.length || 0) + (insights.relationships?.length || 0)}
            </span>
          )}
        </div>
        <ChevronDownIcon className={cn('w-4 h-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-2.5">
          {(insights.reasoning || isGeneratingReasoning) && (
            <div className="lumen-reason p-3 rounded-xl">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary mb-1.5">
                <BrainIcon className="w-3.5 h-3.5" />
                <span>{t('retrievePanel.insights.reasoning', 'AI Reasoning')}</span>
                {isGeneratingReasoning && <LoaderIcon className="w-3 h-3 animate-spin" />}
              </div>
              {insights.reasoning ? (
                <p className="text-[11px] text-foreground/85 leading-relaxed">{insights.reasoning}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground italic">
                  {t('retrievePanel.insights.generatingReasoning', 'Analyzing knowledge graph context...')}
                </p>
              )}
            </div>
          )}

          {insights.keywords && (
            <div className="flex flex-wrap gap-1.5">
              {insights.keywords.high_level?.map((kw, idx) => (
                <span key={`high-${idx}`} className="text-[10px] px-2.5 py-1 rounded-full bg-primary/12 text-primary font-medium">
                  {kw}
                </span>
              ))}
              {insights.keywords.low_level?.slice(0, 5).map((kw, idx) => (
                <span key={`low-${idx}`} className="text-[10px] px-2.5 py-1 rounded-full bg-white/55 dark:bg-white/5 text-muted-foreground border border-white/60 dark:border-white/10">
                  {kw}
                </span>
              ))}
            </div>
          )}

          {(hasEntities || hasRelationships) && (
            <div className="flex gap-1 border-b border-border/40">
              <button
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold transition-colors',
                  activeTab === 'entities' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={(e) => { e.stopPropagation(); setActiveTab('entities') }}
              >
                <NetworkIcon className="w-3 h-3" />
                {t('retrievePanel.insights.entities', 'Entities')} ({insights.entities?.length || 0})
              </button>
              <button
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold transition-colors',
                  activeTab === 'relations' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={(e) => { e.stopPropagation(); setActiveTab('relations') }}
              >
                <LinkIcon className="w-3 h-3" />
                {t('retrievePanel.insights.relations', 'Relations')} ({insights.relationships?.length || 0})
              </button>
            </div>
          )}

          <div className="max-h-[220px] overflow-y-auto space-y-2 pr-0.5">
            {activeTab === 'entities' && hasEntities && (
              insights.entities.slice(0, 10).map((entity, idx) => (
                <EntityCard key={`entity-${idx}`} entity={entity} />
              ))
            )}
            {activeTab === 'relations' && hasRelationships && (
              insights.relationships.slice(0, 10).map((rel, idx) => (
                <RelationshipCard key={`rel-${idx}`} relationship={rel} />
              ))
            )}
            {activeTab === 'entities' && !hasEntities && (
              <p className="text-[10px] text-muted-foreground italic py-2 text-center">
                {t('retrievePanel.insights.noEntities', 'No entities found for this query')}
              </p>
            )}
            {activeTab === 'relations' && !hasRelationships && (
              <p className="text-[10px] text-muted-foreground italic py-2 text-center">
                {t('retrievePanel.insights.noRelations', 'No relationships found for this query')}
              </p>
            )}
          </div>

          {Object.keys(stats).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1.5 border-t border-border/30 text-[9px] text-muted-foreground">
              {stats.total_entities_found !== undefined && <span>Found: {stats.total_entities_found} entities</span>}
              {stats.total_relations_found !== undefined && <span>| {stats.total_relations_found} relations</span>}
              {stats.final_chunks_count !== undefined && <span>| {stats.final_chunks_count} chunks</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
KnowledgeInsightsPanel.displayName = 'KnowledgeInsightsPanel'

export default KnowledgeInsightsPanel
