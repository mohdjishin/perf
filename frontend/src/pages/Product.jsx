import { useState, useEffect } from 'react'
import { Link, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { formatPrice } from '../utils/currency'
import { getProductDisplay, categoryKey } from '../utils/productI18n'
import { PageSkeletonProduct } from '../components/Skeleton'
import { ErrorState } from '../components/EmptyState'
import { Toast } from '../components/Toast'
import { BackButton } from '../components/BackButton'
import { StarRatingDisplay } from '../components/StarRating'
import s from './Product.module.css'

export default function Product() {
  const rawId = useParams().id
  const id = (() => {
    const s = String(rawId ?? '').trim().toLowerCase().replace(/[^a-f0-9]/g, '')
    return s.length >= 24 ? s.slice(0, 24) : s || null
  })()
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const { user } = useAuth()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [showAddedToast, setShowAddedToast] = useState(false)
  const { addToCart, items } = useCart()
  const inCart = items.some((i) => i.id === product?.id)
  const display = product ? getProductDisplay(product, locale) : { name: '', description: '' }
  const images = (product?.imageUrls?.length > 0 ? product.imageUrls : product?.imageUrl ? [product.imageUrl] : []) || []
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const mainImage = images[selectedImageIndex] || product?.imageUrl
  const [reviews, setReviews] = useState({ items: [], total: 0, average: 0, canReview: false })
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [reviewSuccessToast, setReviewSuccessToast] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const [reviewsError, setReviewsError] = useState(null)

  useEffect(() => {
    if (!id) {
      setProduct(null)
      setLoading(false)
      return
    }
    api(`/products/${id}`)
      .then(setProduct)
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [id])
  useEffect(() => {
    setSelectedImageIndex(0)
  }, [id])

  useEffect(() => {
    if (location.hash === '#reviews' && product && document.getElementById('reviews')) {
      document.getElementById('reviews').scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash, product])

  useEffect(() => {
    if (!id) return
    setReviewsError(null)
    setReviewError(null)
    api(`/products/${id}/reviews`)
      .then((data) => {
        setReviews({
          items: data.items || [],
          total: data.total ?? 0,
          average: data.average ?? 0,
          canReview: data.canReview === true,
        })
      })
      .catch(() => setReviewsError(true))
  }, [id, reviewSubmitted])

  const fetchReviews = () => {
    if (!id) return
    api(`/products/${id}/reviews`)
      .then((data) => setReviews({
        items: data.items || [],
        total: data.total ?? 0,
        average: data.average ?? 0,
        canReview: data.canReview === true,
      }))
      .catch(() => { })
  }
  const handleSubmitReview = async (e) => {
    e.preventDefault()
    if (reviewRating < 1 || reviewRating > 5) return
    setReviewSubmitting(true)
    setReviewError(null)
    try {
      await api(`/products/${id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment.trim() }),
      })
      setReviewRating(0)
      setReviewComment('')
      setReviewSuccessToast(true)
      fetchReviews()
    } catch (err) {
      setReviewError(err?.message || t('product.reviewSubmitError'))
    } finally {
      setReviewSubmitting(false)
    }
  }
  const handleDeleteReview = async (reviewId) => {
    if (!confirm(t('product.removeReview'))) return
    try {
      await api(`/reviews/${reviewId}`, { method: 'DELETE' })
      fetchReviews()
    } catch (err) { }
  }
  const canDeleteReviews = user?.role === 'admin' || user?.role === 'super_admin'

  if (loading) return <PageSkeletonProduct />
  if (!product) {
    const fromReviewLink = location.hash === '#reviews'
    const fromAdminReviews = location.search.includes('from=admin-reviews') && (user?.role === 'admin' || user?.role === 'super_admin')
    const adminProductName = fromAdminReviews ? searchParams.get('name') : null
    const adminProductImage = fromAdminReviews ? searchParams.get('image') : null
    const isHexId = (s) => /^[a-f0-9]{24}$/i.test(String(s || ''))
    const showAsId = adminProductName && isHexId(adminProductName)
    return (
      <div className={s.errorWrapper}>
        {fromAdminReviews && (adminProductName || adminProductImage) && (
          <div className={s.errorProductPreview}>
            {adminProductImage && (
              <img src={decodeURIComponent(adminProductImage)} alt="" className={s.errorProductImg} />
            )}
            {adminProductName && (
              <p className={s.errorProductName}>
                {showAsId ? `${t('product.productIdLabel') || 'Product ID'}: ${decodeURIComponent(adminProductName)}` : decodeURIComponent(adminProductName)}
              </p>
            )}
          </div>
        )}
        <ErrorState
          title={t('product.productNotFound')}
          message={fromReviewLink ? t('product.notFoundFromReview') : fromAdminReviews ? t('product.notFoundFromAdminReview') : t('product.notFoundMessage')}
          action={
            <div className={s.errorActions}>
              {fromReviewLink && <Link to="/orders" className={s.errorActionLink}>{t('product.backToOrders')}</Link>}
              {fromAdminReviews && <Link to="/admin/reviews" className={s.errorActionLink}>{t('product.backToAdminReviews')}</Link>}
              <Link to="/shop" className={s.errorActionLink}>{t('product.browseShop')}</Link>
            </div>
          }
        />
      </div>
    )
  }

  const handleAdd = () => {
    addToCart({ ...product, quantity: qty })
    setShowAddedToast(true)
  }

  return (
    <div className={s.page}>
      <BackButton to="/shop" label={t('nav.shop')} />
      <div className={s.grid}>
        <div className={s.imageWrap}>
          {(product.newArrival || product.onSale || product.stock <= 0) && (
            <div className={s.badges}>
              {product.newArrival && <span className={product.classNameNew || s.badgeNew}>{t('product.new')}</span>}
              {product.onSale && product.discountPercent > 0 && (
                <span className={s.badgeSale}>{t('product.percentOff', { percent: product.discountPercent })}</span>
              )}
              {product.stock <= 0 && <span className={s.badgeStock}>{t('product.outOfStock')}</span>}
            </div>
          )}
          <img
            src={mainImage || 'https://placehold.co/600x750/e2e8f0/94a3b8?text=·'}
            alt={display.name}
          />
          {images.length > 1 && (
            <>
              <button
                type="button"
                className={s.navPrev}
                onClick={() => setSelectedImageIndex((i) => (i === 0 ? images.length - 1 : i - 1))}
                aria-label={t('product.prevImage')}
              >
                ‹
              </button>
              <button
                type="button"
                className={s.navNext}
                onClick={() => setSelectedImageIndex((i) => (i === images.length - 1 ? 0 : i + 1))}
                aria-label={t('product.nextImage')}
              >
                ›
              </button>
            </>
          )}
          {images.length > 1 && (
            <div className={s.thumbnails}>
              {images.map((url, idx) => (
                <button
                  key={`${url}-${idx}`}
                  type="button"
                  className={`${s.thumb} ${selectedImageIndex === idx ? s.thumbActive : ''}`}
                  onClick={() => setSelectedImageIndex(idx)}
                  aria-label={t('product.imageNumber', { current: idx + 1, total: images.length })}
                >
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={s.details}>
          <span className={s.category}>{t(`category.${categoryKey(product.category)}`, { defaultValue: product.category || 'Fragrance' })}</span>
          {product.audience && (
            <span className={s.audience}>
              {product.audience === 'men' ? t('product.forHim') : product.audience === 'women' ? t('product.forHer') : t('product.unisex')}
            </span>
          )}
          <h1 className={s.title}>{display.name}</h1>
          {product.rating > 0 && (
            <p className={s.storeRating}>
              {t('product.ratingLabel')}: <StarRatingDisplay value={product.rating} />
            </p>
          )}
          <p className={s.price}>
            {product.onSale && product.discountPercent > 0 && product.price != null ? (
              <>
                <span className={s.originalPrice}>{formatPrice(product.price)}</span>
                <span className={s.salePrice}>{formatPrice(product.price * (1 - (product.discountPercent || 0) / 100))}</span>
              </>
            ) : (
              formatPrice(product.price)
            )}
          </p>
          <p className={s.desc}>
            {display.description || t('product.defaultDescription')}
          </p>

          {/* Scent Profile — MYOP Inspired */}
          {Array.isArray(product.notes) && product.notes.length > 0 && (
            <div className={s.scentProfile}>
              <h3 className={s.subHeading}>{t('product.scentProfile')}</h3>
              <div className={s.notesGrid}>
                {product.notes.length >= 3 ? (
                  <>
                    <div className={s.noteSection}>
                      <span className={s.noteLabel}>{t('product.topNote')}</span>
                      <p className={s.noteValue}>{product.notes[0]}</p>
                    </div>
                    <div className={s.noteSection}>
                      <span className={s.noteLabel}>{t('product.heartNote')}</span>
                      <p className={s.noteValue}>{product.notes[1]}</p>
                    </div>
                    <div className={s.noteSection}>
                      <span className={s.noteLabel}>{t('product.baseNote')}</span>
                      <p className={s.noteValue}>{product.notes[2]}</p>
                    </div>
                  </>
                ) : (
                  <div className={s.noteSection}>
                    <p className={s.noteValue}>{product.notes.join(', ')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Personalization — MYOP Inspired */}
          {user?.role === 'customer' && (
            <div className={s.personalization}>
              <h3 className={s.subHeading}>{t('product.personalize')}</h3>
              <p className={s.personalizationDesc}>{t('product.engravingDesc') || 'Add a custom engraving to your bottle'}</p>
              <input
                type="text"
                placeholder={t('product.engravingPlaceholder') || 'Enter text to engrave...'}
                className={s.engravingInput}
                maxLength={20}
              />
            </div>
          )}

          <div className={s.actions}>
            {user?.role === 'customer' ? (
              <>
                <div className={s.qtyWrap}>
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className={s.qtyBtn}
                  >
                    −
                  </button>
                  <span className={s.qty}>{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(product.stock ?? 0, q + 1))}
                    className={s.qtyBtn}
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={(product.stock ?? 0) < 1}
                  className={`${s.addBtn} ${(product.stock ?? 0) < 1 ? s.disabled : ''}`}
                >
                  {t('product.addToCart')}
                </button>
                {inCart && (
                  <Link to="/cart" className={s.viewCart}>
                    {t('product.viewCart')} →
                  </Link>
                )}
              </>
            ) : !user ? (
              <Link to="/login" className={s.addBtn}>
                {t('product.loginToAdd')}
              </Link>
            ) : null}
          </div>
          {(product.stock ?? 0) < 5 && (product.stock ?? 0) > 0 && (
            <p className={s.stock}>{t('product.onlyLeft', { count: product.stock })}</p>
          )}
        </div>
      </div>

      <section id="reviews" className={s.reviewsSection} aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className={s.reviewsTitle}>{t('product.reviews')}</h2>
        {reviewsError ? (
          <p className={s.reviewsMuted}>{t('product.noReviews')}</p>
        ) : (
          <>
            <div className={s.reviewsSummary}>
              <div className={s.starsWrap} aria-label={t('product.yourRating')}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className={`${s.starIcon} ${reviews.average >= star ? s.starIconFilled : ''}`}>★</span>
                ))}
              </div>
              <span className={s.reviewsAverage}>{reviews.average > 0 ? reviews.average.toFixed(1) : '—'}</span>
              <span className={s.reviewsCount}>
                {reviews.total === 0 ? t('product.noReviews') : t('product.reviewsCount', { count: reviews.total })}
              </span>
            </div>

            {reviewError && <p className={s.reviewError} role="alert">{reviewError}</p>}
            {reviews.canReview && !reviewSubmitted && user?.role === 'customer' && (
              <form onSubmit={handleSubmitReview} className={s.reviewForm}>
                <p className={s.reviewFormLabel}>{t('product.yourRating')}</p>
                <div className={s.starsInput}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`${s.starBtn} ${reviewRating >= star ? s.starBtnFilled : ''}`}
                      onClick={() => setReviewRating(star)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); }}
                      aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
                      aria-pressed={reviewRating >= star}
                    >
                      {reviewRating >= star ? '★' : '★'}
                    </button>
                  ))}
                </div>
                <label className={s.reviewFormLabel} htmlFor="review-comment">{t('product.yourComment')}</label>
                <textarea
                  id="review-comment"
                  className={s.reviewTextarea}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3}
                />
                <button type="submit" className={s.reviewSubmitBtn} disabled={reviewSubmitting || reviewRating < 1}>
                  {reviewSubmitting ? '...' : t('product.submitReview')}
                </button>
              </form>
            )}
            {reviews.canReview === false && user?.role === 'customer' && (
              <p className={s.reviewsMuted}>{t('product.onlyDeliveredReview')}</p>
            )}

            <ul className={s.reviewList}>
              {reviews.items.map((r) => (
                <li key={r.id} className={s.reviewItem}>
                  <div className={s.reviewItemHeader}>
                    <div className={s.starsWrap} aria-hidden>
                      {[1, 2, 3, 4, 5].map((starVal) => (
                        <span key={starVal} className={`${s.starIcon} ${r.rating >= starVal ? s.starIconFilled : ''}`}>★</span>
                      ))}
                    </div>
                    {r.verified && <span className={s.verifiedBadge}>{t('product.verifiedPurchase')}</span>}
                    <span className={s.reviewDate}>{new Date(r.createdAt).toLocaleDateString()}</span>
                    {canDeleteReviews && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(r.id)}
                        className={s.reviewDeleteBtn}
                        aria-label={t('product.removeReview')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {r.comment && <p className={s.reviewComment}>{r.comment}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Toast
        message={t('product.addedToCart')}
        actionLabel={t('product.viewCart')}
        actionTo="/cart"
        visible={showAddedToast}
        onClose={() => setShowAddedToast(false)}
        autoHideMs={5000}
      />
      <Toast
        message={t('product.submitReviewSuccess')}
        visible={reviewSuccessToast}
        onClose={() => setReviewSuccessToast(false)}
        autoHideMs={4000}
      />
    </div>
  )
}
