import Button from '@/components/ui/Button'
import { SiteInfo, webuiPrefix } from '@/lib/constants'
import AppSettings from '@/components/AppSettings'
import AboutDialog from '@/components/AboutDialog'
import { useAuthStore } from '@/stores/state'
import { useTranslation } from 'react-i18next'
import { navigationService } from '@/services/navigation'
import { LogOutIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'

export default function SiteHeader() {
  const { t } = useTranslation()
  const { isGuestMode, coreVersion, apiVersion, username, webuiTitle, webuiDescription } = useAuthStore()

  const versionDisplay = (coreVersion && apiVersion)
    ? `${coreVersion}/${apiVersion}`
    : null

  const hasWarning = apiVersion?.endsWith('⚠️')
  const versionTooltip = hasWarning
    ? t('header.frontendNeedsRebuild')
    : versionDisplay ? `v${versionDisplay}` : ''

  const handleLogout = () => {
    navigationService.navigateToLogin()
  }

  return (
    <header className="border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 flex h-10 w-full border-b px-4 backdrop-blur flex-shrink-0">
      {/* Logo + title */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <a href={webuiPrefix} className="flex items-center gap-2 flex-shrink-0">
          <img src="logo.png" alt="DocLens" className="size-7" />
          <span className="font-bold">{SiteInfo.name}</span>
        </a>
        {webuiTitle && (
          <div className="flex items-center min-w-0">
            <span className="mx-1 text-xs text-gray-500 dark:text-gray-400">|</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium text-sm cursor-default truncate">
                    {webuiTitle}
                  </span>
                </TooltipTrigger>
                {webuiDescription && (
                  <TooltipContent side="bottom">
                    {webuiDescription}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Utilities */}
      <nav className="flex items-center gap-2 flex-shrink-0">
        <AboutDialog />
        {versionDisplay && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-gray-500 dark:text-gray-400 cursor-default">
                  v{versionDisplay}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {versionTooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <AppSettings />
        {!isGuestMode && (
          <Button
            variant="ghost"
            size="icon"
            side="bottom"
            tooltip={`${t('header.logout')} (${username})`}
            onClick={handleLogout}
          >
            <LogOutIcon className="size-4" aria-hidden="true" />
          </Button>
        )}
      </nav>
    </header>
  )
}
