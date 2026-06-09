import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/Dialog'
import {
  InfoIcon,
  FileTextIcon,
  NetworkIcon,
  SearchIcon,
  ChartBarIcon,
  TagsIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from 'lucide-react'

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  color: string
}

function FeatureCard({ icon, title, description, color }: FeatureCardProps) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-muted/30">
      <div className={`shrink-0 mt-0.5 ${color}`}>{icon}</div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
    </div>
  )
}

interface TabGuideProps {
  color: string
  label: string
  description: string
}

function TabGuide({ color, label, description }: TabGuideProps) {
  return (
    <div className="flex items-start gap-2">
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium text-white shrink-0 ${color}`}>
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </div>
  )
}

function EntityTypeBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
      {label}
    </span>
  )
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm font-semibold hover:text-primary transition-colors cursor-pointer w-full text-left"
      >
        {open ? (
          <ChevronDownIcon className="size-4 shrink-0" />
        ) : (
          <ChevronRightIcon className="size-4 shrink-0" />
        )}
        {title}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}

const DEFAULT_ENTITY_TYPES = [
  'Organization', 'Person', 'Location', 'Project', 'Programme',
  'Regulation', 'Indicator', 'Activity', 'Policy', 'FinancialData',
  'Beneficiary', 'Finding', 'GeographicUnit', 'Document', 'Concept',
]

const DOMAIN_ENTITY_TYPES = [
  'Programme', 'ManagingAuthority', 'Beneficiary', 'Project',
  'Indicator', 'Budget', 'Country', 'Region', 'Regulation',
  'Recommendation', 'ThematicObjective', 'Priority',
  'Document', 'Event', 'Organization', 'Person',
]

export default function AboutDialog() {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const { coreVersion, apiVersion } = useAuthStore()

  const versionDisplay = (coreVersion && apiVersion)
    ? `${coreVersion} / ${apiVersion}`
    : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        className="ml-2 self-center px-2.5 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors cursor-pointer font-medium"
      >
        {t('about.button')}
      </button>
      <DialogContent className="max-w-[720px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <InfoIcon className="size-5 text-blue-500" />
            {t('about.title')}
          </DialogTitle>
          <DialogDescription>
            {t('about.subtitle')}
          </DialogDescription>
        </DialogHeader>

        {/* Project description */}
        <div className="text-sm text-foreground leading-relaxed">
          {t('about.description')}
        </div>

        {/* Key Features */}
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('about.featuresTitle')}</h3>
          <div className="grid grid-cols-1 gap-2">
            <FeatureCard
              icon={<FileTextIcon className="size-4" />}
              title={t('about.features.multimodal')}
              description={t('about.features.multimodalDesc')}
              color="text-emerald-500"
            />
            <FeatureCard
              icon={<NetworkIcon className="size-4" />}
              title={t('about.features.knowledgeGraph')}
              description={t('about.features.knowledgeGraphDesc')}
              color="text-emerald-500"
            />
            <FeatureCard
              icon={<TagsIcon className="size-4" />}
              title={t('about.features.taxonomy')}
              description={t('about.features.taxonomyDesc')}
              color="text-violet-500"
            />
            <FeatureCard
              icon={<SearchIcon className="size-4" />}
              title={t('about.features.hybridRetrieval')}
              description={t('about.features.hybridRetrievalDesc')}
              color="text-blue-500"
            />
            <FeatureCard
              icon={<ChartBarIcon className="size-4" />}
              title={t('about.features.evaluation')}
              description={t('about.features.evaluationDesc')}
              color="text-amber-500"
            />
          </div>
        </div>

        {/* Entity Taxonomy Section */}
        <div className="border rounded-lg p-4 bg-muted/20">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TagsIcon className="size-4 text-violet-500" />
            {t('about.taxonomy.title')}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t('about.taxonomy.description')}
          </p>

          {/* Default Entity Types */}
          <CollapsibleSection title={t('about.taxonomy.defaultTitle')} defaultOpen={false}>
            <p className="text-xs text-muted-foreground mb-2">
              {t('about.taxonomy.defaultDesc')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_ENTITY_TYPES.map((type) => (
                <EntityTypeBadge
                  key={type}
                  label={type}
                  color="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                />
              ))}
            </div>
          </CollapsibleSection>

          <div className="my-2 border-t" />

          {/* Domain Entity Types */}
          <CollapsibleSection title={t('about.taxonomy.domainTitle')} defaultOpen={true}>
            <p className="text-xs text-muted-foreground mb-2">
              {t('about.taxonomy.domainDesc')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DOMAIN_ENTITY_TYPES.map((type, i) => {
                // Color by category: structural (violet), financial (emerald), geographic (blue), regulatory (amber), generic (gray)
                const structuralTypes = ['Programme', 'Project', 'ThematicObjective', 'Priority']
                const authorityTypes = ['ManagingAuthority', 'Beneficiary', 'Organization', 'Person']
                const financialTypes = ['Budget', 'Indicator']
                const geoTypes = ['Country', 'Region']
                const regulatoryTypes = ['Regulation', 'Recommendation', 'Document']

                let color = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                if (structuralTypes.includes(type)) color = 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                else if (authorityTypes.includes(type)) color = 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                else if (financialTypes.includes(type)) color = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                else if (geoTypes.includes(type)) color = 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
                else if (regulatoryTypes.includes(type)) color = 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'

                return <EntityTypeBadge key={`${type}-${i}`} label={type} color={color} />
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-violet-400" /> {t('about.taxonomy.legend.structural')}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400" /> {t('about.taxonomy.legend.institutional')}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" /> {t('about.taxonomy.legend.financial')}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" /> {t('about.taxonomy.legend.geographic')}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> {t('about.taxonomy.legend.regulatory')}
              </span>
            </div>
          </CollapsibleSection>

          <div className="mt-3 text-[10px] text-muted-foreground italic border-t pt-2">
            {t('about.taxonomy.extensible')}
          </div>
        </div>

        {/* Chat Prefix Guide */}
        <CollapsibleSection title={t('about.chatPrefixTitle')}>
          <p className="text-xs text-muted-foreground mb-3">{t('about.chatPrefixDesc')}</p>
          <div className="space-y-2">
            {([
              ['local',  '/local your question'],
              ['global', '/global your question'],
              ['hybrid', '/hybrid your question'],
              ['naive',  '/naive your question'],
              ['mix',    '/mix your question'],
              ['bypass', '/bypass your question'],
            ] as const).map(([key, example]) => (
              <div key={key} className="flex gap-3 items-start">
                <code className="shrink-0 text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                  /{key}
                </code>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-foreground">{t(`about.chatPrefixes.${key}`)}</span>
                  <span className="text-[10px] text-muted-foreground italic">{t('about.chatPrefixExample')}: <code className="font-mono">{example}</code></span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Tab Guide */}
        <CollapsibleSection title={t('about.tabGuideTitle')}>
          <div className="space-y-2">
            <TabGuide color="bg-emerald-500" label={t('header.documents')} description={t('about.tabs.documents')} />
            <TabGuide color="bg-emerald-500" label={t('header.docProcessing')} description={t('about.tabs.docProcessing')} />
            <TabGuide color="bg-emerald-500" label={t('header.knowledgeGraph')} description={t('about.tabs.knowledgeGraph')} />
            <TabGuide color="bg-blue-500" label={t('header.retrieval')} description={t('about.tabs.retrieval')} />
            <TabGuide color="bg-amber-500" label={t('header.evaluation')} description={t('about.tabs.evaluation')} />
            <TabGuide color="bg-slate-400" label={t('header.api')} description={t('about.tabs.api')} />
            <TabGuide color="bg-slate-400" label={t('header.settings')} description={t('about.tabs.settings')} />
          </div>
        </CollapsibleSection>

        {/* Version info */}
        {versionDisplay && (
          <div className="text-xs text-muted-foreground border-t pt-3">
            {t('about.version')}: {versionDisplay}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
