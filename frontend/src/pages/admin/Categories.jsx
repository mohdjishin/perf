import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, uploadFile } from '../../api/client'
import { PageSkeletonList } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { Toast } from '../../components/Toast'
import s from './Admin.module.css'

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newImageUrl, setNewImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [error, setError] = useState('')
  const [deleteState, setDeleteState] = useState(null)
  const [deleteMoveTo, setDeleteMoveTo] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [toastError, setToastError] = useState(null)
  const [imageMode, setImageMode] = useState('upload') // 'upload' or 'url'

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (deleteState) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [deleteState])

  const loadCategories = () => {
    api('/categories')
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('image', file)
    try {
      const url = await uploadFile(file)
      setNewImageUrl(url)
    } catch (err) {
      setError('Upload failed: ' + (err.data?.error || err.message))
    } finally {
      setUploading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setError('')
    try {
      const created = await api('/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), imageUrl: newImageUrl }),
      })
      setCategories((prev) => [...prev, created])
      setNewName('')
      setNewImageUrl('')
    } catch (err) {
      setError(err.data?.error || err.message)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editingCategory || !newName.trim()) return
    setError('')
    try {
      const updated = await api(`/categories/${editingCategory.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName.trim(), imageUrl: newImageUrl }),
      })
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      cancelEdit()
    } catch (err) {
      setError(err.data?.error || err.message)
    }
  }

  const startEdit = (cat) => {
    setEditingCategory(cat)
    setNewName(cat.name)
    setNewImageUrl(cat.imageUrl || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingCategory(null)
    setNewName('')
    setNewImageUrl('')
    setImageMode('upload')
  }

  const openDelete = async (cat) => {
    setDeleteState({ category: cat, products: null })
    try {
      const data = await api(`/products?category=${encodeURIComponent(cat.name)}&limit=500`)
      const products = data.items || []
      setDeleteState({ category: cat, products })
      setDeleteMoveTo('')
    } catch {
      setDeleteState({ category: cat, products: [] })
      setDeleteMoveTo('')
    }
  }

  const closeDelete = () => {
    setDeleteState(null)
    setDeleteMoveTo('')
  }

  const otherCategories = (deleteState?.category && categories.length > 0)
    ? categories.filter((c) => c.name !== deleteState.category.name).map((c) => c.name).sort()
    : []

  const handleConfirmDelete = async () => {
    if (!deleteState) return
    const { category, products } = deleteState
    if (products?.length > 0 && !deleteMoveTo.trim()) return
    setDeleting(true)
    try {
      const url = `/categories/by-name/${encodeURIComponent(category.name)}`
      await api(url, {
        method: 'DELETE',
        body: JSON.stringify({ moveProductsTo: deleteMoveTo.trim() || undefined }),
      })
      loadCategories()
      closeDelete()
    } catch (err) {
      setToastError(err.data?.error || err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <PageSkeletonList rows={6} />

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
            ← Dashboard
          </Link>
          <h1 className={s.title}>Categories</h1>
          <p className={s.subtitle}>Create categories for products</p>
        </div>
      </header>

      <form onSubmit={editingCategory ? handleUpdate : handleCreate} className={s.form}>
        <h3>{editingCategory ? 'Edit Category' : 'Add Category'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <label className={s.label}>Category Name</label>
              <input
                placeholder="e.g. Woody, Floral..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={s.input}
                style={{ marginBottom: 0 }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className={s.label} style={{ marginBottom: 0 }}>Category Image</label>
                <div className={s.modeToggle}>
                  <button
                    type="button"
                    onClick={() => setImageMode('upload')}
                    className={`${s.modeBtn} ${imageMode === 'upload' ? s.activeMode : ''}`}
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('url')}
                    className={`${s.modeBtn} ${imageMode === 'url' ? s.activeMode : ''}`}
                  >
                    Link
                  </button>
                </div>
              </div>

              {imageMode === 'upload' ? (
                <div className={s.uploadWrap}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className={s.fileInput}
                    id="cat-image-upload"
                    disabled={uploading}
                  />
                  <label htmlFor="cat-image-upload" className={`${s.uploadBtn} ${uploading ? s.uploading : ''}`}>
                    {uploading ? 'Uploading...' : newImageUrl ? 'Change Picture' : 'Upload Picture'}
                  </label>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    className={s.input}
                    style={{ marginBottom: 0 }}
                  />
                </div>
              )}

              {newImageUrl && (
                <div className={s.imagePreview} style={{ height: '80px', width: '80px', borderRadius: '50%', marginTop: '0.5rem', position: 'relative', overflow: 'visible' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--color-primary)' }}>
                    <img src={newImageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewImageUrl('')}
                    style={{ position: 'absolute', top: -5, right: -5, background: 'var(--color-error)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', cursor: 'pointer', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={s.formActions}>
            <button type="submit" className={s.btn} disabled={uploading}>
              {editingCategory ? 'Update Category' : 'Add Category'}
            </button>
            {editingCategory && (
              <button type="button" onClick={cancelEdit} className={s.btnSecondary}>
                Cancel
              </button>
            )}
          </div>
        </div>
        {error && <p style={{ color: 'var(--color-error)', fontSize: '0.9rem', marginTop: 'var(--space-sm)' }}>{error}</p>}
      </form>

      {categories.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Image</th>
                <th>Name</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id || c.name}>
                  <td>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)' }}>
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--color-text-light)' }}>No Img</div>
                      )}
                    </div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className={s.smBtn}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openDelete(c)}
                        className={s.smBtnDanger}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteState && (
        <div className={s.modalOverlay} onClick={closeDelete}>
          <div className={s.productModal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>Delete category “{deleteState.category.name}”?</h3>
              <button type="button" onClick={closeDelete} className={s.modalClose} aria-label="Close">×</button>
            </div>
            <div className={s.modalBody}>
              {deleteState.products === null ? (
                <p className={s.modalLoading}>Loading products…</p>
              ) : deleteState.products.length > 0 ? (
                <>
                  <p className={s.deleteConfirmIntro}>
                    <strong>{deleteState.products.length}</strong> product{deleteState.products.length !== 1 ? 's' : ''} use this category. Choose where to move them:
                  </p>
                  <ul className={s.deleteProductList}>
                    {deleteState.products.slice(0, 10).map((p) => (
                      <li key={p.id}>{p.name}</li>
                    ))}
                    {deleteState.products.length > 10 && (
                      <li className={s.deleteProductMore}>… and {deleteState.products.length - 10} more</li>
                    )}
                  </ul>
                  <label className={s.label}>Move to category</label>
                  <select
                    value={deleteMoveTo}
                    onChange={(e) => setDeleteMoveTo(e.target.value)}
                    className={s.input}
                    required={deleteState.products.length > 0}
                  >
                    <option value="">Select category</option>
                    {otherCategories.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  {otherCategories.length === 0 && (
                    <p className={s.deleteConfirmIntro} style={{ marginTop: '0.5rem', color: 'var(--color-error)' }}>
                      Add another category first, then delete this one to move products there.
                    </p>
                  )}
                </>
              ) : (
                <p className={s.deleteConfirmIntro}>No products use this category. You can delete it safely.</p>
              )}
            </div>
            <div className={s.modalFooter}>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className={s.btn}
                disabled={deleting || (deleteState.products?.length > 0 && !deleteMoveTo.trim()) || (deleteState.products?.length > 0 && otherCategories.length === 0)}
              >
                {deleting ? 'Deleting…' : deleteState.products?.length > 0 ? 'Delete and move' : 'Delete'}
              </button>
              <button type="button" onClick={closeDelete}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {categories.length === 0 && (
        <EmptyState
          title="No categories yet"
          message="Create a category above to organize your fragrances (e.g. Oud, Bakhoor)."
        />
      )}
    </div>
  )
}
