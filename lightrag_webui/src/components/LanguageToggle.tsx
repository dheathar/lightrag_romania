import Button from '@/components/ui/Button'
import { useCallback } from 'react'
import { controlButtonVariant } from '@/lib/constants'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/stores/settings'

/**
 * Component that toggles the language between English and Romanian.
 */
export default function LanguageToggle() {
  const { i18n } = useTranslation()
  const currentLanguage = i18n.language
  const setLanguage = useSettingsStore.use.setLanguage()

  const setEnglish = useCallback(() => {
    i18n.changeLanguage('en')
    setLanguage('en')
  }, [i18n, setLanguage])

  const setRomanian = useCallback(() => {
    i18n.changeLanguage('ro')
    setLanguage('ro')
  }, [i18n, setLanguage])

  if (currentLanguage === 'ro') {
    return (
      <Button
        onClick={setEnglish}
        variant={controlButtonVariant}
        tooltip="Switch to English"
        size="icon"
        side="bottom"
      >
        RO
      </Button>
    )
  }
  return (
    <Button
      onClick={setRomanian}
      variant={controlButtonVariant}
      tooltip="Schimba in Romana"
      size="icon"
      side="bottom"
    >
      EN
    </Button>
  )
}
