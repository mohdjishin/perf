import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { formatPrice } from '../utils/currency'
import SeasonalBanner from '../components/SeasonalBanner'
import { PageSkeletonGrid } from '../components/Skeleton'
import { useTranslation } from 'react-i18next'
import { getProductDisplay, categoryKey } from '../utils/productI18n'
import { WHY_SECTION_DEFAULTS, truncate } from '../config/whySection'
import s from './Home.module.css'

export default function Home() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const [products, setProducts] = useState([])
  const [newArrivals, setNewArrivals] = useState([])
  const [discounted, setDiscounted] = useState([])
  const [features, setFeatures] = useState({
    new_arrival_section_enabled: true,
    discounted_section_enabled: true,
    featured_section_enabled: true,
    why_section_enabled: true,
  })
  const [apiError, setApiError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState(null)

  useEffect(() => {
    setLoading(true)
    api('/home')
      .then((data) => {
        const f = data.features || {}
        setFeatures({
          new_arrival_section_enabled: f.new_arrival_section_enabled !== false,
          discounted_section_enabled: f.discounted_section_enabled !== false,
          featured_section_enabled: f.featured_section_enabled !== false,
          why_section_enabled: f.why_section_enabled !== false,
          why_section_title: f.why_section_title ?? 'Why Blue Mist Perfumes',
          why_section_items: Array.isArray(f.why_section_items) && f.why_section_items.length > 0
            ? f.why_section_items
            : undefined,
        })
        setProducts(data.products || [])
        setNewArrivals(data.new_arrivals || [])
        setDiscounted(data.discounted || [])
        setBanner(data.banner || null)
        setApiError(null)
      })
      .catch((err) => {
        setProducts([])
        setNewArrivals([])
        setDiscounted([])
        setBanner(null)
        setApiError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <PageSkeletonGrid count={6} />
  }

  return (
    <div>
      <SeasonalBanner page="home" initialBanner={banner} />
      <section className={s.hero} aria-label="Welcome">
        <div className={s.heroFrame}>
          <div className={s.heroTextSide}>
            <p className={s.heroEyebrow}>Signature Egyptian Collection</p>
            <h1 className={s.heroTitle}>{t('home.heroTitle')}</h1>
            <p className={s.heroDesc}>{t('home.heroDesc')}</p>
            <div className={s.heroActions}>
              <Link to="/shop" className={s.heroBtnPrimary}>{t('home.exploreCollection')}</Link>
            </div>
          </div>
          <div className={s.heroImageSide}>
            <img src="/images/premium-hero.png" alt="Perfume Collection" className={s.heroImg} />
          </div>
        </div>
      </section>

      {/* Marquee strip — as seen on myop top bar/section */}
      <div className={s.marqueeOuter}>
        <div className={s.marqueeTrack}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={s.marqueeItem}>
              <span>✦</span>
              <span>Long Lasting</span>
              <span>✦</span>
              <span>Premium Quality</span>
              <span>✦</span>
              <span>Cruelty Free</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category Grid — Shop by Scent (myop style circles/squares) */}
      <section className={s.categories} aria-labelledby="cat-heading">
        <div className={s.sectionHeaderCentered}>
          <p className={s.sectionLabel}>Discover Your Scent</p>
          <h2 id="cat-heading" className={s.sectionTitleLarge}>Shop by Collection</h2>
        </div>
        <div className={s.catGrid}>
          {['oud', 'floral', 'woody', 'musk'].map((cat) => (
            <Link key={cat} to={`/shop?category=${cat}`} className={s.catCard}>
              <div className={s.catImageWrap}>
                <img
                  src={cat === 'musk' ? 'https://placehold.co/600x600/fdf8f0/caa04e?text=Musk+Collection' : `/images/cat-${cat}.jpg`}
                  alt={cat}
                  onError={(e) => e.target.src = 'https://placehold.co/300x300/e2e8f0/94a3b8?text=·'}
                />
              </div>
              <span className={s.catName}>{t(`category.${cat}`, { defaultValue: cat })}</span>
            </Link>
          ))}
        </div>
      </section>

      {apiError && (
        <section className={s.errorBanner} role="alert" aria-live="assertive">
          <p className={s.errorTitle}>{t('home.unableToLoad')}</p>
          <p>{apiError}</p>
        </section>
      )}

      {/* Order: Featured (curated) → New arrivals (fresh) → Discounted (offers) — best for conversion */}
      {features.featured_section_enabled && products.length > 0 && (
        <section className={s.products} aria-labelledby="featured-heading">
          <div className={s.sectionHeader}>
            <div>
              <p className={s.sectionLabel}>{t('product.curated')}</p>
              <h2 id="featured-heading" className={s.sectionTitle}>{t('home.featured')}</h2>
            </div>
            <Link to="/shop" className={s.viewAll}>{t('home.viewAll')}</Link>
          </div>
          <div className={s.grid}>
            {products.map((p, i) => {
              const { name, description } = getProductDisplay(p, locale)
              return (
                <Link key={p.id} to={`/product/${p.id}`} className={s.card} style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className={s.imageWrap}>
                    {p.stock <= 0 && <span className={s.badgeStock}>{t('product.outOfStock')}</span>}
                    <img
                      src={p.imageUrl || 'https://placehold.co/400x500/e2e8f0/94a3b8?text=·'}
                      alt={name}
                      loading="lazy"
                    />
                  </div>
                  <span className={s.category}>{t(`category.${categoryKey(p.category)}`, { defaultValue: p.category || 'Fragrance' })}</span>
                  <h3 className={s.name}>{name}</h3>
                  {p.notes && p.notes.length > 0 && (
                    <div className={s.scentNotes}>
                      {p.notes.slice(0, 3).map((note, idx) => (
                        <span key={idx} className={s.scentTag}>{note}</span>
                      ))}
                    </div>
                  )}
                  {description && (
                    <p className={s.desc}>{description.length > 80 ? description.slice(0, 80) + '…' : description}</p>
                  )}
                  <p className={s.price}>{formatPrice(p.price)}</p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {features.new_arrival_section_enabled && newArrivals.length > 0 && (
        <section className={s.products} aria-labelledby="new-arrivals-heading">
          <div className={s.sectionHeader}>
            <div>
              <p className={s.sectionLabel}>{t('product.justIn')}</p>
              <h2 id="new-arrivals-heading" className={s.sectionTitle}>{t('home.newArrivals')}</h2>
            </div>
            <Link to="/shop?new_arrival=1" className={s.viewAll}>{t('home.viewAll')}</Link>
          </div>
          <div className={s.grid}>
            {newArrivals.map((p, i) => {
              const { name, description } = getProductDisplay(p, locale)
              return (
                <Link key={p.id} to={`/product/${p.id}`} className={s.card} style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className={s.imageWrap}>
                    <span className={s.badgeNew}>{t('product.new')}</span>
                    {p.stock <= 0 && <span className={s.badgeStock}>{t('product.outOfStock')}</span>}
                    <img
                      src={p.imageUrl || 'https://placehold.co/400x500/e2e8f0/94a3b8?text=·'}
                      alt={name}
                      loading="lazy"
                    />
                  </div>
                  <span className={s.category}>{t(`category.${categoryKey(p.category)}`, { defaultValue: p.category || 'Fragrance' })}</span>
                  <h3 className={s.name}>{name}</h3>
                  {p.notes && p.notes.length > 0 && (
                    <div className={s.scentNotes}>
                      {p.notes.slice(0, 3).map((note, idx) => (
                        <span key={idx} className={s.scentTag}>{note}</span>
                      ))}
                    </div>
                  )}
                  {description && (
                    <p className={s.desc}>{description.length > 80 ? description.slice(0, 80) + '…' : description}</p>
                  )}
                  <p className={s.price}>{formatPrice(p.price)}</p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {features.discounted_section_enabled && discounted.length > 0 && (
        <section className={s.products} aria-labelledby="discounted-heading">
          <div className={s.sectionHeader}>
            <div>
              <p className={s.sectionLabel}>{t('product.offers')}</p>
              <h2 id="discounted-heading" className={s.sectionTitle}>{t('home.discounted')}</h2>
            </div>
            <Link to="/shop?on_sale=1" className={s.viewAll}>{t('home.viewAll')}</Link>
          </div>
          <div className={s.grid}>
            {discounted.map((p, i) => {
              const { name, description } = getProductDisplay(p, locale)
              return (
                <Link key={p.id} to={`/product/${p.id}`} className={s.card} style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className={s.imageWrap}>
                    {p.discountPercent > 0 && <span className={s.badgeSale}>{t('product.percentOff', { percent: p.discountPercent })}</span>}
                    {p.stock <= 0 && <span className={s.badgeStock}>{t('product.outOfStock')}</span>}
                    <img
                      src={p.imageUrl || 'https://placehold.co/400x500/e2e8f0/94a3b8?text=·'}
                      alt={name}
                      loading="lazy"
                    />
                  </div>
                  <span className={s.category}>{t(`category.${categoryKey(p.category)}`, { defaultValue: p.category || 'Fragrance' })}</span>
                  <h3 className={s.name}>{name}</h3>
                  {p.notes && p.notes.length > 0 && (
                    <div className={s.scentNotes}>
                      {p.notes.slice(0, 3).map((note, idx) => (
                        <span key={idx} className={s.scentTag}>{note}</span>
                      ))}
                    </div>
                  )}
                  {description && (
                    <p className={s.desc}>{description.length > 80 ? description.slice(0, 80) + '…' : description}</p>
                  )}
                  <p className={s.price}>
                    {p.onSale && p.discountPercent > 0 && p.price != null ? (
                      <>
                        <span className={s.originalPrice}>{formatPrice(p.price)}</span>
                        <span className={s.salePrice}>{formatPrice(p.price * (1 - (p.discountPercent || 0) / 100))}</span>
                      </>
                    ) : (
                      formatPrice(p.price)
                    )}
                  </p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {features.why_section_enabled && (() => {
        const items = features.why_section_items ?? WHY_SECTION_DEFAULTS.items
        const title = features.why_section_title ?? WHY_SECTION_DEFAULTS.title
        const maxTitle = WHY_SECTION_DEFAULTS.maxTitleChars
        const maxDesc = WHY_SECTION_DEFAULTS.maxDescriptionChars
        if (!items || items.length === 0) return null
        return (
          <section className={s.whySection} aria-labelledby="why-heading">
            <h2 id="why-heading" className={s.sectionTitle}>{truncate(title, maxTitle * 2)}</h2>
            <div className={s.featuresGrid}>
              {items.map((item, i) => (
                <div key={i} className={s.feature}>
                  <span className={s.featureIcon}>✦</span>
                  <h3>{truncate(item.title ?? item.Title ?? '', maxTitle)}</h3>
                  <p>{truncate(item.description ?? item.Description ?? '', maxDesc)}</p>
                </div>
              ))}
            </div>
          </section>
        )
      })()}
    </div>
  )
}