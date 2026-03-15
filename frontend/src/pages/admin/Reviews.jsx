import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { PageSkeletonList } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { Toast } from '../../components/Toast'
import s from './Admin.module.css'

// Normalize product ID for /product/:id (24-char hex from API).
function normalizeProductId(id) {
  const s = String(id ?? '').trim().toLowerCase()
  const hex = s.replace(/[^a-f0-9]/g, '')
  return hex.length >= 24 ? hex.slice(0, 24) : hex || ''
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [toastError, setToastError] = useState(null)
  const [actingId, setActingId] = useState(null)
  const load = () => {
    setLoading(true)
    const q = unreadOnly ? '?unread_only=1' : ''
    api(`/admin/reviews${q}`)
      .then((data) => setReviews(data.items || []))
      .catch((err) => {
        setReviews([])
        setToastError(err.data?.error || err.message)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [unreadOnly])

  const markRead = async (id) => {
    setActingId(id)
    try {
      await api(`/admin/reviews/${id}/read`, { method: 'PATCH' })
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, readAt: new Date().toISOString() } : r)))
    } catch (err) {
      setToastError(err.data?.error || err.message)
    } finally {
      setActingId(null)
    }
  }

  const deleteReview = async (id) => {
    if (!confirm('Remove this review? This cannot be undone.')) return
    setActingId(id)
    try {
      await api(`/reviews/${id}`, { method: 'DELETE' })
      setReviews((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setToastError(err.data?.error || err.message)
    } finally {
      setActingId(null)
    }
  }

  if (loading) return <PageSkeletonList rows={8} />

  return (
    <div className={s.page}>
      <Link to="/admin" className={s.back}>← Dashboard</Link>
      <h1 className={s.title}>Reviews</h1>
      <p className={s.subtitle}>Newly added reviews from customers</p>

      <div className={s.filtersRow}>
        <label className={s.filterLabel}>
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          <span>Unread only</span>
        </label>
      </div>

      {toastError && (
        <Toast message={toastError} onClose={() => setToastError(null)} variant="error" />
      )}

      {reviews.length > 0 ? (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      to={(() => {
                        const pid = normalizeProductId(r.productId)
                        const base = pid ? `/product/${pid}?from=admin-reviews` : '/shop'
                        const name = r.productName && !/^[a-f0-9]{24}$/i.test(String(r.productName).trim()) ? r.productName : ''
                        const img = r.productImage || ''
                        const q = [name && `name=${encodeURIComponent(name)}`, img && `image=${encodeURIComponent(img)}`].filter(Boolean).join('&')
                        return q ? `${base}&${q}` : base
                      })()}
                      className={s.reviewProductCell}
                    >
                      {r.productImage && (
                        <img
                          src={r.productImage}
                          alt=""
                          className={s.reviewProductImg}
                        />
                      )}
                      <span className={s.reviewProductName}>
                        {r.productName || r.productId || '—'}
                      </span>
                    </Link>
                  </td>
                  <td>{'★'.repeat(r.rating || 0)}{'☆'.repeat(5 - (r.rating || 0))}</td>
                  <td className={s.reviewComment}>{r.comment || '—'}</td>
                  <td className={s.reviewDate}>
                    {r.createdAt && !isNaN(new Date(r.createdAt).getTime())
                      ? new Date(r.createdAt).toLocaleString()
                      : '—'}
                  </td>
                  <td>
                    {r.readAt ? (
                      <span className={s.reviewRead}>Read</span>
                    ) : (
                      <span className={s.reviewUnread}>New</span>
                    )}
                  </td>
                  <td>
                    {!r.readAt && (
                      <button
                        type="button"
                        className={s.smBtn}
                        onClick={() => markRead(r.id)}
                        disabled={actingId === r.id}
                      >
                        {actingId === r.id ? '…' : 'Mark read'}
                      </button>
                    )}
                    <button
                      type="button"
                      className={s.smBtnDanger}
                      onClick={() => deleteReview(r.id)}
                      disabled={actingId === r.id}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={unreadOnly ? 'No unread reviews' : 'No reviews yet'}
          message={unreadOnly ? 'All reviews have been marked as read.' : 'Customer reviews will appear here.'}
          actionLabel="Back to Dashboard"
          actionTo="/admin"
        />
      )}
    </div>
  )
}
