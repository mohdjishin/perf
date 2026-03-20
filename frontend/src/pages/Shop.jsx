import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { formatPrice } from '../utils/currency'
import { getProductDisplay, categoryKey } from '../utils/productI18n'
import { PageSkeletonGrid } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { StarRatingDisplay } from '../components/StarRating'
import Pagination from '../components/Pagination'
import { BackButton } from '../components/BackButton'
import SeasonalBanner from '../components/SeasonalBanner'
import s from './Shop.module.css'

const PAGE_SIZE = 12

export default function Shop() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState(() => searchParams.get('category') || '')
  const [audience, setAudience] = useState(() => searchParams.get('audience') || '')
  const [newArrival, setNewArrival] = useState(() => searchParams.get('new_arrival') === '1')
  const [onSale, setOnSale] = useState(() => searchParams.get('on_sale') === '1')
  const [seasonalFlag, setSeasonalFlag] = useState(() => searchParams.get('seasonal') || '')

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [apiError, setApiError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  const [apiCategories, setApiCategories] = useState([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [features, setFeatures] = useState({
    new_arrival_section_enabled: true,
    new_arrival_shop_filter_enabled: true,
    discounted_section_enabled: true,
    discounted_shop_filter_enabled: true,
  })

  const hasActiveFilters = category || audience || newArrival || onSale || seasonalFlag || searchQuery
  const clearAllFilters = () => {
    setCategory('')
    setAudience('')
    setNewArrival(false)
    setOnSale(false)
    setSeasonalFlag('')
    setSearch('')
    setSearchQuery('')
    setPage(1)
    setFilterOpen(false)
    setSearchParams({})
  }

  useEffect(() => {
    const na = searchParams.get('new_arrival')
    const sale = searchParams.get('on_sale')
    const seasonal = searchParams.get('seasonal')
    if (na === '1') setNewArrival(true)
    if (sale === '1') setOnSale(true)
    if (seasonal) setSeasonalFlag(seasonal)
  }, [searchParams])

  useEffect(() => {
    setPage(1)
  }, [category, audience, newArrival, onSale, seasonalFlag, searchQuery, sortBy])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: PAGE_SIZE })
    if (category) params.set('category', category)
    if (audience) params.set('audience', audience)
    if (newArrival && features.new_arrival_shop_filter_enabled) params.set('new_arrival', '1')
    if (onSale && features.discounted_shop_filter_enabled) params.set('on_sale', '1')
    if (seasonalFlag) params.set('seasonal', seasonalFlag)
    if (searchQuery) params.set('search', searchQuery)
    if (sortBy === 'price_asc' || sortBy === 'price_desc') params.set('sort', sortBy)
    if (sortBy === 'rating_asc' || sortBy === 'rating_desc') params.set('sort', sortBy)
    setApiError(null)
    api(`/products?${params}`)
      .then((data) => {
        setProducts(data.items || [])
        setPagination(data)
      })
      .catch((err) => {
        setProducts([])
        setPagination(null)
        setApiError(err?.message || 'Unable to load products.')
      })
      .finally(() => setLoading(false))
  }, [category, audience, newArrival, onSale, seasonalFlag, searchQuery, sortBy, page, retryCount, features.new_arrival_shop_filter_enabled, features.discounted_shop_filter_enabled])

  useEffect(() => {
    Promise.all([
      api('/settings/features').catch(() => ({})),
      api('/categories').catch(() => []),
    ]).then(([featuresData, categoriesData]) => {
      if (featuresData && typeof featuresData === 'object') {
        setFeatures({
          new_arrival_section_enabled: featuresData.new_arrival_section_enabled !== false,
          new_arrival_shop_filter_enabled: featuresData.new_arrival_shop_filter_enabled !== false,
          discounted_section_enabled: featuresData.discounted_section_enabled !== false,
          discounted_shop_filter_enabled: featuresData.discounted_shop_filter_enabled !== false,
        })
        if (featuresData.new_arrival_shop_filter_enabled === false) setNewArrival(false)
        if (featuresData.discounted_shop_filter_enabled === false) setOnSale(false)
      }
      setApiCategories(Array.isArray(categoriesData) ? categoriesData : [])
    })
  }, [])

  // Categories API returns full list (categories collection + distinct from products) so filter buttons never disappear
  const uniqueCategories = apiCategories.map((c) => c.name).filter(Boolean)

  return (
    <div className={s.page}>
      <BackButton to="/" label={t('nav.home')} />
      <SeasonalBanner page="shop" />
      <header className={s.hero}>
        <h1 className={s.heroTitle}>{t('shop.heroTitle')}</h1>
        <p className={s.heroTagline}>{t('shop.heroTagline')}</p>
      </header>

      <div className={s.toolbar}>
        <div className={s.searchWrap}>
          <input
            type="search"
            placeholder={t('shop.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearchQuery(search.trim())}
            className={s.searchInput}
          />
          <button
            type="button"
            onClick={() => setSearchQuery(search.trim())}
            className={s.searchBtn}
            aria-label={t('shop.search')}
          >
            {t('shop.search')}
          </button>
        </div>
        <label className={s.sortLabel}>
          <span className={s.sortLabelText}>{t('shop.sortLabel')}</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={s.sortSelect}
            aria-label={t('shop.sortLabel')}
          >
            <option value="">{t('shop.sortNewest')}</option>
            <option value="price_asc">{t('shop.sortPriceAsc')}</option>
            <option value="price_desc">{t('shop.sortPriceDesc')}</option>
            <option value="rating_desc">{t('shop.sortRatingDesc')}</option>
            <option value="rating_asc">{t('shop.sortRatingAsc')}</option>
          </select>
        </label>
        <button
          type="button"
          className={`${s.refineBtn} ${filterOpen ? s.refineBtnActive : ''}`}
          onClick={() => setFilterOpen(!filterOpen)}
          aria-expanded={filterOpen}
        >
          {t('shop.refine')}
        </button>
      </div>

      {searchQuery && (
        <div className={s.activeSearch}>
          <span>{t('shop.resultsFor', { query: searchQuery })}</span>
          <button type="button" onClick={() => { setSearch(''); setSearchQuery(''); setPage(1); }} className={s.clearSearch}>{t('shop.clearSearch')}</button>
        </div>
      )}

      {hasActiveFilters && (
        <div className={s.activePills}>
          {category && <span className={s.pill}>{t(`category.${categoryKey(category)}`, { defaultValue: category })} <button type="button" onClick={() => updateParam('category', '')} aria-label="Remove category">×</button></span>}
          {audience && <span className={s.pill}>{audience === 'men' ? t('product.forHim') : audience === 'women' ? t('product.forHer') : t('product.unisex')} <button type="button" onClick={() => updateParam('audience', '')} aria-label="Remove audience">×</button></span>}
          {newArrival && <span className={s.pill}>{t('shop.newArrival')} <button type="button" onClick={() => updateParam('new_arrival', '')} aria-label="Remove">×</button></span>}
          {onSale && <span className={s.pill}>{t('shop.onSale')} <button type="button" onClick={() => updateParam('on_sale', '')} aria-label="Remove">×</button></span>}
          {seasonalFlag && (
            <span className={s.pill}>
              Seasonal: {seasonalFlag}
              <button
                type="button"
                onClick={() => {
                  setSeasonalFlag('')
                  setPage(1)
                  const next = new URLSearchParams(searchParams)
                  next.delete('seasonal')
                  setSearchParams(next)
                }}
                aria-label="Remove seasonal filter"
              >
                ×
              </button>
            </span>
          )}
          <button type="button" onClick={clearAllFilters} className={s.clearAll}>{t('shop.clearAll')}</button>
        </div>
      )}

      <div className={s.shopLayout}>
        <aside className={`${s.sidebar} ${filterOpen ? s.sidebarOpen : ''}`}>
          {uniqueCategories.length > 0 && (
            <div className={s.filterGroup}>
              <span className={s.filterGroupLabel}>{t('shop.scentNavigator') || 'Scent Navigator'}</span>
              <div className={s.filterRow}>
                <button className={`${s.filterBtn} ${!category ? s.active : ''}`} onClick={() => updateParam('category', '')}>{t('shop.all')}</button>
                {uniqueCategories.map((c) => (
                  <button key={c} className={`${s.filterBtn} ${category === c ? s.active : ''}`} onClick={() => updateParam('category', c)}>{t(`category.${categoryKey(c)}`, { defaultValue: c })}</button>
                ))}
              </div>
            </div>
          )}
          <div className={s.filterGroup}>
            <span className={s.filterGroupLabel}>{t('shop.forLabel')}</span>
            <div className={s.filterRow}>
              <button className={`${s.filterBtn} ${!audience ? s.active : ''}`} onClick={() => updateParam('audience', '')}>{t('shop.all')}</button>
              <button className={`${s.filterBtn} ${audience === 'men' ? s.active : ''}`} onClick={() => updateParam('audience', 'men')}>{t('product.forHim')}</button>
              <button className={`${s.filterBtn} ${audience === 'women' ? s.active : ''}`} onClick={() => updateParam('audience', 'women')}>{t('product.forHer')}</button>
              <button className={`${s.filterBtn} ${audience === 'unisex' ? s.active : ''}`} onClick={() => updateParam('audience', 'unisex')}>{t('product.unisex')}</button>
            </div>
          </div>
          {(features.new_arrival_shop_filter_enabled || features.discounted_shop_filter_enabled) && (
            <div className={s.filterGroup}>
              <span className={s.filterGroupLabel}>{t('shop.showLabel')}</span>
              <div className={s.filterRow}>
                {features.new_arrival_shop_filter_enabled && (
                  <label className={s.filterToggle}>
                    <input type="checkbox" checked={newArrival} onChange={(e) => updateParam('new_arrival', e.target.checked ? '1' : '')} />
                    <span>{t('shop.newArrival')}</span>
                  </label>
                )}
                {features.discounted_shop_filter_enabled && (
                  <label className={s.filterToggle}>
                    <input type="checkbox" checked={onSale} onChange={(e) => updateParam('on_sale', e.target.checked ? '1' : '')} />
                    <span>{t('shop.onSale')}</span>
                  </label>
                )}
              </div>
            </div>
          )}
        </aside>

        <div className={s.main}>
          {loading ? (
            <PageSkeletonGrid count={12} />
          ) : products.length === 0 ? (
            <>
              {apiError && (
                <div className={s.errorBanner} role="alert">
                  <p className={s.errorTitle}>{apiError}</p>
                  <button type="button" onClick={() => { setApiError(null); setRetryCount((c) => c + 1); }} className={s.retryLink}>{t('shop.tryAgain')}</button>
                </div>
              )}
              {!apiError && (
                <EmptyState
                  title={searchQuery ? t('shop.noResults') : t('shop.noProducts')}
                  message={searchQuery ? t('shop.tryDifferent') : 'Check back soon or contact us to add products.'}
                  actionLabel={searchQuery ? t('shop.clearSearch') : t('shop.backToHome')}
                  actionTo={searchQuery ? undefined : '/'}
                  onAction={searchQuery ? () => { setSearch(''); setSearchQuery(''); setPage(1); } : undefined}
                />
              )}
            </>
          ) : (
            <>
              <div className={s.grid}>
                {products.map((p, i) => {
                  const { name, description } = getProductDisplay(p, locale)
                  return (
                    <Link
                      key={p.id}
                      to={`/product/${p.id}`}
                      className={s.card}
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      <div className={s.imageWrap}>
                        {(p.newArrival || p.onSale || p.stock <= 0) && (
                          <div className={s.badges}>
                            {p.newArrival && <span className={s.badgeNew}>{t('product.new')}</span>}
                            {p.onSale && p.discountPercent > 0 && (
                              <span className={s.badgeSale}>{t('product.percentOff', { percent: p.discountPercent })}</span>
                            )}
                            {p.stock <= 0 && <span className={s.badgeStock}>{t('product.outOfStock')}</span>}
                          </div>
                        )}
                        <img
                          src={p.imageUrl || 'https://placehold.co/400x500/e2e8f0/94a3b8?text=·'}
                          alt={name}
                          loading="lazy"
                        />
                      </div>
                      <div className={s.cardBody}>
                        <span className={s.category}>{t(`category.${categoryKey(p.category)}`, { defaultValue: p.category || 'Fragrance' })}</span>
                        {p.audience && (
                          <span className={s.audience}>
                            {p.audience === 'men' ? t('product.forHim') : p.audience === 'women' ? t('product.forHer') : t('product.unisex')}
                          </span>
                        )}
                        <h3 className={s.name}>{name}</h3>
                        {p.notes && p.notes.length > 0 && (
                          <div className={s.scentNotes}>
                            {p.notes.slice(0, 3).map((note, idx) => (
                              <span key={idx} className={s.scentTag}>{note}</span>
                            ))}
                          </div>
                        )}
                        {description && (
                          <p className={s.desc}>{description.length > 100 ? description.slice(0, 100) + '…' : description}</p>
                        )}
                        {p.rating > 0 && (
                          <StarRatingDisplay value={p.rating} className={s.cardRating} />
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
                      </div>
                    </Link>
                  )
                })}
              </div>
              {pagination?.totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
