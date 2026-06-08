import React from 'react'
import { useTranslation } from 'react-i18next'
import { useGraphStore } from '@/stores/graph'
import { Card } from '@/components/ui/Card'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { InfoIcon } from 'lucide-react'

interface LegendProps {
  className?: string
}

// Helper function to get user-friendly descriptions for node types
const getNodeTypeDescription = (type: string): string => {
  const descriptions: Record<string, string> = {
    'person': 'People, names, individuals mentioned in documents',
    'organization': 'Companies, institutions, groups, teams',
    'location': 'Places, addresses, geographical locations',
    'event': 'Actions, occurrences, meetings, incidents',
    'concept': 'Ideas, theories, abstract topics, themes',
    'method': 'Processes, techniques, procedures, approaches',
    'content': 'Data, information, specific content items',
    'data': 'Numerical data, statistics, measurements',
    'artifact': 'Objects, tools, products, creations',
    'naturalobject': 'Natural phenomena, objects from nature',
    'creature': 'Animals, organisms, living beings',
    'default': 'Entities extracted from your documents'
  }

  return descriptions[type.toLowerCase()] || descriptions['default']
}

const Legend: React.FC<LegendProps> = ({ className }) => {
  const { t } = useTranslation()
  const typeColorMap = useGraphStore.use.typeColorMap()
  const sigmaGraph = useGraphStore.use.sigmaGraph()

  // Calculate statistics
  const totalNodes = sigmaGraph?.order || 0
  const totalEdges = sigmaGraph?.size || 0

  // Count nodes by type
  const typeCounts = React.useMemo(() => {
    if (!sigmaGraph) return new Map()

    const counts = new Map<string, number>()
    sigmaGraph.forEachNode((node, attributes) => {
      const type = attributes.type || 'Unknown'
      counts.set(type, (counts.get(type) || 0) + 1)
    })
    return counts
  }, [sigmaGraph])

  if (!typeColorMap || typeColorMap.size === 0) {
    return null
  }

  return (
    <Card className={`p-3 max-w-sm ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold">{t('graphPanel.legend', 'Knowledge Graph Legend')}</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="w-3 h-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-xs">
                {t('graphPanel.legendHelp', 'This shows the types of information extracted from your documents and how they\'re connected.')}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Statistics Section */}
      <div className="mb-3 p-2 bg-muted/30 rounded-md">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Total Entities:</span>
            <span className="ml-1 font-semibold">{totalNodes}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Connections:</span>
            <span className="ml-1 font-semibold">{totalEdges}</span>
          </div>
        </div>
      </div>

      {/* Node Types Section */}
      <h4 className="text-xs font-medium text-muted-foreground mb-2">
        {t('graphPanel.entityTypes', 'Entity Types')}
      </h4>
      <ScrollArea className="max-h-64">
        <div className="flex flex-col gap-1.5">
          {Array.from(typeColorMap.entries())
            .sort(([typeA], [typeB]) => {
              // Sort by count (highest first), then alphabetically
              const countA = typeCounts.get(typeA) || 0
              const countB = typeCounts.get(typeB) || 0
              if (countA !== countB) return countB - countA
              return typeA.localeCompare(typeB)
            })
            .map(([type, color]) => {
              const count = typeCounts.get(type) || 0
              const description = getNodeTypeDescription(type)

              return (
                <TooltipProvider key={type}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors cursor-help">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0 border border-border/30"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium truncate" title={type}>
                              {t(`graphPanel.nodeTypes.${type.toLowerCase().replace(/\s+/g, '')}`, type)}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                              {count}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p className="text-xs">{description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })}
        </div>
      </ScrollArea>

      {/* Help Section */}
      <div className="mt-3 pt-2 border-t border-border/30">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong>{t('graphPanel.howToUse', 'How to use')}:</strong> {' '}
          {t('graphPanel.legendInstructions', 'Hover over nodes to see details. Click to select. Lines show relationships between entities.')}
        </p>
      </div>
    </Card>
  )
}

export default Legend
