/**
 * i18next setup: EN/AR, localStorage persistence, and RTL for Arabic.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { translations, getStoredLocale, setStoredLocale } from './translations'

const stored = getStoredLocale()

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: translations.en },
      ar: { translation: translations.ar },
    },
    lng: stored,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })

function applyDirAndLang(lng) {
  document.documentElement.lang = lng === 'ar' ? 'ar' : 'en'
  // Force LTR to prevent layout mirroring as requested
  document.documentElement.dir = 'ltr'
}

applyDirAndLang(i18n.language || stored)
i18n.on('languageChanged', (lng) => {
  applyDirAndLang(lng)
  setStoredLocale(lng)
})

export default i18n
