import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api/client'
import { formatPrice } from '../../utils/currency'
import { PageSkeletonList } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { Toast } from '../../components/Toast'
import Pagination from '../../components/Pagination'
import s from './Admin.module.css'

const PAGE_SIZE = 10

const STATUS_LABELS = {
  pending: 'Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const PAYMENT_LABELS = { unpaid: 'Unpaid', paid: 'Paid' }

/** Fulfillment: next statuses only (shipping/delivery; payment is separate). */
function getNextStatusOptions(currentStatus) {
  const s = (currentStatus || '').toLowerCase()
  if (s === 'pending' || s === 'paid') return [{ value: 'shipped', label: 'Shipped' }, { value: 'cancelled', label: 'Cancelled' }]
  if (s === 'shipped') return [{ value: 'delivered', label: 'Delivered' }, { value: 'cancelled', label: 'Cancelled' }]
  if (s === 'delivered' || s === 'cancelled') return []
  return [{ value: 'shipped', label: 'Shipped' }, { value: 'cancelled', label: 'Cancelled' }]
}

function ShippingHistoryForm({ shippingHistory = [], onAdd }) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onAdd(value.trim())
      setValue('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={s.shippingSection}>
      <div className={s.shippingSectionTitle}>Shipping history</div>
      {shippingHistory.length > 0 && (
        <ul className={s.shippingHistory}>
          {[...shippingHistory].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map((entry, i) => (
            <li key={i} className={s.shippingHistoryItem}>
              <span className={s.shippingHistoryTime}>
                {new Date(entry.createdAt).toLocaleString()}
              </span>
              <span>{entry.message}</span>
              {entry.updatedBy && (
                <span className={s.shippingHistoryBy}>by {entry.updatedBy}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className={s.shippingForm}>
        <input
          type="text"
          placeholder="Add update (e.g. Reached Dubai, Out for delivery)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className={s.shippingInput}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !value.trim()}
          className={s.shippingSaveBtn}
        >
          {saving ? 'Adding...' : 'Add'}
        </button>
      </div>
    </div>
  )
}

export default function AdminOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [orderIdSearch, setOrderIdSearch] = useState('')
  const [orderIdQuery, setOrderIdQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [toastError, setToastError] = useState(null)
  const [statusConfirm, setStatusConfirm] = useState(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [statusDraft, setStatusDraft] = useState(null)
  const [pendingOrdersCount, setPendingOrdersCount] = useState(null)

  const canUpdateStatus = user?.role === 'admin' || user?.role === 'super_admin'

  useEffect(() => {
    api('/admin/stats')
      .then((data) => setPendingOrdersCount(data.pendingOrdersCount ?? 0))
      .catch(() => { })
  }, [])

  // Keep draft in sync with selected order (when modal opens or after update)
  useEffect(() => {
    if (selectedOrder) setStatusDraft(selectedOrder.status)
    else setStatusDraft(null)
  }, [selectedOrder?.id, selectedOrder?.status])

  const handleSearch = () => {
    setOrderIdQuery(orderIdSearch.trim())
    setPage(1)
  }

  const closeModal = () => {
    setSelectedOrder(null)
    setDetailLoading(false)
  }

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key !== 'Escape') return
      if (statusConfirm) setStatusConfirm(null)
      else closeModal()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [statusConfirm])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), list: '1' })
    if (orderIdQuery) params.set('order_id', orderIdQuery)
    if (statusFilter) params.set('status', statusFilter)
    if (paymentFilter) params.set('payment_status', paymentFilter)
    api(`/orders?${params}`)
      .then((data) => {
        setOrders(data.items || [])
        setPagination(data)
      })
      .catch(() => {
        setOrders([])
        setPagination(null)
      })
      .finally(() => setLoading(false))
  }, [page, orderIdQuery, statusFilter, paymentFilter])

  const updateStatus = async (orderId, { status, paymentStatus, shippingMessage } = {}) => {
    setStatusUpdating(true)
    try {
      const body = {}
      if (status != null) body.status = status
      if (paymentStatus != null) body.paymentStatus = paymentStatus
      if (shippingMessage != null) body.shippingMessage = shippingMessage
      const updated = await api(`/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)))
      if (selectedOrder?.id === orderId) setSelectedOrder((prev) => (prev ? { ...prev, ...updated } : prev))
      setStatusConfirm(null)
      api('/admin/stats').then((data) => setPendingOrdersCount(data.pendingOrdersCount ?? 0)).catch(() => { })
    } catch (err) {
      setToastError(err.data?.error || err.message)
    } finally {
      setStatusUpdating(false)
    }
  }

  const openStatusConfirm = () => {
    if (!selectedOrder || statusDraft === selectedOrder.status) return
    setStatusConfirm({ orderId: selectedOrder.id, fromStatus: selectedOrder.status, toStatus: statusDraft })
  }

  const confirmStatusChange = () => {
    if (!statusConfirm) return
    updateStatus(statusConfirm.orderId, { status: statusConfirm.toStatus })
  }

  const setPaymentStatus = (orderId, paymentStatus) => {
    updateStatus(orderId, { paymentStatus })
  }

  const hasStatusChange = selectedOrder && statusDraft !== null && statusDraft !== selectedOrder.status
  const canSubmitStatus = hasStatusChange && getNextStatusOptions(selectedOrder?.status).some((o) => o.value === statusDraft)

  const addShippingEntry = async (orderId, message) => {
    const order = selectedOrder || orders.find((o) => o.id === orderId)
    if (!order) return
    await updateStatus(orderId, { status: order.status, shippingMessage: message })
  }

  const openOrderDetail = async (order) => {
    setDetailLoading(true)
    setSelectedOrder(null)
    try {
      const full = await api(`/orders/${order.id}`)
      setSelectedOrder(full)
    } catch (err) {
      setToastError(err.data?.error || err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const copyOrderId = (text) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
    } else {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
  }

  if (loading) return <PageSkeletonList rows={8} />

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
          <h1 className={s.title}>
            Orders
            {pendingOrdersCount != null && pendingOrdersCount > 0 && (
              <span className={s.cardBadge} style={{ marginLeft: '0.5rem' }} aria-label={`${pendingOrdersCount} pending`}>
                {pendingOrdersCount}
              </span>
            )}
          </h1>
          <p className={s.subtitle}>
            {canUpdateStatus ? 'View and update order status' : 'View all orders'}
          </p>
        </div>
        <div className={s.filtersRow}>
          <div className={s.searchRow}>
            <input
              type="text"
              placeholder="Search by Order ID (e.g. ORD-20240227-1D11645)"
              value={orderIdSearch}
              onChange={(e) => setOrderIdSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className={s.searchInput}
            />
            <button type="button" onClick={handleSearch} className={s.searchBtn}>
              Search
            </button>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className={s.statusFilter}
            aria-label="Filter by order status"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
            className={s.statusFilter}
            aria-label="Filter by payment"
          >
            <option value="">All payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
      </header>

      {orders.length > 0 && (
        <div className={s.orderList}>
          {orders.map((o, i) => (
            <div
              key={o.id}
              className={s.orderRow}
              style={{ animationDelay: `${i * 0.03}s` }}
              onClick={() => openOrderDetail(o)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openOrderDetail(o)}
            >
              <span className={s.orderRowId}>{o.orderNumber}</span>
              <span className={s.orderRowDate}>{new Date(o.createdAt).toLocaleDateString()}</span>
              <span className={s.orderRowCustomer}>
                {o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : '—'}
              </span>
              <div className={s.orderRowStatusWrap}>
                <div className={s.statusBadge}>
                  <span className={s.statusLabel}>Fulfillment:</span>
                  <span className={`${s.orderRowStatus} ${s[`status${o.status?.charAt(0).toUpperCase()}${o.status?.slice(1)}`] || ''}`}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </div>
                <div className={s.statusBadge}>
                  <span className={s.statusLabel}>Payment:</span>
                  <span className={`${s.orderRowPayment} ${(o.paymentStatus || '').toLowerCase() === 'paid' ? s.orderRowPaymentPaid : s.orderRowPaymentUnpaid}`}>
                    {PAYMENT_LABELS[o.paymentStatus] ?? (o.paymentStatus || 'Unpaid')}
                  </span>
                </div>
              </div>
              <span className={s.orderRowTotal}>{formatPrice(o.total)}</span>
              {o.paymentIntentId && (
                <span className={s.orderRowTxnId} title="Payment ID">
                  {o.paymentIntentId}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {statusConfirm && (
        <div
          className={`${s.modalOverlay} ${s.confirmOverlay}`}
          onClick={() => !statusUpdating && setStatusConfirm(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-confirm-title"
        >
          <div className={s.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h2 id="status-confirm-title" className={s.confirmModalTitle}>Change order status?</h2>
            <p className={s.confirmModalMessage}>
              Change shipping status from <strong>{STATUS_LABELS[statusConfirm.fromStatus] ?? statusConfirm.fromStatus}</strong> to <strong>{STATUS_LABELS[statusConfirm.toStatus] ?? statusConfirm.toStatus}</strong>.
            </p>
            <div className={s.confirmModalActions}>
              <button
                type="button"
                className={s.confirmModalBtnSecondary}
                onClick={() => setStatusConfirm(null)}
                disabled={statusUpdating}
              >
                Cancel
              </button>
              <button
                type="button"
                className={s.confirmModalBtnPrimary}
                onClick={confirmStatusChange}
                disabled={statusUpdating}
              >
                {statusUpdating ? 'Updating…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(selectedOrder || detailLoading) && (
        <div
          className={s.modalOverlay}
          onClick={() => !detailLoading && closeModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-title"
        >
          <div className={s.orderModal} onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className={s.modalLoading}>Loading order...</div>
            ) : selectedOrder ? (
              <>
                <div className={s.modalHeader}>
                  <h2
                    id="order-detail-title"
                    className={s.modalTitle}
                    title="Click to copy"
                    onClick={(e) => { e.stopPropagation(); copyOrderId(selectedOrder.orderNumber); }}
                  >
                    {selectedOrder.orderNumber}
                  </h2>
                  <button
                    type="button"
                    className={s.modalClose}
                    onClick={closeModal}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <div className={s.modalBody}>
                  <section className={s.orderSection}>
                    <h3 className={s.orderSectionTitle}>Order</h3>
                    <div className={s.orderMeta}>
                      <span className={s.orderDate}>
                        {new Date(selectedOrder.createdAt).toLocaleDateString()}
                      </span>
                      {selectedOrder.customer && (
                        <span className={s.orderUser}>
                          {selectedOrder.customer.firstName} {selectedOrder.customer.lastName} · {selectedOrder.customer.email}
                        </span>
                      )}
                    </div>
                  </section>

                  <section className={s.orderSection}>
                    <h3 className={s.orderSectionTitle}>Payment</h3>
                    {canUpdateStatus ? (
                      <div className={s.paymentRow}>
                        <span className={s.paymentCurrent}>
                          {PAYMENT_LABELS[selectedOrder.paymentStatus] ?? (selectedOrder.paymentStatus || 'Unpaid')}
                        </span>
                        {selectedOrder.paymentStatus !== 'paid' ? (
                          <button
                            type="button"
                            className={s.paymentMarkBtn}
                            onClick={() => setPaymentStatus(selectedOrder.id, 'paid')}
                            disabled={statusUpdating}
                          >
                            Mark as paid
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={s.paymentMarkUnpaidBtn}
                            onClick={() => setPaymentStatus(selectedOrder.id, 'unpaid')}
                            disabled={statusUpdating}
                          >
                            Mark as unpaid
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className={s.paymentCurrent}>{PAYMENT_LABELS[selectedOrder.paymentStatus] ?? (selectedOrder.paymentStatus || 'Unpaid')}</p>
                    )}
                    {selectedOrder.paymentIntentId && (
                      <div className={s.paymentIdRow}>
                        <strong>Transaction ID:</strong>
                        <div className={s.paymentIdContainer}>
                          <code className={s.paymentId} onClick={() => { copyOrderId(selectedOrder.paymentIntentId); }} title="Click to copy">
                            {selectedOrder.paymentIntentId}
                          </code>
                          <span className={s.copyLabel} onClick={() => copyOrderId(selectedOrder.paymentIntentId)}>Copy</span>
                        </div>
                      </div>
                    )}
                    <p className={s.paymentHint}>Payment can be collected on delivery; mark as paid when received.</p>
                  </section>

                  <section className={s.orderSection}>
                    <h3 className={s.orderSectionTitle}>Shipping status</h3>
                    {canUpdateStatus ? (
                      <>
                        <div className={s.statusFormRow}>
                          <div className={s.statusRow}>
                            <label htmlFor="order-status-select">Current</label>
                            <span className={s.statusCurrentBadge}>{STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status}</span>
                          </div>
                          <div className={s.statusRow}>
                            <label htmlFor="order-status-select">Change to</label>
                            <select
                              id="order-status-select"
                              value={statusDraft ?? selectedOrder.status}
                              onChange={(e) => setStatusDraft(e.target.value)}
                              className={s.orderStatusSelect}
                              disabled={statusUpdating || getNextStatusOptions(selectedOrder.status).length === 0}
                            >
                              {[
                                { value: selectedOrder.status, label: STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status },
                                ...getNextStatusOptions(selectedOrder.status).filter((o) => o.value !== selectedOrder.status),
                              ].map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className={s.statusSubmitWrap}>
                            <button
                              type="button"
                              className={s.statusSubmitBtn}
                              onClick={openStatusConfirm}
                              disabled={!canSubmitStatus || statusUpdating}
                            >
                              {statusUpdating ? 'Updating…' : 'Update status'}
                            </button>
                          </div>
                        </div>
                        {(selectedOrder.status === 'shipped' || selectedOrder.status === 'delivered') && (
                          <ShippingHistoryForm
                            shippingHistory={selectedOrder.shippingHistory || []}
                            onAdd={(msg) => addShippingEntry(selectedOrder.id, msg)}
                          />
                        )}
                      </>
                    ) : (
                      <p className={s.statusRow}><strong>Status:</strong> {STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status}</p>
                    )}
                  </section>

                  <section className={s.orderSection}>
                    <h3 className={s.orderSectionTitle}>Items</h3>
                    <div className={s.orderItems}>
                      {selectedOrder.items?.map((item, i) => (
                        <div key={i} className={s.orderItem}>
                          <span>{item.name} × {item.quantity}</span>
                          <span>{formatPrice(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className={s.orderTotal}>Total: {formatPrice(selectedOrder.total)}</div>
                  </section>

                  <section className={s.orderSection}>
                    <h3 className={s.orderSectionTitle}>Shipping address</h3>
                    <div className={s.orderAddressBlock}>
                      {selectedOrder.address ? (
                        <>
                          <p className={s.orderAddressLine}>{selectedOrder.address.street || '—'}</p>
                          <p className={s.orderAddressLine}>
                            {[selectedOrder.address.city, selectedOrder.address.state, selectedOrder.address.zip].filter(Boolean).join(', ') || '—'}
                          </p>
                          <p className={s.orderAddressLine}>{selectedOrder.address.country || '—'}</p>
                        </>
                      ) : (
                        <p className={s.orderAddressLine}>—</p>
                      )}
                    </div>
                  </section>
                </div>
              </>
            ) : null}
          </div>
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
      {orders.length === 0 && !loading && (
        <EmptyState
          title={orderIdQuery || statusFilter ? 'No orders found' : 'No orders yet'}
          message={orderIdQuery || statusFilter ? 'No orders match your filters. Try different search or clear filters.' : 'Orders will appear here when customers place them.'}
        />
      )}
    </div>
  )
}
