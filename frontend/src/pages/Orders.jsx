import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { formatPrice } from '../utils/currency'
import { downloadOrderInvoice } from '../utils/invoicePdf'
import { PageSkeletonList } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import Pagination from '../components/Pagination'
import { BackButton } from '../components/BackButton'
import s from './Orders.module.css'

const PAGE_SIZE = 2

function normalizeProductId(rawId) {
  if (rawId == null) return ''
  const s = (typeof rawId === 'string' ? rawId : (rawId?.$oid ? String(rawId.$oid) : String(rawId))).trim().toLowerCase()
  const hex = s.replace(/[^a-f0-9]/g, '')
  return hex.length >= 24 ? hex.slice(0, 24) : hex
}

function orderStatusText(status) {
  const s = status != null ? String(status).toLowerCase() : ''
  if (s === 'shipped') return 'Shipped'
  if (s === 'delivered') return 'Delivered'
  if (s) return s.charAt(0).toUpperCase() + s.slice(1)
  return '—'
}

function orderStatusClass(status) {
  const s = status != null ? String(status).toLowerCase() : ''
  if (!s) return ''
  const key = 'status' + s.charAt(0).toUpperCase() + s.slice(1)
  return key
}

function canReturnOrder(order, returnDays) {
  if (!order || String(order.status).toLowerCase() !== 'delivered' || !returnDays || returnDays < 1) return false
  const deliveredAt = order.deliveredAt
    ? new Date(order.deliveredAt)
    : (order.shippingHistory?.length
      ? new Date(order.shippingHistory[order.shippingHistory.length - 1]?.createdAt)
      : new Date(order.updatedAt || order.createdAt))
  const deadline = new Date(deliveredAt)
  deadline.setDate(deadline.getDate() + returnDays)
  return new Date() <= deadline
}

export default function Orders() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState([])
  const [downloadingId, setDownloadingId] = useState(null)
  const [invoiceError, setInvoiceError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [error, setError] = useState(null)
  const [returnDays, setReturnDays] = useState(0)
  const [returnModalOrderId, setReturnModalOrderId] = useState(null)
  const [returnReasons, setReturnReasons] = useState([])
  const [returnRequest, setReturnRequest] = useState(null)
  const [returnReason, setReturnReason] = useState('')
  const [returnReasonOther, setReturnReasonOther] = useState('')
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [returnError, setReturnError] = useState(null)

  useEffect(() => {
    setError(null)
    setLoading(true)
    api(`/orders?page=${page}&limit=${PAGE_SIZE}`)
      .then((data) => {
        setOrders(Array.isArray(data.items) ? data.items : [])
        setPagination(data)
      })
      .catch((err) => {
        setOrders([])
        setPagination(null)
        setError(err?.message || 'Failed to load orders')
      })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => {
    api('/settings/features')
      .then((d) => setReturnDays(Math.max(0, parseInt(d.return_days_after_delivery, 10) || 0)))
      .catch(() => {})
  }, [])

  const openReturnModal = (orderId) => {
    setReturnModalOrderId(orderId)
    setReturnRequest(null)
    setReturnReason('')
    setReturnReasonOther('')
    setReturnError(null)
    Promise.all([
      api(`/orders/${orderId}/return`).then((d) => d.returnRequest || null).catch(() => null),
      api('/return-reasons').then((d) => d.reasons || []).catch(() => []),
    ]).then(([req, reasons]) => {
      setReturnRequest(req)
      setReturnReasons(reasons)
    })
  }

  const closeReturnModal = () => {
    setReturnModalOrderId(null)
    setReturnRequest(null)
    setReturnReason('')
    setReturnReasonOther('')
    setReturnError(null)
  }

  const submitReturnRequest = async () => {
    if (!returnModalOrderId || !returnReason) {
      setReturnError(t('returns.selectReason'))
      return
    }
    if (returnReason === 'other' && !returnReasonOther.trim()) {
      setReturnError(t('returns.otherReasonRequired'))
      return
    }
    setReturnSubmitting(true)
    setReturnError(null)
    try {
      await api(`/orders/${returnModalOrderId}/return`, {
        method: 'POST',
        body: JSON.stringify({
          reason: returnReason,
          reasonOther: returnReason === 'other' ? returnReasonOther.trim() : undefined,
        }),
      })
      setReturnRequest({ status: 'pending', reason: returnReason })
      setOrders((prev) => prev.map((o) => (o.id === returnModalOrderId ? { ...o, _returnRequest: { status: 'pending' } } : o)))
    } catch (err) {
      setReturnError(err?.message || err?.data?.error || 'Failed to submit')
    } finally {
      setReturnSubmitting(false)
    }
  }

  if (loading) return <PageSkeletonList rows={6} />

  if (error) {
    return (
      <div className={s.page}>
        <BackButton to="/shop" label="Shop" />
        <h1 className={s.title}>My Orders</h1>
        <p className={s.subtitle} style={{ color: 'var(--color-error)' }}>{error}</p>
        <EmptyState
          title="Could not load orders"
          message="Please check your connection and try again."
          actionLabel="Back to Shop"
          actionTo="/shop"
        />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className={s.page}>
        <BackButton to="/shop" label="Shop" />
        <h1 className={s.title}>My Orders</h1>
        <p className={s.subtitle}>Your order history</p>
        <EmptyState
          title="No orders yet"
          message="Your order history will appear here after your first purchase."
          actionLabel="Start shopping"
          actionTo="/shop"
        />
      </div>
    )
  }

  return (
    <div className={s.page}>
      <BackButton to="/shop" label="Shop" />
      <h1 className={s.title}>My Orders</h1>
      <p className={s.subtitle}>Your order history</p>

      <div className={s.list}>
        {orders.map((o, i) => {
          const statusStr = o.status != null ? String(o.status).toLowerCase() : ''
          const statusClass = s[orderStatusClass(o.status)] || ''
          return (
          <div key={o.id || `order-${i}`} className={s.card} style={{ animationDelay: `${i * 0.05}s` }}>
            <div className={s.cardHeader}>
              <span className={s.cardHeaderLeft}>
                <span className={s.orderId}>{o.orderNumber ?? '—'}</span>
                <span className={s.date}>
                  {o.createdAt && !isNaN(new Date(o.createdAt).getTime())
                    ? new Date(o.createdAt).toLocaleDateString()
                    : '—'}
                </span>
                {o.total != null && (
                  <span className={s.cardHeaderTotal}>{formatPrice(o.total)}</span>
                )}
              </span>
              <span className={s.statusWrap}>
                <span className={`${s.status} ${statusClass}`}>
                  {orderStatusText(o.status)}
                </span>
                <span className={`${s.paymentBadge} ${(o.paymentStatus || '').toLowerCase() === 'paid' ? s.paymentBadgePaid : s.paymentBadgeUnpaid}`}>
                  {(o.paymentStatus || '').toLowerCase() === 'paid' ? 'Paid' : 'Unpaid'}
                </span>
              </span>
            </div>
            <div className={s.cardBody}>
            {(statusStr === 'shipped' || statusStr === 'delivered') && (
              <div className={s.shippingStatus}>
                <div className={s.shippingStatusTitle}>
                  <span className={s.shippingIcon}>
                    {statusStr === 'shipped' ? '📦' : '✓'}
                  </span>
                  {statusStr === 'shipped' ? 'Shipping updates' : 'Delivery'}
                </div>
                {(() => {
                  const rr = o.returnRequest || o._returnRequest
                  const shippingEntries = (o.shippingHistory?.length > 0 ? [...o.shippingHistory] : [])
                    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                    .map((entry) => ({ date: entry.createdAt, message: entry.message }))
                  const returnEntries = []
                  if (rr && statusStr === 'delivered') {
                    if (rr.createdAt) returnEntries.push({ date: rr.createdAt, message: t('returns.requested') })
                    if (rr.status === 'accepted' && rr.reviewedAt) returnEntries.push({ date: rr.reviewedAt, message: t('returns.initiated') })
                    if (rr.status === 'rejected' && rr.reviewedAt) returnEntries.push({ date: rr.reviewedAt, message: t('returns.canceled') })
                    if (rr.status === 'accepted' && rr.productReceivedAt) returnEntries.push({ date: rr.productReceivedAt, message: t('returns.productReceived') })
                    if (rr.status === 'accepted' && rr.refundIssuedAt) returnEntries.push({ date: rr.refundIssuedAt, message: t('returns.refundIssued') })
                  }
                  const allEntries = [...shippingEntries, ...returnEntries].sort((a, b) => new Date(a.date) - new Date(b.date))
                  if (allEntries.length > 0) {
                    return (
                      <ul className={s.shippingHistory}>
                        {allEntries.map((entry, i) => (
                          <li key={i} className={s.shippingHistoryItem}>
                            <span className={s.shippingHistoryTime}>
                              {new Date(entry.date).toLocaleString()}
                            </span>
                            <span>{entry.message}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  }
                  return (
                    <span className={s.shippingDefault}>
                      {statusStr === 'shipped'
                        ? 'Your order is on its way'
                        : 'Delivered to your address'}
                    </span>
                  )
                })()}
              </div>
            )}
            <div className={s.items}>
              {(Array.isArray(o.items) ? o.items : []).map((item, j) => {
                const productIdStr = normalizeProductId(item?.productId ?? item?.product_id)
                const productLink = productIdStr.length === 24 ? `/product/${productIdStr}` : null
                const imgUrl = item?.imageUrl ?? item?.image_url
                return (
                  <div key={j} className={s.item}>
                    {productLink && (
                      <Link to={productLink} className={s.itemImageWrap} aria-label={item?.name}>
                        <img
                          src={imgUrl || 'https://placehold.co/56x70/e2e8f0/94a3b8?text=·'}
                          alt=""
                          className={s.itemImage}
                        />
                      </Link>
                    )}
                    {!productLink && imgUrl && (
                      <span className={s.itemImageWrap}>
                        <img src={imgUrl} alt="" className={s.itemImage} />
                      </span>
                    )}
                    <span className={s.itemInfo}>
                      {productLink ? (
                        <Link to={productLink} className={s.itemNameLink}>
                          {item?.name ?? '—'} × {item?.quantity ?? 0}
                        </Link>
                      ) : (
                        <span>{item?.name ?? '—'} × {item?.quantity ?? 0}</span>
                      )}
                      {statusStr === 'delivered' && productLink && (
                        <Link to={`/product/${productIdStr}#reviews`} className={s.itemReviewLink}>
                          {t('orders.reviewProduct')}
                        </Link>
                      )}
                    </span>
                    <span className={s.itemPrice}>{formatPrice(Number(item?.price ?? 0) * Number(item?.quantity ?? 0))}</span>
                  </div>
                )
              })}
            </div>
            <div className={s.total}>Total: {formatPrice(o.total)}</div>
            <div className={s.address}>
              {o.address && typeof o.address === 'object'
                ? [o.address.street, o.address.city, o.address.state, o.address.zip, o.address.country].filter(Boolean).join(', ') || '—'
                : '—'}
            </div>
            {statusStr === 'delivered' && (
              <div className={s.orderActions}>
                {invoiceError && (
                  <p className={s.invoiceError} role="alert">{invoiceError}</p>
                )}
                <div className={s.orderActionsButtons}>
                  <button
                    type="button"
                    className={s.invoiceBtn}
                    disabled={!!downloadingId}
                    onClick={async () => {
                      setInvoiceError(null)
                      setDownloadingId(o.id)
                      try {
                        const featuresRes = await api('/settings/features').catch(() => ({}))
                        const invoice = featuresRes?.invoice_company_name != null ? {
                          companyName: (featuresRes.invoice_company_name || '').trim() || 'Blue Mist Perfumes',
                          street: (featuresRes.invoice_street || '').trim(),
                          city: (featuresRes.invoice_city || '').trim(),
                          state: (featuresRes.invoice_state || '').trim(),
                          zip: (featuresRes.invoice_zip || '').trim(),
                          country: (featuresRes.invoice_country || '').trim(),
                          phone: (featuresRes.invoice_phone || '').trim(),
                          email: (featuresRes.invoice_email || '').trim(),
                          trn: (featuresRes.invoice_trn || '').trim() || undefined,
                        } : {}
                        await downloadOrderInvoice(o, invoice)
                      } catch (err) {
                        setInvoiceError(err?.message || 'Download failed. Please try again.')
                      } finally {
                        setDownloadingId(null)
                      }
                    }}
                  >
                    {downloadingId === o.id ? t('orders.downloadingInvoice') : t('orders.downloadInvoice')}
                  </button>
                  {canReturnOrder(o, returnDays) && !(o.returnRequest || o._returnRequest) && (
                    <button
                      type="button"
                      className={s.returnBtn}
                      onClick={() => openReturnModal(o.id)}
                    >
                      {t('returns.requestReturn')}
                    </button>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
          )
        })}
      </div>
      {pagination?.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
        />
      )}

      {returnModalOrderId && (
        <div className={s.modalOverlay} onClick={closeReturnModal} role="dialog" aria-modal="true" aria-labelledby="return-modal-title">
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 id="return-modal-title" className={s.modalTitle}>{t('returns.requestReturn')}</h3>
            {returnRequest ? (
              <div className={s.returnModalStatus}>
                {returnRequest.status === 'accepted' ? (
                  <>
                    <p><strong>{t('returns.initiated')}</strong></p>
                    {returnRequest.reasonLabel && <p>{t('returns.reason')}: {returnRequest.reasonLabel}</p>}
                    {returnRequest.productReceivedAt && (
                      <p>{t('returns.productReceived')}: {new Date(returnRequest.productReceivedAt).toLocaleDateString()}</p>
                    )}
                    {returnRequest.refundIssuedAt && (
                      <p>{t('returns.refundIssued')}: {new Date(returnRequest.refundIssuedAt).toLocaleDateString()}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p>{t('returns.status')}: <strong>{(returnRequest.status === 'pending' && t('returns.pending')) || (returnRequest.status === 'rejected' && t('returns.rejected'))}</strong></p>
                    {returnRequest.reasonLabel && <p>{t('returns.reason')}: {returnRequest.reasonLabel}</p>}
                  </>
                )}
                <button type="button" className={s.invoiceBtn} onClick={closeReturnModal}>{t('returns.close')}</button>
              </div>
            ) : (
              <>
                <label className={s.modalLabel}>
                  {t('returns.selectReason')}
                  <select
                    className={s.modalSelect}
                    value={returnReason}
                    onChange={(e) => { setReturnReason(e.target.value); setReturnReasonOther('') }}
                  >
                    <option value="">—</option>
                    {returnReasons.map((r) => (
                      <option key={r.code} value={r.code}>{r.label}</option>
                    ))}
                  </select>
                </label>
                {returnReason === 'other' && (
                  <label className={s.modalLabel}>
                    {t('returns.otherReasonLabel')}
                    <textarea
                      className={s.modalTextarea}
                      value={returnReasonOther}
                      onChange={(e) => setReturnReasonOther(e.target.value)}
                      placeholder={t('returns.otherReasonPlaceholder')}
                      rows={3}
                      maxLength={500}
                    />
                  </label>
                )}
                {returnError && <p className={s.invoiceError}>{returnError}</p>}
                <div className={s.modalActions}>
                  <button type="button" className={s.returnBtn} onClick={closeReturnModal}>{t('common.cancel')}</button>
                  <button type="button" className={s.invoiceBtn} disabled={returnSubmitting} onClick={submitReturnRequest}>
                    {returnSubmitting ? t('returns.submitting') : t('returns.submit')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
