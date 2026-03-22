import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api, getMediaUrl } from '../api/client'
import { formatPrice } from '../utils/currency'
import SeasonalBanner from '../components/SeasonalBanner'
import { PageSkeletonGrid } from '../components/Skeleton'
import { useTranslation } from 'react-i18next'
import { getProductDisplay, categoryKey } from '../utils/productI18n'
import { WHY_SECTION_DEFAULTS, truncate } from '../config/whySection'
import { useFeatures } from '../context/FeaturesContext'
import ProductCard from '../components/ProductCard'
import s from './Home.module.css'

export default function Home() {
  const { t, i18n } = useTranslation()
  const globalFeatures = useFeatures()
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
  const [categories, setCategories] = useState([])
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0)
  const catGridRef = useRef(null)

  const scrollCats = (direction) => {
    if (catGridRef.current) {
      const scrollAmount = 400
      catGridRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

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
          cat_section_title: f.category_section_title ?? 'Shop by Collection',
          cat_section_label: f.category_section_label ?? 'Discover Your Scent',
          hero_subtitle: locale === 'ar' ? f.hero_subtitle_ar : f.hero_subtitle_en,
          hero_title: locale === 'ar' ? f.hero_title_ar : f.hero_title_en,
          hero_description: locale === 'ar' ? f.hero_description_ar : f.hero_description_en,
          hero_button_text: locale === 'ar' ? f.hero_button_text_ar : f.hero_button_text_en,
          hero_images: Array.isArray(f.hero_images) && f.hero_images.length > 0 ? f.hero_images : ['/images/premium-hero.png'],
          hero_images: Array.isArray(f.hero_images) && f.hero_images.length > 0 ? f.hero_images : ['/images/premium-hero.png'],
        })
        setProducts(data.products || [])
        setNewArrivals(data.new_arrivals || [])
        setDiscounted(data.discounted || [])
        setBanner(data.banner || null)
        setCategories(data.categories || [])
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
  }, [locale])

  // We could also fetch categories directly if they aren't in the home payload
  useEffect(() => {
    if (categories.length === 0) {
      api('/categories')
        .then(setCategories)
        .catch(() => { })
    }
  }, [categories.length])

  useEffect(() => {
    if (features.hero_images && features.hero_images.length > 1) {
      const interval = setInterval(() => {
        setCurrentHeroIndex((prev) => (prev + 1) % features.hero_images.length)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [features.hero_images])

  if (loading) {
    return <PageSkeletonGrid count={6} />
  }

  return (
    <div>
      <SeasonalBanner page="home" initialBanner={banner} />
      <section className={s.hero} aria-label="Welcome">
        <div className={s.heroFrame}>
          <div className={s.heroTextSide}>
            <p className={s.heroEyebrow}>{features.hero_subtitle || 'Signature Egyptian Collection'}</p>
            <h1 className={s.heroTitle}>{features.hero_title || t('home.heroTitle')}</h1>
            <p className={s.heroDesc}>{features.hero_description || t('home.heroDesc')}</p>
            <div className={s.heroActions}>
              <Link to="/shop" className={s.heroBtnPrimary}>{features.hero_button_text || t('home.exploreCollection')}</Link>
            </div>
          </div>
          <div className={s.heroImageSide}>
            {features.hero_images && features.hero_images.map((img, idx) => {
              const isVideo = img.toLowerCase().endsWith('.mp4') || img.toLowerCase().endsWith('.webm')
              const isActive = idx === currentHeroIndex

              if (isVideo) {
                return (
                  <video
                    key={idx}
                    src={img}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className={`${s.heroVideo} ${isActive ? s.active : ''}`}
                  />
                )
              }

              return (
                <img
                  key={idx}
                  src={getMediaUrl(img)}
                  alt={t('home.heroTitle')}
                  className={`${s.heroImg} ${isActive ? s.active : ''}`}
                />
              )
            })}
            {features.hero_images && features.hero_images.length > 1 && (
              <div className={s.heroDots}>
                {features.hero_images.map((_, idx) => (
                  <button
                    key={idx}
                    className={`${s.heroDot} ${idx === currentHeroIndex ? s.activeDot : ''}`}
                    onClick={() => setCurrentHeroIndex(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Marquee strip — as seen on myop top bar/section */}
      {globalFeatures.marqueeSectionEnabled && globalFeatures.marqueeItems && globalFeatures.marqueeItems.length > 0 && (
        <div className={s.marqueeOuter}>
          <div className={s.marqueeTrack}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className={s.marqueeItem}>
                {globalFeatures.marqueeItems.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <span>✦</span>
                    <span>{item}</span>
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Grid — Shop by Scent (myop style circles/squares) */}
      {globalFeatures.categorySectionEnabled && (
        <section className={s.categories} aria-labelledby="cat-heading">
          <div className={s.sectionHeaderCentered}>
            <p className={s.sectionLabel}>{features.cat_section_label}</p>
            <h2 id="cat-heading" className={s.sectionTitleLarge}>{features.cat_section_title}</h2>
          </div>
          <div className={s.catGridWrapper}>
            <button
              type="button"
              className={`${s.scrollBtn} ${s.scrollLeft}`}
              onClick={() => scrollCats('left')}
              aria-label="Scroll left"
            >
              ←
            </button>
            <div className={s.catGrid} ref={catGridRef}>
              {categories.map((cat) => (
                <Link key={cat.id || cat.name} to={`/shop?category=${encodeURIComponent(cat.name)}`} className={s.catCard}>
                  <div className={s.catImageWrap}>
                    <img
                      src={getMediaUrl(cat.imageUrl) || `https://placehold.co/600x600/fdf8f0/caa04e?text=${encodeURIComponent(cat.name)}`}
                      alt={cat.name}
                      onError={(e) => {
                        if (!e.target.src.includes('placehold.co')) {
                          e.target.src = `https://placehold.co/600x600/fdf8f0/caa04e?text=${encodeURIComponent(cat.name)}`;
                        }
                      }}
                    />
                  </div>
                  <span className={s.catName}>{t(`category.${cat.name.toLowerCase()}`, { defaultValue: cat.name })}</span>
                </Link>
              ))}
            </div>
            <button
              type="button"
              className={`${s.scrollBtn} ${s.scrollRight}`}
              onClick={() => scrollCats('right')}
              aria-label="Scroll right"
            >
              →
            </button>
          </div>
        </section>
      )}

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
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
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
            {newArrivals.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
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
            {discounted.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
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