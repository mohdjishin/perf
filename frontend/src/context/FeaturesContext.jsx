import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/client'

const defaultInvoice = {
  companyName: 'Blue Mist Perfumes',
  street: '',
  city: '',
  state: '',
  zip: '',
  country: '',
  phone: '',
  email: '',
}
const FeaturesContext = createContext({ i18nEnabled: true, storeLocatorEnabled: true, socialEnabled: false, social: {}, invoice: defaultInvoice, googleClientId: null, signupEnabled: true })

/**
 * Provides app-wide feature flags (e.g. i18n_enabled) from /settings/features.
 * Used by Navbar to show/hide the language switcher.
 */
export function FeaturesProvider({ children }) {
  const [features, setFeatures] = useState({ i18nEnabled: true, storeLocatorEnabled: true, socialEnabled: false, social: {}, invoice: defaultInvoice, googleClientId: null, signupEnabled: true })

  const fetchFeatures = () => {
    api('/settings/features')
      .then((data) => {
        setFeatures({
          i18nEnabled: data.i18n_enabled !== false,
          storeLocatorEnabled: data.store_locator_enabled !== false,
          socialEnabled: data.social_enabled === true,
          social: {
            facebook: (data.social_facebook || '').trim(),
            facebookEnabled: data.social_facebook_enabled !== false,
            instagram: (data.social_instagram || '').trim(),
            instagramEnabled: data.social_instagram_enabled !== false,
            twitter: (data.social_twitter || '').trim(),
            twitterEnabled: data.social_twitter_enabled !== false,
            youtube: (data.social_youtube || '').trim(),
            youtubeEnabled: data.social_youtube_enabled !== false,
          },
          invoice: {
            companyName: (data.invoice_company_name || '').trim() || 'Blue Mist Perfumes',
            street: (data.invoice_street || '').trim(),
            city: (data.invoice_city || '').trim(),
            state: (data.invoice_state || '').trim(),
            zip: (data.invoice_zip || '').trim(),
            country: (data.invoice_country || '').trim(),
            phone: (data.invoice_phone || '').trim(),
            email: (data.invoice_email || '').trim(),
          },
          googleClientId: data.google_client_id,
          signupEnabled: data.signup_enabled !== false,
        })
      })
      .catch(() => {
        // Keep default (i18n on) on error
      })
  }

  useEffect(() => {
    fetchFeatures()
    const onFeaturesUpdated = () => fetchFeatures()
    window.addEventListener('features:updated', onFeaturesUpdated)
    return () => window.removeEventListener('features:updated', onFeaturesUpdated)
  }, [])

  return (
    <FeaturesContext.Provider value={features}>
      {children}
    </FeaturesContext.Provider>
  )
}

export function useFeatures() {
  return useContext(FeaturesContext) || { i18nEnabled: true, storeLocatorEnabled: true, socialEnabled: false, social: {}, invoice: defaultInvoice, googleClientId: null, signupEnabled: true }
}

