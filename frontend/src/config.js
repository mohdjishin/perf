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
    }
  } catch (_) { }
  return config
}

export function getApiBaseUrl() {
  return config.apiBaseUrl
}
