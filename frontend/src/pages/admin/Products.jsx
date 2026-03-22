import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useFeatures } from '../../context/FeaturesContext'
import { api, uploadFile, getMediaUrl } from '../../api/client'
import { formatPrice } from '../../utils/currency'
import { PageSkeletonGrid } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { Toast } from '../../components/Toast'
import { StarRatingDisplay, StarRatingEdit } from '../../components/StarRating'
import Pagination from '../../components/Pagination'
import s from './Admin.module.css'

const PAGE_SIZE = 24

export default function AdminProducts() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { i18nEnabled } = useFeatures()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [editing, setEditing] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    price: '',
    imageUrl: '',
    imageUrls: [],
    category: '',
    audience: '',
    newArrival: false,
    onSale: false,
    discountPercent: '',
    stock: '',
    featured: false,
    notes: '',
    topNote: '',
    heartNote: '',
    baseNote: '',
    seasonalFlag: '',
    rating: 0,
  })
  const [newCategory, setNewCategory] = useState('')
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [toastError, setToastError] = useState(null)
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  const canEditDelete = user?.role === 'admin' || user?.role === 'super_admin'
  const canAddProduct = canEditDelete

  const getProductId = (p) => {
    if (p == null) return null
    const raw = p.id ?? p._id
    return raw != null ? String(raw).trim() : null
  }

  const handleImageUpload = async (e) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    try {
      const urls = await Promise.all(Array.from(files).map((file) => uploadFile(file)))
      setForm((f) => ({
        ...f,
        imageUrls: [...(f.imageUrls || []), ...urls],
        imageUrl: (f.imageUrls?.length ? f.imageUrl : urls[0]) || urls[0],
      }))
    } catch (err) {
      setToastError(err.data?.error || err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  const addImageUrl = (v) => {
    const trimmed = v?.trim()
    if (!trimmed) return
    setForm((f) => ({
      ...f,
      imageUrls: [...(f.imageUrls || []), trimmed],
      imageUrl: (f.imageUrls?.length ? f.imageUrl : trimmed) || trimmed,
    }))
    setImageUrlInput('')
  }
  const moveImage = (index, direction) => {
    const urls = [...(form.imageUrls || [])]
    const next = index + (direction === 'up' ? -1 : 1)
    if (next < 0 || next >= urls.length) return
      ;[urls[index], urls[next]] = [urls[next], urls[index]]
    setForm((f) => ({ ...f, imageUrls: urls, imageUrl: urls[0] || '' }))
  }
  const removeImage = (index) => {
    setForm((f) => {
      const next = [...(f.imageUrls || [])]
      next.splice(index, 1)
      return { ...f, imageUrls: next, imageUrl: next[0] || '' }
    })
  }
  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.setDragImage(e.currentTarget, 0, 0)
  }
  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }
  const handleDragLeave = () => setDragOverIndex(null)
  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }
  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (dragIndex === dropIndex || isNaN(dragIndex)) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }
    const urls = [...(form.imageUrls || [])]
    const [moved] = urls.splice(dragIndex, 1)
    urls.splice(dropIndex, 0, moved)
    setForm((f) => ({ ...f, imageUrls: urls, imageUrl: urls[0] || '' }))
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  useEffect(() => {
    setPage(1)
  }, [searchQuery, categoryFilter, sortBy])

  useEffect(() => {
    if (editing) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [editing])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: PAGE_SIZE })
    if (searchQuery.trim()) params.set('search', searchQuery.trim())
    if (categoryFilter) params.set('category', categoryFilter)
    if (sortBy) params.set('sort', sortBy)
    Promise.all([
      api(`/products?${params}`).catch(() => ({ items: [] })),
      api('/categories').catch(() => []),
    ]).then(([prodData, cats]) => {
      setProducts(prodData.items || [])
      setPagination(prodData)
      setCategories(cats)
    }).finally(() => setLoading(false))
  }, [page, refreshKey, searchQuery, categoryFilter, sortBy])

  const openCreate = () => {
    setEditing('new')
    setForm({
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      price: '',
      imageUrl: '',
      imageUrls: [],
      category: '',
      audience: '',
      newArrival: false,
      onSale: false,
      discountPercent: '',
      stock: '1',
      featured: false,
      notes: '',
      topNote: '',
      heartNote: '',
      baseNote: '',
      seasonalFlag: '',
      rating: 0,
    })
    setNewCategory('')
    setImageUrlInput('')
  }

  const openEdit = (p) => {
    const listId = getProductId(p)
    if (!listId) return
    setEditLoading(true)
    setEditing(listId)
    api(`/products/${listId}`)
      .then((product) => {
        const id = product?.id ?? product?._id ?? listId
        setEditing(id)
        const urls = Array.isArray(product.imageUrls) && product.imageUrls.length > 0
          ? product.imageUrls
          : product.imageUrl ? [product.imageUrl] : []
        setForm({
          name: product.name,
          nameAr: product.nameAr || '',
          description: product.description || '',
          descriptionAr: product.descriptionAr || '',
          price: product.price,
          imageUrl: urls[0] || '',
          imageUrls: urls,
          category: product.category || '',
          audience: product.audience || '',
          newArrival: product.newArrival === true,
          onSale: product.onSale === true,
          discountPercent: product.discountPercent != null ? product.discountPercent : '',
          stock: product.stock,
          featured: product.featured === true,
          notes: Array.isArray(product.notes) ? product.notes.join(', ') : (product.notes || ''),
          topNote: product.topNote || '',
          heartNote: product.heartNote || '',
          baseNote: product.baseNote || '',
          seasonalFlag: product.seasonalFlag || '',
          rating: product.rating != null ? product.rating : 0,
        })
        setNewCategory('')
        setImageUrlInput('')
      })
      .catch((err) => {
        setEditing(null)
        setToastError(err.data?.error || err.message || t('adminProducts.productNotFound'))
      })
      .finally(() => setEditLoading(false))
  }

  const closeModal = () => {
    setEditing(null)
    setImageUrlInput('')
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault()
    if (!newCategory.trim()) return
    try {
      const created = await api('/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCategory.trim() }),
      })
      setCategories((prev) => [...prev, created])
      setForm((f) => ({ ...f, category: created.name }))
      setNewCategory('')
    } catch (err) {
      setToastError(err.data?.error || err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const category = form.category || newCategory.trim() || undefined
      if (editing === 'new') {
        await api('/products', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            nameAr: form.nameAr?.trim() || undefined,
            description: form.description,
            descriptionAr: form.descriptionAr?.trim() || undefined,
            price: parseFloat(form.price),
            imageUrl: form.imageUrl || undefined,
            imageUrls: (form.imageUrls?.length && form.imageUrls) || undefined,
            category: category,
            audience: form.audience || undefined,
            newArrival: form.newArrival === true,
            onSale: form.onSale === true,
            discountPercent: form.onSale && form.discountPercent !== '' ? parseInt(form.discountPercent) || 0 : 0,
            stock: parseInt(form.stock) || 0,
            featured: form.featured === true,
            notes: form.notes.trim() ? form.notes.split(',').map((s) => s.trim()).filter(Boolean) : [],
            topNote: form.topNote?.trim(),
            heartNote: form.heartNote?.trim(),
            baseNote: form.baseNote?.trim(),
            seasonalFlag: form.seasonalFlag?.trim() || undefined,
            rating: form.rating >= 1 && form.rating <= 5 ? form.rating : 0,
          }),
        })
        setPage(1)
      } else {
        const productId = String(editing).trim()
        if (!productId) {
          setToastError(t('adminProducts.productIdMissing'))
          return
        }
        const updated = await api(`/products/${productId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: form.name,
            nameAr: form.nameAr?.trim() || undefined,
            description: form.description,
            descriptionAr: form.descriptionAr?.trim() || undefined,
            price: parseFloat(form.price),
            imageUrl: form.imageUrl || undefined,
            imageUrls: (form.imageUrls?.length && form.imageUrls) || undefined,
            category: category,
            audience: form.audience || undefined,
            newArrival: form.newArrival === true,
            onSale: form.onSale === true,
            discountPercent: form.onSale && form.discountPercent !== '' ? parseInt(form.discountPercent) || 0 : 0,
            stock: parseInt(form.stock) || 0,
            featured: form.featured === true,
            notes: form.notes.trim() ? form.notes.split(',').map((s) => s.trim()).filter(Boolean) : [],
            topNote: form.topNote?.trim(),
            heartNote: form.heartNote?.trim(),
            baseNote: form.baseNote?.trim(),
            seasonalFlag: form.seasonalFlag?.trim() || undefined,
            rating: form.rating >= 0 && form.rating <= 5 ? form.rating : undefined,
          }),
        })
        setProducts((prev) => prev.map((p) => (getProductId(p) === editing ? { ...p, ...updated } : p)))
      }
      setRefreshKey((k) => k + 1)
      closeModal()
    } catch (err) {
      setToastError(err.data?.error || err.message)
    }
  }

  const handleDelete = async (id) => {
    const productId = id != null ? String(id) : null
    if (!productId || !confirm(t('adminProducts.confirmDeactivate'))) return
    try {
      await api(`/products/${productId}`, { method: 'DELETE' })
      setPage(1)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setToastError(err.data?.error || err.message)
    }
  }

  const allCategories = [...categories.map((c) => c.name), ...products.map((p) => p.category).filter(Boolean)]
  const uniqueCategories = [...new Set(allCategories)].filter(Boolean).sort()

  if (loading) return <PageSkeletonGrid count={8} />

  return (
    <div className={s.page}>
      <Toast
        visible={!!toastError}
        message={toastError || ''}
        onClose={() => setToastError(null)}
        autoHideMs={5000}
      />
      <header className={s.header}>
        <div>
          <Link to="/admin" className={s.back}>
            ← {t('adminProducts.dashboard')}
          </Link>
          <h1 className={s.title}>{t('adminProducts.title')}</h1>
          <p className={s.subtitle}>
            {canAddProduct ? t('adminProducts.subtitle') : t('adminProducts.subtitleViewOnly')}
          </p>
        </div>
        <div className={s.productsToolbar}>
          <div className={s.filtersRow}>
            <div className={s.searchRow}>
              <input
                type="search"
                placeholder={t('adminProducts.searchPlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSearchQuery(searchInput.trim())}
                className={s.searchInput}
                aria-label={t('adminProducts.searchAria')}
              />
              <button
                type="button"
                onClick={() => setSearchQuery(searchInput.trim())}
                className={s.searchBtn}
              >
                {t('adminProducts.search')}
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                  className={s.smBtn}
                >
                  {t('adminProducts.clear')}
                </button>
              )}
            </div>
            <label className={s.filterLabel}>
              <span>{t('adminProducts.category')}</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={s.statusFilter}
                aria-label={t('adminProducts.categoryAria')}
              >
                <option value="">{t('adminProducts.all')}</option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className={s.filterLabel}>
              <span>{t('shop.sortLabel')}</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={s.statusFilter}
                aria-label="Sort products"
              >
                <option value="">{t('shop.sortNewest')}</option>
                <option value="price_asc">{t('shop.sortPriceAsc')}</option>
                <option value="price_desc">{t('shop.sortPriceDesc')}</option>
                <option value="rating_desc">{t('shop.sortRatingDesc')}</option>
                <option value="rating_asc">{t('shop.sortRatingAsc')}</option>
              </select>
            </label>
          </div>
          {canAddProduct && (
            <button onClick={openCreate} className={s.btn} type="button">
              {t('adminProducts.addProduct')}
            </button>
          )}
        </div>
      </header>

      {editing && (
        <div className={s.modalOverlay} onClick={closeModal}>
          <div className={s.productModal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>{editing === 'new' ? t('adminProducts.newProduct') : t('adminProducts.editProduct')}</h3>
              <button type="button" onClick={closeModal} className={s.modalClose} aria-label={t('adminProducts.close')}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className={s.modalForm}>
              <div className={s.modalBody}>
                {editing !== 'new' && editLoading ? (
                  <p className={s.loadingText}>{t('adminProducts.loadingProduct')}</p>
                ) : (
                  <>
                    <div className={s.modalFieldGroup}>
                      <label className={s.label} htmlFor="product-name">{t('adminProducts.productNameEnglish')}</label>
                      <input
                        id="product-name"
                        placeholder={t('adminProducts.productNamePlaceholder')}
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        required
                        className={s.input}
                      />
                    </div>
                    <div className={s.modalFieldGroup}>
                      <label className={s.label} htmlFor="product-description">{t('adminProducts.descriptionEnglish')}</label>
                      <textarea
                        id="product-description"
                        placeholder={t('adminProducts.descriptionPlaceholder')}
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        required
                        className={s.input}
                        rows={3}
                      />
                    </div>
                    {i18nEnabled && (
                      <>
                        <div className={s.modalFieldGroup}>
                          <label className={s.label} htmlFor="product-name-ar">{t('adminProducts.nameArabic')}</label>
                          <input
                            id="product-name-ar"
                            placeholder={t('adminProducts.nameArabicPlaceholder')}
                            value={form.nameAr}
                            onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                            className={s.input}
                            dir="rtl"
                          />
                        </div>
                        <div className={s.modalFieldGroup}>
                          <label className={s.label} htmlFor="product-description-ar">{t('adminProducts.descriptionArabic')}</label>
                          <textarea
                            id="product-description-ar"
                            placeholder={t('adminProducts.descriptionArabicPlaceholder')}
                            value={form.descriptionAr}
                            onChange={(e) => setForm((f) => ({ ...f, descriptionAr: e.target.value }))}
                            className={s.input}
                            rows={3}
                            dir="rtl"
                          />
                        </div>
                      </>
                    )}
                    <div className={s.modalFormRow}>
                      <div className={s.modalFieldGroup}>
                        <label className={s.label} htmlFor="product-price">{t('adminProducts.price')}</label>
                        <input
                          id="product-price"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={form.price}
                          onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                          required
                          className={s.input}
                        />
                      </div>
                      <div className={s.modalFieldGroup}>
                        <label className={s.label} htmlFor="product-stock">{t('adminProducts.stock')}</label>
                        <input
                          id="product-stock"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={form.stock}
                          onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                          className={s.input}
                        />
                        {(parseInt(form.stock) || 0) === 0 && (
                          <p style={{ color: '#b45309', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                            ⚠ Stock is 0 — customers will not be able to add this product to their cart.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className={s.imageSection}>
                      <label className={s.label}>{t('adminProducts.image')}</label>
                      <div className={s.imageOptions}>
                        <div className={s.uploadWrap}>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            multiple
                            onChange={handleImageUpload}
                            disabled={uploading}
                            className={s.fileInput}
                            id="product-image-upload"
                          />
                          <label htmlFor="product-image-upload" className={`${s.uploadBtn} ${uploading ? s.uploading : ''}`}>
                            {uploading ? t('adminProducts.uploading') : t('adminProducts.upload')}
                          </label>
                        </div>
                        <span className={s.or}>{t('adminProducts.orUrl')}</span>
                        <input
                          type="url"
                          placeholder={t('adminProducts.imageUrlPlaceholder')}
                          value={imageUrlInput}
                          onChange={(e) => setImageUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addImageUrl(imageUrlInput)
                            }
                          }}
                          className={s.input}
                          style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
                          aria-label={t('adminProducts.imageUrlAria')}
                        />
                        <button
                          type="button"
                          onClick={() => addImageUrl(imageUrlInput)}
                          className={s.insertUrlBtn}
                          disabled={!imageUrlInput?.trim()}
                        >
                          {t('adminProducts.insertUrl')}
                        </button>
                      </div>
                      {(form.imageUrls?.length > 0) ? (
                        <div className={s.imageThumbnails}>
                          {(form.imageUrls || []).map((url, idx) => (
                            <div
                              key={`${url}-${idx}`}
                              className={`${s.thumbWrap} ${draggedIndex === idx ? s.thumbDragging : ''} ${dragOverIndex === idx ? s.thumbDragOver : ''}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDragLeave={handleDragLeave}
                              onDragEnd={handleDragEnd}
                              onDrop={(e) => handleDrop(e, idx)}
                            >
                              <span className={s.thumbGrip} aria-hidden>⋮⋮</span>
                              <img
                                src={getMediaUrl(url)}
                                alt={t('adminProducts.preview')}
                                onError={(e) => { e.target.style.display = 'none' }}
                                className={s.thumbImg}
                                draggable={false}
                              />
                              <div className={s.thumbActions}>
                                <button
                                  type="button"
                                  onClick={() => removeImage(idx)}
                                  className={s.thumbRemove}
                                  aria-label={t('common.delete')}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : form.imageUrl ? (
                        <div className={s.imagePreview}>
                          <img
                            src={getMediaUrl(form.imageUrl)}
                            alt={t('adminProducts.preview')}
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className={s.categorySection}>
                      <label className={s.label} htmlFor="product-category">{t('adminProducts.category')}</label>
                      <div className={s.categoryRow}>
                        <select
                          id="product-category"
                          value={form.category}
                          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                          className={s.input}
                          style={{ marginBottom: 0 }}
                        >
                          <option value="">{t('adminProducts.selectCategory')}</option>
                          {uniqueCategories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <span className={s.or}>{t('adminProducts.orNew')}</span>
                        <input
                          placeholder={t('adminProducts.newCategoryPlaceholder')}
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className={s.input}
                          style={{ marginBottom: 0, flex: 1 }}
                          aria-label={t('adminProducts.newCategoryAria')}
                        />
                        <button
                          type="button"
                          onClick={handleCreateCategory}
                          disabled={!newCategory.trim()}
                          className={s.btn}
                        >
                          {t('adminProducts.add')}
                        </button>
                      </div>
                      <Link to="/admin/categories" className={s.categoryLink}>{t('adminProducts.manageCategories')}</Link>
                    </div>
                    <div className={s.modalFieldGroup}>
                      <label className={s.label} htmlFor="product-audience">{t('adminProducts.audience')}</label>
                      <select
                        id="product-audience"
                        value={form.audience}
                        onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                        className={s.input}
                      >
                        <option value="">{t('adminProducts.any')}</option>
                        <option value="men">{t('product.forHim')}</option>
                        <option value="women">{t('product.forHer')}</option>
                        <option value="unisex">{t('adminProducts.unisex')}</option>
                      </select>
                    </div>
                    <div className={s.modalFieldGroup}>
                      <label className={s.label} htmlFor="product-seasonal-flag">{t('adminProducts.seasonalFlag')}</label>
                      <input
                        id="product-seasonal-flag"
                        type="text"
                        placeholder={t('adminProducts.seasonalFlagPlaceholder')}
                        value={form.seasonalFlag}
                        onChange={(e) => setForm((f) => ({ ...f, seasonalFlag: e.target.value }))}
                        className={s.input}
                        aria-label={t('adminProducts.seasonalFlagAria')}
                      />
                    </div>
                    <div className={s.modalFieldGroup}>
                      <label className={s.label}>{t('adminProducts.scentProfile') || 'Scent Profile'}</label>
                      <div className={s.scentNotesGrid}>
                        <input
                          placeholder={t('adminProducts.topNotePlaceholder')}
                          value={form.topNote}
                          onChange={(e) => setForm((f) => ({ ...f, topNote: e.target.value }))}
                          className={s.input}
                        />
                        <input
                          placeholder={t('adminProducts.heartNotePlaceholder')}
                          value={form.heartNote}
                          onChange={(e) => setForm((f) => ({ ...f, heartNote: e.target.value }))}
                          className={s.input}
                        />
                        <input
                          placeholder={t('adminProducts.baseNotePlaceholder')}
                          value={form.baseNote}
                          onChange={(e) => setForm((f) => ({ ...f, baseNote: e.target.value }))}
                          className={s.input}
                        />
                      </div>
                    </div>
                    <div className={s.modalFieldGroup}>
                      <label className={s.label} htmlFor="product-notes">{t('adminProducts.notes')}</label>
                      <input
                        id="product-notes"
                        type="text"
                        placeholder={t('adminProducts.notesPlaceholder')}
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        className={s.input}
                        aria-label={t('adminProducts.notesAria')}
                      />
                    </div>
                    <div className={s.modalFormRow}>
                      <div className={s.modalFieldGroup}>
                        <label className={s.checkLabel}>
                          <input
                            type="checkbox"
                            checked={form.newArrival === true}
                            onChange={(e) => setForm((f) => ({ ...f, newArrival: e.target.checked }))}
                          />
                          <span>{t('adminProducts.newArrival')}</span>
                        </label>
                      </div>
                      <div className={s.modalFieldGroup}>
                        <label className={s.checkLabel}>
                          <input
                            type="checkbox"
                            checked={form.onSale === true}
                            onChange={(e) => setForm((f) => ({ ...f, onSale: e.target.checked }))}
                          />
                          <span>{t('adminProducts.onSale')}</span>
                        </label>
                      </div>
                    </div>
                    {form.onSale && (
                      <div className={s.modalFieldGroup}>
                        <label className={s.label} htmlFor="product-discount">{t('adminProducts.discountPercent')}</label>
                        <input
                          id="product-discount"
                          type="number"
                          min="0"
                          max="100"
                          placeholder={t('adminProducts.discountPlaceholder')}
                          value={form.discountPercent}
                          onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                          className={s.input}
                        />
                      </div>
                    )}
                    <div className={s.modalFieldGroup}>
                      <label className={s.checkLabel}>
                        <input
                          type="checkbox"
                          checked={form.featured === true}
                          onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                        />
                        <span>{t('adminProducts.featuredOnHome')}</span>
                      </label>
                    </div>
                    <div className={s.modalFieldGroup}>
                      <label className={s.label}>{t('adminProducts.ratingLabel')}</label>
                      <StarRatingEdit
                        value={form.rating}
                        onChange={(v) => setForm((f) => ({ ...f, rating: v }))}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className={s.modalFooter}>
                <button type="submit" className={s.btn} disabled={editing !== 'new' && editLoading}>
                  {t('common.save')}
                </button>
                <button type="button" onClick={closeModal}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('adminProducts.imageCol')}</th>
                <th>{t('adminProducts.nameCol')}</th>
                <th>{t('adminProducts.categoryCol')}</th>
                <th>{t('adminProducts.audienceCol')}</th>
                <th>{t('adminProducts.newSaleCol')}</th>
                <th>{t('adminProducts.priceCol')}</th>
                <th>{t('adminProducts.stockCol')}</th>
                <th>{t('adminProducts.statusCol')}</th>
                <th>{t('adminProducts.featuredCol')}</th>
                <th>{t('adminProducts.ratingCol')}</th>
                {canEditDelete && <th></th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={getProductId(p) ?? p.name}>
                  <td>
                    <img
                      src={getMediaUrl(p.imageUrl) || 'https://placehold.co/60x60/e2e8f0/94a3b8?text=·'}
                      alt=""
                      className={s.thumb}
                      loading="lazy"
                    />
                  </td>
                  <td>{p.name}</td>
                  <td>{p.category || '—'}</td>
                  <td>{p.audience === 'men' ? t('adminProducts.him') : p.audience === 'women' ? t('adminProducts.her') : p.audience === 'unisex' ? t('adminProducts.unisex') : '—'}</td>
                  <td>
                    {p.newArrival && 'New '}
                    {p.onSale && p.discountPercent > 0 ? `${p.discountPercent}% off` : p.onSale ? 'Sale' : ''}
                    {!p.newArrival && !p.onSale && '—'}
                  </td>
                  <td>{formatPrice(p.price)}</td>
                  <td>{p.stock}</td>
                  <td>{p.active ? t('adminProducts.active') : t('adminProducts.inactive')}</td>
                  <td>{p.featured ? t('adminProducts.yes') : '—'}</td>
                  <td>{p.rating > 0 ? <StarRatingDisplay value={p.rating} /> : '—'}</td>
                  {canEditDelete && (
                    <td>
                      <button
                        onClick={() => openEdit(p)}
                        className={s.smBtn}
                        type="button"
                      >
                        {t('common.edit')}
                      </button>
                      {p.active && (
                        <button
                          onClick={() => handleDelete(getProductId(p))}
                          className={s.smBtnDanger}
                          type="button"
                        >
                          {t('common.delete')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination?.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
        />
      )}

      {products.length === 0 && !editing && (
        <EmptyState
          title={searchQuery || categoryFilter ? t('adminProducts.noProductsFound') : t('adminProducts.noProducts')}
          message={searchQuery || categoryFilter ? t('adminProducts.tryDifferent') : t('adminProducts.emptyMessage')}
        />
      )}
    </div>
  )
}
