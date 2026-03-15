import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { PageSkeletonList } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import { formatPrice } from '../../utils/currency'
import s from './Investigate.module.css'

const USER_PAGE_SIZE = 12

/**
 * Formats a date for display
 */
function formatWhen(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  let relative = ''
  if (diffMins < 1) relative = 'Just now'
  else if (diffMins < 60) relative = `${diffMins}m ago`
  else if (diffHours < 24) relative = `${diffHours}h ago`
  else if (diffDays < 7) relative = `${diffDays}d ago`
  else relative = d.toLocaleDateString()

  const full = d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  return { relative, full }
}

/**
 * Investigation portal: users grouped by group, click user to see their activity
 */
export default function Investigate() {
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userLogs, setUserLogs] = useState([])
  const [userLogsLoading, setUserLogsLoading] = useState(false)
  const [searchEmail, setSearchEmail] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userPagination, setUserPagination] = useState(null)
  const [roleFilter, setRoleFilter] = useState(null) // 'admin' | 'customer' | null (nothing loaded)

  useEffect(() => {
    setUserPage(1)
  }, [searchEmail, roleFilter])

  useEffect(() => {
    if (!roleFilter) {
      setUsers([])
      setUserPagination(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ page: userPage, limit: USER_PAGE_SIZE, role: roleFilter })
    if (searchEmail.trim()) params.set('email', searchEmail.trim())
    api(`/users?${params}`)
      .then((data) => {
        setUsers(data.items || [])
        setUserPagination(data)
      })
      .catch(() => {
        setUsers([])
        setUserPagination(null)
      })
      .finally(() => setLoading(false))
  }, [userPage, searchEmail, roleFilter])

  useEffect(() => {
    if (!selectedUser) {
      setUserLogs([])
      return
    }
    setUserLogsLoading(true)
    api(`/audit?actor_id=${selectedUser.id}&limit=50`)
      .then((data) => setUserLogs(data.items || []))
      .catch(() => setUserLogs([]))
      .finally(() => setUserLogsLoading(false))
  }, [selectedUser])

  const getSummary = (log) => log.summary || log.action?.replace(/_/g, ' ') || ''

  const renderLogDetails = (log) => {
    const d = log.details || {}

    const formatAddress = (addr) => {
      if (!addr || typeof addr !== 'object') return null
      const parts = [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean)
      return parts.length ? parts.join(', ') : null
    }

    // Order placed: show order ID/number + total (minimal)
    if (log.action === 'order_place') {
      const total = d.total
      const orderNumber = d.orderNumber
      const items = Array.isArray(d.items) ? d.items : []
      const address = formatAddress(d.address)
      const hasDetails = orderNumber || total != null || items.length > 0 || address
      if (!hasDetails) return null
      return (
        <div className={s.detailsBlock}>
          <div className={s.readableSection}>
            <h4 className={s.readableTitle}>Order</h4>
            {orderNumber && (
              <p className={s.orderNumber}>Order #{orderNumber}</p>
            )}
            {total != null && <p className={s.orderTotal}><strong>Total: {formatPrice(total)}</strong></p>}
            {items.length > 0 && (
              <ul className={s.itemList}>
                {items.map((it, i) => (
                  <li key={i} className={s.itemRow}>
                    <span className={s.itemName}>{it.name || 'Product'}</span>
                    <span className={s.itemMeta}>× {it.quantity || 1} — {formatPrice(it.subtotal ?? (it.price * (it.quantity || 1)))}</span>
                  </li>
                ))}
              </ul>
            )}
            {address && <p className={s.shippingAddress}>Ship to: {address}</p>}
          </div>
        </div>
      )
    }

    // Product created: show product info in readable format
    if (log.action === 'product_create') {
      const p = d.response || d.request || d
      const name = p.name
      if (!name && !p.price && !p.category) return null
      return (
        <div className={s.detailsBlock}>
          <div className={s.readableSection}>
            <h4 className={s.readableTitle}>Product</h4>
            <dl className={s.infoList}>
              {name && <><dt>Name</dt><dd>{name}</dd></>}
              {p.price != null && <><dt>Price</dt><dd>{formatPrice(p.price)}</dd></>}
              {p.category && <><dt>Category</dt><dd>{p.category}</dd></>}
              {p.stock != null && <><dt>Stock</dt><dd>{p.stock}</dd></>}
              {p.description && <><dt>Description</dt><dd className={s.descShort}>{p.description}</dd></>}
            </dl>
          </div>
        </div>
      )
    }

    // Product updated: show what changed
    if (log.action === 'product_update' && d.updates) {
      const updates = d.updates
      const entries = Object.entries(updates).filter(([k]) => !['updated_at', 'updatedAt'].includes(k))
      if (entries.length === 0) return null
      return (
        <div className={s.detailsBlock}>
          <div className={s.readableSection}>
            <h4 className={s.readableTitle}>Changes</h4>
            <ul className={s.itemList}>
              {entries.map(([key, val]) => (
                <li key={key} className={s.itemRow}>
                  <span className={s.fieldName}>{key.replace(/_/g, ' ')}</span>
                  <span className={s.fieldVal}>
                    {key === 'price' && typeof val === 'number' ? formatPrice(val) : String(val ?? '—')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )
    }

    // Order status: show order ID + new status (minimal)
    if (log.action === 'order_status') {
      const orderNumber = d.orderNumber
      const status = d.status
      if (!orderNumber && !status) return null
      return (
        <div className={s.detailsBlock}>
          <div className={s.readableSection}>
            <h4 className={s.readableTitle}>Order</h4>
            {orderNumber && <p className={s.orderNumber}>Order #{orderNumber}</p>}
            {status && <p className={s.statusText}>Status: <strong>{String(status)}</strong></p>}
          </div>
        </div>
      )
    }

    // User update: show role/action
    if (log.action === 'user_update' && (d.role || d.action)) {
      return (
        <div className={s.detailsBlock}>
          <div className={s.readableSection}>
            <dl className={s.infoList}>
              {d.action && <><dt>Action</dt><dd>{d.action}</dd></>}
              {d.role && <><dt>Role</dt><dd>{d.role}</dd></>}
            </dl>
          </div>
        </div>
      )
    }

    return null
  }

  const getInitials = (u) =>
    (u.firstName?.[0] || '') + (u.lastName?.[0] || '') || u.email?.[0] || '?'

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Link to="/superadmin" className={s.back}>← Super Admin</Link>
        <h1 className={s.title}>Investigation Portal</h1>
        <p className={s.subtitle}>
          Load admins or customers, then click one to see their activity
        </p>
      </header>

      <div className={s.loadOptions}>
        <button
          type="button"
          className={`${s.loadBtn} ${roleFilter === 'admin' ? s.loadBtnActive : ''}`}
          onClick={() => setRoleFilter(roleFilter === 'admin' ? null : 'admin')}
        >
          Load Admins
        </button>
        <button
          type="button"
          className={`${s.loadBtn} ${roleFilter === 'customer' ? s.loadBtnActive : ''}`}
          onClick={() => setRoleFilter(roleFilter === 'customer' ? null : 'customer')}
        >
          Load Customers
        </button>
      </div>

      {roleFilter && (
        <div className={s.layout}>
          <div className={s.userList}>
            <section className={s.section}>
              <h2 className={s.sectionTitle}>{roleFilter === 'admin' ? 'Admins' : 'Customers'}</h2>
              <div className={s.searchWrap}>
                <input
                  type="text"
                  placeholder="Search by email..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className={s.searchInput}
                />
              </div>
              {loading ? (
                <PageSkeletonList rows={6} />
              ) : (
                <>
                  <ul className={s.userListInner}>
                    {users.length === 0 ? (
                      <li className={s.emptyGroup}>No {roleFilter === 'admin' ? 'admins' : 'customers'} found</li>
                    ) : (
                      users.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            className={`${s.userCard} ${selectedUser?.id === u.id ? s.selected : ''}`}
                            onClick={() => setSelectedUser(u)}
                          >
                            <span className={s.avatar}>{getInitials(u)}</span>
                            <div className={s.userInfo}>
                              <span className={s.userName}>
                                {u.firstName} {u.lastName}
                              </span>
                              <span className={s.userEmail}>{u.email}</span>
                              <span className={s.roleBadge}>{u.role?.replace('_', ' ')}</span>
                            </div>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                  {userPagination?.totalPages > 1 && (
                    <div className={s.userPagination}>
                      <Pagination
                        page={userPage}
                        totalPages={userPagination.totalPages}
                        total={userPagination.total}
                        onPageChange={setUserPage}
                      />
                    </div>
                  )}
                </>
              )}
            </section>
          </div>

          <div className={s.activityPanel}>
            {selectedUser ? (
              <>
                <div className={s.activityHeader}>
                  <h3>Activity for {selectedUser.firstName} {selectedUser.lastName}</h3>
                  <button
                    type="button"
                    className={s.closeBtn}
                    onClick={() => setSelectedUser(null)}
                  >
                    ×
                  </button>
                </div>
                {userLogsLoading ? (
                  <p className={s.loading}>Loading activity...</p>
                ) : userLogs.length > 0 ? (
                  <ul className={s.activityList}>
                    {userLogs.map((log, i) => {
                      const { relative, full } = formatWhen(log.createdAt)
                      return (
                        <li key={log.id} className={s.activityCard}>
                          <div className={s.activityCardHeader}>
                            <span className={s.roleBadge}>{log.actorRole?.replace('_', ' ') || '—'}</span>
                            <time className={s.when} title={full}>{relative}</time>
                          </div>
                          <p className={s.summary}>{getSummary(log)}</p>
                          {renderLogDetails(log)}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className={s.emptyActivity}>No activity recorded</p>
                )}
              </>
            ) : (
              <p className={s.selectHint}>Select a customer to view their activity</p>
            )}
          </div>
        </div>
      )}

      {!roleFilter && (
        <div className={s.activityPanel}>
          <p className={s.selectHint}>Click &quot;Load Admins&quot; or &quot;Load Customers&quot; to get started</p>
        </div>
      )}
    </div>
  )
}
