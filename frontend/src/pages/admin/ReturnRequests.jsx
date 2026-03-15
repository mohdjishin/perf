import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { BackButton } from '../../components/BackButton'
import { PageSkeletonList } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import s from './Admin.module.css'

export default function AdminReturnRequests() {
  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    api('/admin/return-requests')
      .then((data) => setItems(Array.isArray(data.items) ? data.items : []))
      .catch((err) => setError(err?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), [])

  const updateStatus = (id, status) => {
    setUpdatingId(id)
    api(`/admin/return-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
      .then(() => load())
      .catch(() => {})
      .finally(() => setUpdatingId(null))
  }

  const updateTracking = (id, payload) => {
    setUpdatingId(id)
    api(`/admin/return-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
      .then(() => load())
      .catch(() => {})
      .finally(() => setUpdatingId(null))
  }

  if (loading) return <PageSkeletonList rows={8} />
  if (error) {
    return (
      <div className={s.page}>
        <BackButton to="/admin" label={t('nav.admin')} />
        <h1 className={s.title}>{t('returns.adminTitle')}</h1>
        <p className={s.error}>{error}</p>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <BackButton to="/admin" label={t('nav.admin')} />
      <h1 className={s.title}>{t('returns.adminTitle')}</h1>
      <p className={s.subtitle}>{t('returns.adminSubtitle')}</p>

      {items.length === 0 ? (
        <EmptyState
          title={t('returns.noRequests')}
          message={t('returns.noRequestsHint')}
        />
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('returns.orderNumber')}</th>
                <th>{t('returns.customer')}</th>
                <th>{t('returns.reason')}</th>
                <th>{t('returns.status')}</th>
                <th>{t('returns.productReceived')}</th>
                <th>{t('returns.refundIssued')}</th>
                <th>{t('returns.createdAt')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/admin/orders?order_id=${r.orderNumber || r.orderId}`} className={s.link}>
                      {r.orderNumber || r.orderId}
                    </Link>
                  </td>
                  <td>
                    {r.customer?.firstName} {r.customer?.lastName}
                    {r.customer?.email && <br />}
                    <small>{r.customer?.email}</small>
                  </td>
                  <td>
                    {r.reason === 'other' && r.reasonOther ? (
                      <span title={r.reasonOther}>Other: {r.reasonOther.slice(0, 40)}{r.reasonOther.length > 40 ? '…' : ''}</span>
                    ) : (
                      r.reasonLabel || r.reason
                    )}
                  </td>
                  <td>
                    <span className={r.status === 'pending' ? s.statusPending : r.status === 'accepted' ? s.statusDelivered : s.statusCancelled}>
                      {r.status === 'pending' && t('returns.pending')}
                      {r.status === 'accepted' && t('returns.accepted')}
                      {r.status === 'rejected' && t('returns.rejected')}
                    </span>
                  </td>
                  <td>
                    {r.productReceivedAt ? new Date(r.productReceivedAt).toLocaleDateString() : (r.status === 'accepted' ? (
                      <button type="button" className={s.btnSuccess} disabled={!!updatingId} onClick={() => updateTracking(r.id, { product_received: true })}>
                        {updatingId === r.id ? '…' : t('returns.markProductReceived')}
                      </button>
                    ) : '—')}
                  </td>
                  <td>
                    {r.refundIssuedAt ? new Date(r.refundIssuedAt).toLocaleDateString() : (r.status === 'accepted' ? (
                      <button type="button" className={s.btnSuccess} disabled={!!updatingId} onClick={() => updateTracking(r.id, { refund_issued: true })}>
                        {updatingId === r.id ? '…' : t('returns.markRefundIssued')}
                      </button>
                    ) : '—')}
                  </td>
                  <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                  <td>
                    {r.status === 'pending' && (
                      <span className={s.actions}>
                        <button
                          type="button"
                          className={s.btnSuccess}
                          disabled={!!updatingId}
                          onClick={() => updateStatus(r.id, 'accepted')}
                        >
                          {updatingId === r.id ? '…' : t('returns.accept')}
                        </button>
                        <button
                          type="button"
                          className={s.btnDanger}
                          disabled={!!updatingId}
                          onClick={() => updateStatus(r.id, 'rejected')}
                        >
                          {t('returns.reject')}
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
