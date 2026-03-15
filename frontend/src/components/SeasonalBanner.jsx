import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import s from './SeasonalBanner.module.css'

const DISMISS_KEY = 'seasonal_banner_dismissed_ts'
const DISMISS_HOURS = 24

function normalizeBannerConfig(data, page) {
  if (!data || !data.active || !data.headline) return null
  const showOn = data.show_on || 'both'
  const showHere = showOn === 'both' || showOn === page
  if (!showHere) return null
  if (data.dismissible) {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (ts) {
      const age = Date.now() - parseInt(ts, 10)
      if (age < DISMISS_HOURS * 60 * 60 * 1000) return null
    }
  }
  return data
}

/**
 * Fetches seasonal sale banner config and renders when active. Pass page="home" or page="shop" to respect show_on.
 * If initialBanner is provided (e.g. from /home payload), skips fetch for faster first paint.
 */
export default function SeasonalBanner({ page = 'both', initialBanner = null }) {
  const [config, setConfig] = useState(() => normalizeBannerConfig(initialBanner, page))
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (initialBanner != null) {
      setConfig(normalizeBannerConfig(initialBanner, page))
      return
    }
    api('/banners/seasonal-sale')
      .then((data) => {
        setConfig(normalizeBannerConfig(data, page))
      })
      .catch(() => setConfig(null))
  }, [page, initialBanner])

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
    setConfig(null)
  }

  if (!config || dismissed) return null

  const theme = config.theme === 'light' ? s.themeLight : s.themeDark
  const ctaUrl = config.cta_url || '/shop'
  const isExternal = ctaUrl.startsWith('http')
  const newTab = config.cta_new_tab

  return (
    <section className={`${s.banner} ${theme}`} aria-label="Seasonal sale">
      {config.dismissible && (
        <button
          type="button"
          className={s.close}
          onClick={handleDismiss}
          aria-label="Dismiss banner"
        >
          ×
        </button>
      )}
      {config.image_url ? (
        <div className={s.bgImage} style={{ backgroundImage: `url(${config.image_url})` }} aria-hidden />
      ) : null}
      <div className={s.overlay} />
      <div className={s.content}>
        <h2 className={s.headline}>{config.headline}</h2>
        {config.subheadline && <p className={s.subheadline}>{config.subheadline}</p>}
        {config.cta_text && (
          newTab ? (
            <a
              href={isExternal ? ctaUrl : `${window.location.origin}${ctaUrl.startsWith('/') ? ctaUrl : '/' + ctaUrl}`}
              className={s.cta}
              target="_blank"
              rel="noopener noreferrer"
            >
              {config.cta_text}
            </a>
          ) : isExternal ? (
            <a href={ctaUrl} className={s.cta} target="_blank" rel="noopener noreferrer">{config.cta_text}</a>
          ) : (
            <Link to={ctaUrl} className={s.cta}>{config.cta_text}</Link>
          )
        )}
      </div>
    </section>
  )
}
