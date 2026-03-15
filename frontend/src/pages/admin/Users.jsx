import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { Toast } from '../../components/Toast'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', role: '', active: true })
  const [toastError, setToastError] = useState(null)

  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isSuperAdmin = user.role === 'super_admin'

  useEffect(() => {
    const params = new URLSearchParams({ limit: '500' })
    api(`/users?${params}`)
      .then((data) => setUsers(data.items || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  const openEdit = (u) => {
    setEditing(u.id)
    setForm({ firstName: u.firstName, lastName: u.lastName, role: u.role, active: u.active === true })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = { firstName: form.firstName, lastName: form.lastName, active: form.active }
      if (isSuperAdmin && form.role) payload.role = form.role
      const updated = await api(`/users/${editing}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setUsers((prev) => prev.map((u) => (u.id === editing ? updated : u)))
      setEditing(null)
    } catch (err) {
      setToastError(err.data?.error || err.message)
    }
  }

  if (loading) return <div style={styles.loading}>Loading...</div>

  return (
    <div style={styles.wrapper}>
      <Toast
        visible={!!toastError}
        message={toastError || ''}
        onClose={() => setToastError(null)}
        autoHideMs={5000}
      />
      <Link to="/admin" style={styles.back}>← Dashboard</Link>
      <h1 style={styles.title}>Users</h1>
      {editing && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <h3>Edit User</h3>
          <input placeholder="First name" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required style={styles.input} />
          <input placeholder="Last name" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required style={styles.input} />
          {isSuperAdmin && (
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={styles.input}>
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          )}
          <label><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Active</label>
          <div style={styles.formActions}>
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.firstName} {u.lastName}</td>
                <td>{u.role}</td>
                <td>{u.active === true ? 'Yes' : 'No'}</td>
                <td><button onClick={() => openEdit(u)} style={styles.smBtn}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles = {
  wrapper: { maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' },
  back: { fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem', display: 'block' },
  title: { fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '1.5rem' },
  loading: { padding: '4rem', textAlign: 'center' },
  form: { marginBottom: '2rem', padding: '1.5rem', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' },
  input: { width: '100%', padding: '0.5rem', marginBottom: '0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', color: 'var(--color-text)' },
  formActions: { display: 'flex', gap: '0.5rem' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  smBtn: { padding: '0.25rem 0.5rem', background: 'transparent', color: 'var(--color-accent)', fontSize: '0.85rem' },
}
