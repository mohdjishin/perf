import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { PageSkeletonList } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { Toast } from '../../components/Toast'
import s from './Admin.module.css'

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [deleteState, setDeleteState] = useState(null)
  const [deleteMoveTo, setDeleteMoveTo] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [toastError, setToastError] = useState(null)

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

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setError('')
    try {
      const created = await api('/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      })
      setCategories((prev) => [...prev, created])
      setNewName('')
    } catch (err) {
      setError(err.data?.error || err.message)
    }
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

      <form onSubmit={handleCreate} className={s.form}>
        <h3>Add Category</h3>
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end' }}>
          <input
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className={s.input}
            style={{ marginBottom: 0, flex: 1 }}
          />
          <button type="submit" className={s.btn}>
            Add
          </button>
        </div>
        {error && <p style={{ color: 'var(--color-error)', fontSize: '0.9rem', marginTop: 'var(--space-sm)' }}>{error}</p>}
      </form>

      {categories.length > 0 && (
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id || c.name}>
                <td>{c.name}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => openDelete(c)}
                    className={s.smBtnDanger}
                  >
                    Delete
                  </button>
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
