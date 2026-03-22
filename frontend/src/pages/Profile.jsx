import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getMediaUrl } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import { BackButton } from '../components/BackButton'
import s from './Profile.module.css'

const ADDRESS_LABELS = ['Home', 'Office', 'Other']

function groupAddressesByLabel(addresses) {
  const groups = { Home: [], Office: [], Other: [], rest: [] }
  for (const addr of addresses) {
    const label = (addr.label || '').trim()
    if (label === 'Home') groups.Home.push(addr)
    else if (label === 'Office') groups.Office.push(addr)
    else if (label === 'Other') groups.Other.push(addr)
    else groups.rest.push(addr)
  }
  return groups
}

const emptyAddress = {
  label: '',
  labelCustom: '',
  street: '',
  city: '',
  state: '',
  zip: '',
  country: '',
  phone: '',
  secondaryPhone: '',
  isDefault: false,
}

/**
 * Profile page for all users to change password and manage addresses
 */
export default function Profile() {
  const { user } = useAuth()
  const hasPassword = user?.hasPassword !== false
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const [addresses, setAddresses] = useState([])
  const [addressForm, setAddressForm] = useState(emptyAddress)
  const [editingId, setEditingId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addrLoading, setAddrLoading] = useState(false)
  const [addrError, setAddrError] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showAddressModal, setShowAddressModal] = useState(false)

  useEffect(() => {
    if (user?.role === 'customer') {
      api('/addresses')
        .then((res) => setAddresses(res.addresses || []))
        .catch(() => setAddresses([]))
    }
  }, [user?.role])

  const loadAddresses = () => {
    api('/addresses')
      .then((res) => setAddresses(res.addresses || []))
      .catch(() => { })
  }

  const handleAddressSubmit = async (e) => {
    e.preventDefault()
    setAddrError(null)
    setAddrLoading(true)
    try {
      const labelToSave = addressForm.label === 'Custom' ? (addressForm.labelCustom || '').trim() : (addressForm.label || '')
      const payload = {
        label: labelToSave || undefined,
        street: addressForm.street,
        city: addressForm.city,
        state: addressForm.state || undefined,
        zip: addressForm.zip,
        country: addressForm.country,
        phone: addressForm.phone || undefined,
        secondaryPhone: addressForm.secondaryPhone || undefined,
        isDefault: addressForm.isDefault,
      }
      if (editingId) {
        await api(`/addresses/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) })
        setEditingId(null)
      } else {
        await api('/addresses', { method: 'POST', body: JSON.stringify(payload) })
        setShowAddForm(false)
      }
      setAddressForm(emptyAddress)
      loadAddresses()
    } catch (err) {
      setAddrError(err.data?.error || err.message)
    } finally {
      setAddrLoading(false)
    }
  }

  const handleDeleteAddress = async (id) => {
    if (!confirm('Delete this address?')) return
    setAddrLoading(true)
    setAddrError(null)
    try {
      await api(`/addresses/${id}`, { method: 'DELETE' })
      loadAddresses()
      if (editingId === id) setEditingId(null)
    } catch (err) {
      setAddrError(err.data?.error || err.message)
    } finally {
      setAddrLoading(false)
    }
  }

  const startEdit = (addr) => {
    setEditingId(addr.id)
    const label = (addr.label || '').trim()
    const isPreset = ADDRESS_LABELS.includes(label)
    setAddressForm({
      label: isPreset ? label : 'Custom',
      labelCustom: isPreset ? '' : label,
      street: addr.street,
      city: addr.city,
      state: addr.state || '',
      zip: addr.zip,
      country: addr.country,
      phone: addr.phone || '',
      secondaryPhone: addr.secondaryPhone || '',
      isDefault: addr.isDefault || false,
    })
    setShowAddForm(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setAddressForm(emptyAddress)
    setShowAddForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match')
      return
    }
    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (hasPassword && !form.currentPassword) {
      setError('Current password is required')
      return
    }
    setLoading(true)
    try {
      await api('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      })
      setMessage('Password updated successfully')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => { setShowPasswordModal(false); setMessage(null); }, 1500)
    } catch (err) {
      setError(err.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={s.page}>
      <BackButton to="/" label="Home" />
      <div className={s.profileHeader}>
        {user?.profileUrl ? (
          <img src={getMediaUrl(user.profileUrl)} alt="" className={s.profilePic} referrerPolicy="no-referrer" />
        ) : (
          <div className={s.profilePicPlaceholder}>{user?.firstName ? user.firstName[0] : '?'}</div>
        )}
        <div className={s.profileInfo}>
          <h1 className={s.title}>Profile</h1>
          <p className={s.subtitle}>
            {user?.firstName} {user?.lastName} · {user?.email}
          </p>
        </div>
      </div>

      <div className={s.optionsRow}>
        <button type="button" className={s.optionBtn} onClick={() => { setShowPasswordModal(true); setError(null); setMessage(null); setForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}>
          {hasPassword ? 'Change Password' : 'Set Password'}
        </button>
        {user?.role === 'customer' && (
          <>
            <button type="button" className={s.optionBtn} onClick={() => { setShowAddressModal(true); loadAddresses(); setAddrError(null); cancelEdit(); }}>
              Manage Addresses
            </button>
            <Link to="/orders" className={s.optionBtn}>
              View Orders
            </Link>
          </>
        )}
      </div>

      {showPasswordModal && (
        <div className={s.modalOverlay} onClick={() => !loading && setShowPasswordModal(false)} role="dialog" aria-modal="true" aria-labelledby="change-password-title">
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 id="change-password-title" className={s.modalTitle}>{hasPassword ? 'Change Password' : 'Set Password'}</h2>
              <button type="button" className={s.modalClose} onClick={() => !loading && setShowPasswordModal(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleSubmit} className={s.form}>
              {hasPassword && (
                <input
                  type="password"
                  placeholder="Current password"
                  value={form.currentPassword}
                  onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                  required
                  className={s.input}
                />
              )}
              <input
                type="password"
                placeholder="New password (min 6 characters)"
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                required
                minLength={6}
                className={s.input}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                required
                minLength={6}
                className={s.input}
              />
              {error && <p className={s.error}>{error}</p>}
              {message && <p className={s.success}>{message}</p>}
              <div className={s.modalActions}>
                <button type="button" className={s.btnSecondary} onClick={() => !loading && setShowPasswordModal(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className={s.btn} disabled={loading}>
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddressModal && user?.role === 'customer' && (
        <div className={s.modalOverlay} onClick={() => !addrLoading && setShowAddressModal(false)} role="dialog" aria-modal="true" aria-labelledby="addresses-title">
          <div className={`${s.modal} ${s.modalWide}`} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 id="addresses-title" className={s.modalTitle}>
                {editingId ? 'Edit Address' : showAddForm ? 'New Address' : 'Saved Addresses'}
              </h2>
              <button type="button" className={s.modalClose} onClick={() => !addrLoading && setShowAddressModal(false)} aria-label="Close">×</button>
            </div>
            {!editingId && !showAddForm && <p className={s.hint}>Manage your shipping addresses for fashion checkout.</p>}
            <div className={s.modalScroll}>
              {!(showAddForm || editingId) ? (
                <>
                  {(() => {
                    const grouped = groupAddressesByLabel(addresses)
                    const sections = [
                      { key: 'Home', addrs: grouped.Home },
                      { key: 'Office', addrs: grouped.Office },
                      { key: 'Other', addrs: grouped.Other },
                      { key: 'Other addresses', addrs: grouped.rest },
                    ].filter((s) => s.addrs.length > 0)
                    if (sections.length === 0) return <p className={s.emptyMsg}>No addresses saved yet.</p>
                    return (
                      <>
                        {sections.map(({ key, addrs }) => (
                          <div key={key} className={s.addressSection}>
                            <h4 className={s.addressSectionTitle}>{key}</h4>
                            {addrs.map((addr) => (
                              <div key={addr.id} className={s.addressCard}>
                                <div className={s.addressContent}>
                                  {addr.label && addr.label !== key && <span className={s.addressLabel}>{addr.label}</span>}
                                  <span>{addr.street}, {addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.zip}, {addr.country}</span>
                                  {addr.phone && <span className={s.addressPhone}>{addr.phone}</span>}
                                  {addr.isDefault && <span className={s.defaultBadge}>Default</span>}
                                </div>
                                <div className={s.addressActions}>
                                  <button type="button" className={s.smallBtn} onClick={() => startEdit(addr)}>Edit</button>
                                  <button type="button" className={s.smallBtnDanger} onClick={() => handleDeleteAddress(addr.id)}>Delete</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </>
                    )
                  })()}
                  <button type="button" className={s.addNewBtn} onClick={() => { setShowAddForm(true); setAddressForm(emptyAddress); setAddrError(null); }}>
                    + Add new address
                  </button>
                </>
              ) : (
                <form onSubmit={handleAddressSubmit} className={`${s.form} ${s.addressFormWrap}`}>
                  <div className={s.labelRow}>
                    <label className={s.labelFieldLabel}>Address Label</label>
                    <div className={s.labelSelection}>
                      {ADDRESS_LABELS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          className={`${s.labelTag} ${addressForm.label === l ? s.activeLabel : ''}`}
                          onClick={() => setAddressForm(f => ({ ...f, label: l, labelCustom: '' }))}
                        >
                          {l}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`${s.labelTag} ${addressForm.label === 'Custom' ? s.activeLabel : ''}`}
                        onClick={() => setAddressForm(f => ({ ...f, label: 'Custom' }))}
                      >
                        Custom
                      </button>
                    </div>
                    {addressForm.label === 'Custom' && (
                      <input
                        placeholder="e.g. Parents' House"
                        value={addressForm.labelCustom}
                        onChange={(e) => setAddressForm((f) => ({ ...f, labelCustom: e.target.value }))}
                        className={s.input}
                        autoFocus
                      />
                    )}
                  </div>

                  <div className={s.formGroup}>
                    <label className={s.fieldLabel}>Street / Building</label>
                    <input
                      placeholder="e.g. Sheikh Zayed Road, Villa 42"
                      value={addressForm.street}
                      onChange={(e) => setAddressForm((f) => ({ ...f, street: e.target.value }))}
                      required
                      className={s.input}
                    />
                  </div>

                  <div className={s.row2}>
                    <div className={s.formGroup}>
                      <label className={s.fieldLabel}>City</label>
                      <input
                        placeholder="Dubai"
                        value={addressForm.city}
                        onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                        required
                        className={s.input}
                      />
                    </div>
                    <div className={s.formGroup}>
                      <label className={s.fieldLabel}>Emirate</label>
                      <input
                        placeholder="Dubai"
                        value={addressForm.state}
                        onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
                        className={s.input}
                      />
                    </div>
                  </div>

                  <div className={s.row2}>
                    <div className={s.formGroup}>
                      <label className={s.fieldLabel}>P.O. Box</label>
                      <input
                        placeholder="12345"
                        value={addressForm.zip}
                        onChange={(e) => setAddressForm((f) => ({ ...f, zip: e.target.value }))}
                        required
                        className={s.input}
                      />
                    </div>
                    <div className={s.formGroup}>
                      <label className={s.fieldLabel}>Country</label>
                      <input
                        placeholder="UAE"
                        value={addressForm.country}
                        onChange={(e) => setAddressForm((f) => ({ ...f, country: e.target.value }))}
                        required
                        className={s.input}
                      />
                    </div>
                  </div>

                  <div className={s.row2}>
                    <div className={s.formGroup}>
                      <label className={s.fieldLabel}>Main Phone</label>
                      <input
                        placeholder="05xxxxxxx"
                        value={addressForm.phone}
                        onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))}
                        required
                        className={s.input}
                      />
                    </div>
                    <div className={s.formGroup}>
                      <label className={s.fieldLabel}>Secondary Phone</label>
                      <input
                        placeholder="Optional"
                        value={addressForm.secondaryPhone}
                        onChange={(e) => setAddressForm((f) => ({ ...f, secondaryPhone: e.target.value }))}
                        className={s.input}
                      />
                    </div>
                  </div>

                  <label className={s.checkbox}>
                    <input
                      type="checkbox"
                      checked={addressForm.isDefault}
                      onChange={(e) => setAddressForm((f) => ({ ...f, isDefault: e.target.checked }))}
                    />
                    Set as default address
                  </label>

                  {addrError && <p className={s.error}>{addrError}</p>}

                  <div className={s.btnRow}>
                    <button type="submit" className={s.btn} disabled={addrLoading}>
                      {addrLoading ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Address')}
                    </button>
                    <button type="button" className={s.btnSecondary} onClick={cancelEdit}>
                      Back to list
                    </button>
                  </div>
                </form>
              )}
            </div>
            <div className={s.modalFooter}>
              <button type="button" className={s.btnSecondary} onClick={() => !addrLoading && setShowAddressModal(false)} disabled={addrLoading}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
