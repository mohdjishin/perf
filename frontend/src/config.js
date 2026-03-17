/**
 * Loads API configuration from config.json.
 * Change apiBaseUrl in public/config.json to point to your backend.
 */
let config = {
  apiBaseUrl: import.meta.env.VITE_API_URL || '/api',
}

export async function loadConfig() {
  try {
    const res = await fetch('/config.json')
    if (res.ok) {
      const data = await res.json()
      config = { ...config, ...data }
      // Remove secrets if they accidentally leaked into config.json
      delete config.google_client_id
      delete config.stripe_publishable_key
    }
  } catch (_) { }
  return config
}

export function getApiBaseUrl() {
  return config.apiBaseUrl
}

export function getStripePublishableKey() {
  // This will be null initially, components should use useFeatures() instead
  return config.stripe_publishable_key
}
