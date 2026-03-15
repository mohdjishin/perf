import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useFeatures } from '../context/FeaturesContext'
import { api } from '../api/client'
import s from './ShopLocator.module.css'

function formatAddress(store) {
  const parts = [store.street, store.city, store.state, store.zip, store.country].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export default function ShopLocator() {
  const { t } = useTranslation()
  const { storeLocatorEnabled } = useFeatures()
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!storeLocatorEnabled) {
      setLoading(false)
      return
    }
    api('/stores')
      .then((data) => setStores(data.stores || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [storeLocatorEnabled])

  if (!storeLocatorEnabled) {
    return (
      <div className={s.page}>
        <div className={s.container}>
          <h1 className={s.title}>{t('storeLocator.title')}</h1>
          <p className={s.empty}>{t('storeLocator.featureDisabled')}</p>
          <p className={s.backLink}>
            <Link to="/" className={s.backLinkA}>← {t('nav.home')}</Link>
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.container}>
          <h1 className={s.title}>{t('storeLocator.title')}</h1>
          <p className={s.loading}>{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <div className={s.container}>
        <h1 className={s.title}>{t('storeLocator.title')}</h1>
        <p className={s.subtitle}>{t('storeLocator.subtitle')}</p>

        {error && (
          <p className={s.empty}>{t('storeLocator.unableToLoad')}</p>
        )}

        {!error && stores.length === 0 && (
          <p className={s.empty}>{t('storeLocator.noStores')}</p>
        )}

        {!error && stores.length > 0 && (
          <ul className={s.list}>
            {stores.map((store) => {
              const address = formatAddress(store)
              const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(store.lat + ',' + store.lng)}`
              return (
                <li key={store.id} className={s.card}>
                  <h2 className={s.cardTitle}>{store.name}</h2>
                  {address && <p className={s.address}>{address}</p>}
                  {store.phone && <p className={s.phone}>{t('storeLocator.phone')}: {store.phone}</p>}
                  {store.hours && <p className={s.hours}>{t('storeLocator.hours')}: {store.hours}</p>}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={s.mapLink}
                  >
                    {t('storeLocator.openInMaps')}
                  </a>
                </li>
              )
            })}
          </ul>
        )}

        <p className={s.backLink}>
          <Link to="/" className={s.backLinkA}>← {t('nav.home')}</Link>
        </p>
      </div>
    </div>
  )
}
