import { useSettingsStore } from '@/stores/settings'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  FileTextIcon,
  CpuIcon,
  NetworkIcon,
  SearchIcon,
  BarChart2Icon,
  CodeIcon,
  SettingsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'

interface NavItem {
  tab: string
  icon: React.ElementType
  labelKey: string
  defaultLabel: string
}

interface NavGroup {
  labelKey: string
  defaultLabel: string
  headerColor: string
  activeColor: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'sidebar.knowledgePipeline',
    defaultLabel: 'Knowledge Pipeline',
    headerColor: 'text-emerald-600 dark:text-emerald-400',
    activeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold',
    items: [
      { tab: 'documents', icon: FileTextIcon, labelKey: 'header.documents', defaultLabel: 'Documents' },
      { tab: 'doc-processing', icon: CpuIcon, labelKey: 'header.docProcessing', defaultLabel: 'Doc Processing' },
      { tab: 'knowledge-graph', icon: NetworkIcon, labelKey: 'header.knowledgeGraph', defaultLabel: 'Knowledge Graph' },
    ],
  },
  {
    labelKey: 'sidebar.queryTest',
    defaultLabel: 'Query & Test',
    headerColor: 'text-blue-600 dark:text-blue-400',
    activeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold',
    items: [
      { tab: 'retrieval', icon: SearchIcon, labelKey: 'header.retrieval', defaultLabel: 'Retrieval Testing' },
    ],
  },
  {
    labelKey: 'sidebar.quality',
    defaultLabel: 'Quality',
    headerColor: 'text-amber-600 dark:text-amber-400',
    activeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold',
    items: [
      { tab: 'evaluation', icon: BarChart2Icon, labelKey: 'header.evaluation', defaultLabel: 'Evaluation' },
    ],
  },
  {
    labelKey: 'sidebar.configuration',
    defaultLabel: 'Configuration',
    headerColor: 'text-slate-500 dark:text-slate-400',
    activeColor: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 font-semibold',
    items: [
      { tab: 'api', icon: CodeIcon, labelKey: 'header.api', defaultLabel: 'API' },
      { tab: 'settings', icon: SettingsIcon, labelKey: 'header.settings', defaultLabel: 'Settings' },
    ],
  },
]

interface SidebarItemProps {
  item: NavItem
  activeColor: string
  collapsed: boolean
  isActive: boolean
  onClick: () => void
}

function SidebarItem({ item, activeColor, collapsed, isActive, onClick }: SidebarItemProps) {
  const { t } = useTranslation()
  const label = t(item.labelKey, item.defaultLabel)
  const Icon = item.icon

  const button = (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 rounded-lg text-sm transition-colors',
        collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2',
        isActive
          ? activeColor
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  )

  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return button
}

export default function AppSidebar() {
  const { t } = useTranslation()
  const currentTab = useSettingsStore.use.currentTab()
  const setCurrentTab = useSettingsStore.use.setCurrentTab()
  const sidebarCollapsed = useSettingsStore.use.sidebarCollapsed()
  const toggleSidebarCollapsed = useSettingsStore.use.toggleSidebarCollapsed()

  return (
    <aside
      className={cn(
        'flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 flex-shrink-0',
        sidebarCollapsed ? 'w-12' : 'w-52'
      )}
    >
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey} className="mb-4">
            {!sidebarCollapsed && (
              <div
                className={cn(
                  'px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider',
                  group.headerColor
                )}
              >
                {t(group.labelKey, group.defaultLabel)}
              </div>
            )}
            {sidebarCollapsed && (
              <div className="mx-2 mb-1 border-t border-sidebar-border" />
            )}
            <div className={cn('flex flex-col gap-0.5', sidebarCollapsed ? 'px-1' : 'px-2')}>
              {group.items.map((item) => (
                <SidebarItem
                  key={item.tab}
                  item={item}
                  activeColor={group.activeColor}
                  collapsed={sidebarCollapsed}
                  isActive={currentTab === item.tab}
                  onClick={() => setCurrentTab(item.tab as any)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-sidebar-border">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebarCollapsed}
                className={cn(
                  'w-full flex items-center rounded-lg px-2 py-1.5 text-xs text-sidebar-foreground/60',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
                  sidebarCollapsed ? 'justify-center' : 'justify-end gap-1'
                )}
              >
                {sidebarCollapsed ? (
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                ) : (
                  <>
                    <span>{t('sidebar.collapse', 'Collapse')}</span>
                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {sidebarCollapsed
                ? t('sidebar.expand', 'Expand sidebar')
                : t('sidebar.collapse', 'Collapse sidebar')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  )
}
