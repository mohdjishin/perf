import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { PageSkeletonList } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import s from './Users.module.css'

const PAGE_SIZE = 12

export default function SuperAdminUsers() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const currentUserId = currentUser?.id

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'admin', group: '', active: true })
  const [error, setError] = useState('')
  const [searchEmail, setSearchEmail] = useState('')
  const [searchRole, setSearchRole] = useState('')

  useEffect(() => {
    setPage(1)
  }, [searchEmail, searchRole])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (searchEmail.trim()) params.set('email', searchEmail.trim())
    if (searchRole) params.set('role', searchRole)
    api(`/users?${params}`)
      .then((data) => {
        if (!cancelled) {
          setUsers(data.items || [])
          setPagination(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsers([])
          setPagination(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [page, refreshKey, searchEmail, searchRole])

  const openCreate = () => {
    setForm({ email: '', password: '', firstName: '', lastName: '', role: 'admin', group: '', active: true })
    setModal('create')
    setError('')
  }

  const openEdit = (u) => {
    setForm({ firstName: u.firstName, lastName: u.lastName, role: u.role, group: u.group || '', active: u.active === true })
    setModal(u.id)
    setError('')
  }

  const closeModal = () => {
    setModal(null)
    setError('')
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const created = await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          group: form.group || undefined,
        }),
      })
      setPage(1)
      setRefreshKey((k) => k + 1)
      closeModal()
    } catch (err) {
      setError(err.data?.error || err.message)
    }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const updated = await api(`/users/${modal}`, {
        method: 'PUT',
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          group: form.group,
          active: form.active,
        }),
      })
      setUsers((prev) => prev.map((u) => (u.id === modal ? updated : u)))
      closeModal()
    } catch (err) {
      setError(err.data?.error || err.message)
    }
  }

  const getInitials = (u) =>
    (u.firstName?.[0] || '') + (u.lastName?.[0] || '') || u.email?.[0] || '?'

  const getBadgeClass = (role) => {
    if (role === 'admin') return s.badgeAdmin
    if (role === 'super_admin') return s.badgeSuperAdmin
    return s.badgeUser
  }

  if (loading) return <PageSkeletonList rows={8} />

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <Link to="/superadmin" className={s.back}>
            ← Super Admin
          </Link>
          <h1 className={s.title}>User Management</h1>
          <p className={s.subtitle}>Create admins. Customers sign up via the register page.</p>
        </div>
        <button onClick={openCreate} className={s.addBtn} type="button">
          + Add Admin
        </button>
      </header>

      <div className={s.filters}>
        <input
          type="text"
          placeholder="Search by email..."
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
          className={s.searchInput}
        />
        <select
          value={searchRole}
          onChange={(e) => setSearchRole(e.target.value)}
          className={s.roleSelect}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="customer">Customers</option>
        </select>
      </div>

      <div className={s.grid}>
        {users.length === 0 && (
          <EmptyState
            fullWidth
            title="No users yet"
            message="Customers sign up via the register page. Use &quot;+ Add Admin&quot; to create admins."
          />
        )}
        {users.map((u, i) => (
          <article key={u.id} className={s.card} style={{ animationDelay: `${i * 0.04}s` }}>
            <div className={s.cardBody}>
              <span className={s.avatar}>{getInitials(u)}</span>
              <div className={s.cardInfo}>
                <div className={s.name}>
                  {u.firstName} {u.lastName}
                </div>
                <div className={s.email}>{u.email}</div>
                {u.group && <span className={s.groupTag}>{u.group}</span>}
              </div>
              <span className={`${s.badge} ${getBadgeClass(u.role)}`}>
                {u.role.replace('_', ' ')}
              </span>
            </div>
            <div className={s.cardFooter}>
              <span className={u.active === true ? `${s.status} ${s.statusActive}` : `${s.status} ${s.statusInactive}`} title={u.active === true ? 'User is active' : 'User is inactive'}>
                {u.active === true ? 'Active' : 'Inactive'}
              </span>
              <button onClick={() => openEdit(u)} className={s.editBtn} type="button">
                Edit
              </button>
            </div>
          </article>
        ))}
      </div>
      {pagination?.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
        />
      )}

      {modal && (
        <div className={s.overlay} onClick={closeModal} role="presentation">
          <div
            className={s.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <h2 id="modal-title" className={s.modalTitle}>
              {modal === 'create' ? 'Create Admin' : 'Edit User'}
            </h2>
            {error && <p className={s.error}>{error}</p>}
            <form
              className={s.form}
              onSubmit={modal === 'create' ? handleCreate : handleEdit}
            >
              {modal === 'create' && (
                <>
                  <input
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    className={s.input}
                  />
                  <input
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    minLength={6}
                    className={s.input}
                  />
                </>
              )}
              <input
                placeholder="First name"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
                className={s.input}
              />
              <input
                placeholder="Last name"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
                className={s.input}
              />
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className={s.input}
              >
                {modal === 'create' ? (
                  <option value="admin">Admin</option>
                ) : (
                  <>
                    <option value="customer">Customer</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </>
                )}
              </select>
              <input
                placeholder="Group (optional)"
                value={form.group}
                onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
                className={s.input}
              />
              {modal !== 'create' && (
                <div className={s.activeRow}>
                  <label className={s.checkLabel}>
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                      disabled={modal === currentUserId}
                    />
                    Active
                  </label>
                  {modal === currentUserId && (
                    <span className={s.selfHint}>You cannot deactivate your own account.</span>
                  )}
                </div>
              )}
              <div className={s.actions}>
                <button type="button" onClick={closeModal} className={s.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" className={s.submitBtn}>
                  {modal === 'create' ? 'Create Admin' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
