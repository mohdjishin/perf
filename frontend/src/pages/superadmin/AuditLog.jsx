import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { LoadingState, EmptyState } from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import s from './AuditLog.module.css'

const PAGE_SIZE = 20

/**
 * Formats a date for display: relative time + full datetime on hover
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

  const full = d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return { relative, full }
}

/**
 * Builds a human-readable summary from log data (fallback when backend has no summary)
 */
function getSummary(log) {
  if (log.summary) return log.summary

  const action = log.action || ''
  const details = log.details || {}
  const targetId = log.targetId ? `…${String(log.targetId).slice(-8)}` : ''

  if (action === 'product_create') return `Created product "${details.name || targetId}"`
  if (action === 'product_update') return `Updated product${targetId ? ` ${targetId}` : ''}`
  if (action === 'product_delete') return `Deleted product ${targetId}`
  if (action === 'order_status') return `Updated order status to "${details.status || '—'}"`
  if (action === 'user_update') {
    if (details.action === 'create') return `Created user as ${details.role || 'customer'}`
    return `Updated user ${targetId}`
  }
  if (action === 'user_password_reset') return `Reset password for user ${targetId}`
  if (action === 'order_place') return `Placed order`
  return action.replace(/_/g, ' ')
}

/**
 * Formats details for display (key: value pairs, skip raw objects)
 */
function formatDetails(details) {
  if (!details || typeof details !== 'object') return null
  const skip = ['updates', 'action']
  const items = []
  for (const [k, v] of Object.entries(details)) {
    if (skip.includes(k)) continue
    if (v === null || v === undefined) continue
    if (typeof v === 'object' && !Array.isArray(v)) continue
    const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
    items.push({ label, value: String(v) })
  }
  return items.length ? items : null
}

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)

  useEffect(() => {
    setLoading(true)
    api(`/audit?page=${page}&limit=${PAGE_SIZE}`)
      .then((data) => {
        setLogs(data.items || [])
        setPagination(data)
      })
      .catch(() => {
        setLogs([])
        setPagination(null)
      })
      .finally(() => setLoading(false))
  }, [page])

  if (loading) return <LoadingState message="Loading audit log..." />

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Link to="/superadmin" className={s.back}>← Super Admin</Link>
        <h1 className={s.title}>Audit Log</h1>
        <p className={s.subtitle}>Who did what, when — all admin and customer actions</p>
      </header>

      {logs.length > 0 ? (
        <>
        <div className={s.list}>
          {logs.map((log, i) => {
            const { relative, full } = formatWhen(log.createdAt)
            const summary = getSummary(log)
            const detailItems = formatDetails(log.details)
            const targetType = log.targetType || (log.action?.startsWith('product') ? 'product' : log.action?.startsWith('order') ? 'order' : 'user')

            return (
              <article key={log.id} className={s.card} style={{ animationDelay: `${i * 0.03}s` }}>
                <div className={s.cardHeader}>
                  <div className={s.who}>
                    <span className={s.actor}>{log.actorEmail}</span>
                    <span className={s.targetType}>{targetType}</span>
                  </div>
                  <time className={s.when} title={full}>
                    {relative}
                  </time>
                </div>
                <p className={s.summary}>{summary}</p>
                {detailItems && detailItems.length > 0 && (
                  <ul className={s.details}>
                    {detailItems.map(({ label, value }) => (
                      <li key={label}>
                        <span className={s.detailLabel}>{label}:</span>{' '}
                        <span className={s.detailValue}>{value}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
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
      ) : (
        <EmptyState
          title="No audit entries yet"
          message="Admin and customer actions will appear here."
        />
      )}
    </div>
  )
}
