import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import s from './SuperAdmin.module.css'
import sl from './StoreLocations.module.css'

export default function StoreLocations() {
  const { t } = useTranslation()
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [modal, setModal] = useState(null) // null | 'new' | { id, store }
  const [form, setForm] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    lat: '',
    lng: '',
    phone: '',
    hours: '',
    active: true,
  })
  const [saving, setSaving] = useState(false)

  const fetchStores = () => {
    api('/stores/admin')
      .then((data) => setStores(data.stores || []))
      .catch(() => setError(t('storeLocationsAdmin.errorLoad')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchStores()
  }, [])

  const openNew = () => {
    setForm({
      name: '',
      street: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      lat: '',
      lng: '',
      phone: '',
      hours: '',
      active: true,
    })
    setModal('new')
    setError(null)
    setMessage(null)
  }

  const openEdit = (store) => {
    setForm({
      name: store.name || '',
      street: store.street || '',
      city: store.city || '',
      state: store.state || '',
      zip: store.zip || '',
      country: store.country || '',
      lat: store.lat != null ? String(store.lat) : '',
      lng: store.lng != null ? String(store.lng) : '',
      phone: store.phone || '',
      hours: store.hours || '',
      active: store.active !== false,
    })
    setModal({ id: store.id, store })
    setError(null)
    setMessage(null)
  }

  const closeModal = () => setModal(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    const lat = parseFloat(form.lat)
    const lng = parseFloat(form.lng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError(t('storeLocationsAdmin.errorCoords'))
      setSaving(false)
      return
    }
    try {
      if (modal === 'new') {
        await api('/stores', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            street: form.street.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            zip: form.zip.trim(),
            country: form.country.trim(),
            lat,
            lng,
            phone: form.phone.trim() || undefined,
            hours: form.hours.trim() || undefined,
            active: form.active,
          }),
        })
        setMessage(t('storeLocationsAdmin.storeAdded'))
      } else {
        await api(`/stores/${modal.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: form.name.trim(),
            street: form.street.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            zip: form.zip.trim(),
            country: form.country.trim(),
            lat,
            lng,
            phone: form.phone.trim() || undefined,
            hours: form.hours.trim() || undefined,
            active: form.active,
          }),
        })
        setMessage(t('storeLocationsAdmin.storeUpdated'))
      }
      fetchStores()
      setTimeout(() => {
        closeModal()
        setMessage(null)
      }, 1200)
    } catch (err) {
      setError(err.message || t('storeLocationsAdmin.errorSave'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('storeLocationsAdmin.confirmDelete'))) return
    try {
      await api(`/stores/${id}`, { method: 'DELETE' })
      fetchStores()
      closeModal()
    } catch (err) {
      setError(err.message || t('storeLocationsAdmin.errorDelete'))
    }
  }

  if (loading) {
    return (
      <div className={s.page}>
        <Link to="/superadmin" className={s.back}>← {t('storeLocationsAdmin.back')}</Link>
        <p className={sl.loading}>{t('storeLocationsAdmin.loading')}</p>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <Link to="/superadmin" className={s.back}>← {t('storeLocationsAdmin.back')}</Link>
      <h1 className={s.title}>{t('storeLocationsAdmin.title')}</h1>
      <p className={s.subtitle}>{t('storeLocationsAdmin.subtitle')}</p>

      {error && <p className={sl.error}>{error}</p>}
      {message && <p className={sl.message}>{message}</p>}

      <div className={sl.toolbar}>
        <button type="button" className={sl.btn} onClick={openNew}>
          {t('storeLocationsAdmin.addStore')}
        </button>
      </div>

      {stores.length === 0 ? (
        <p className={sl.empty}>{t('storeLocationsAdmin.noStores')}</p>
      ) : (
        <ul className={sl.list}>
          {stores.map((store) => (
            <li key={store.id} className={`${sl.item} ${!store.active ? sl.itemInactive : ''}`}>
              <div className={sl.itemInfo}>
                <h3>{store.name}</h3>
                <p>
                  {[store.street, store.city, store.state, store.zip, store.country].filter(Boolean).join(', ') || t('storeLocationsAdmin.noAddress')}
                </p>
                <p>{t('storeLocationsAdmin.coordinates')}: {store.lat}, {store.lng}</p>
                {store.phone && <p>{t('storeLocationsAdmin.phone')}: {store.phone}</p>}
                {store.hours && <p>{t('storeLocationsAdmin.hours')}: {store.hours}</p>}
                {!store.active && <p><em>{t('storeLocationsAdmin.inactiveNote')}</em></p>}
              </div>
              <div className={sl.itemActions}>
                <button type="button" className={sl.itemBtn} onClick={() => openEdit(store)}>{t('common.edit')}</button>
                <button type="button" className={`${sl.itemBtn} ${sl.itemBtnDanger}`} onClick={() => handleDelete(store.id)}>{t('common.delete')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <div className={sl.modalOverlay} onClick={closeModal} role="presentation">
          <div className={sl.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={sl.modalTitle}>{modal === 'new' ? t('storeLocationsAdmin.addStore') : t('storeLocationsAdmin.editStore')}</h2>
            {error && <p className={sl.error}>{error}</p>}
            {message && <p className={sl.message}>{message}</p>}
            <form onSubmit={handleSubmit}>
              <div className={sl.formGroup}>
                <label>{t('storeLocationsAdmin.name')} *</label>
                <input
                  type="text"
                  className={sl.input}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder={t('storeLocationsAdmin.namePlaceholder')}
                />
              </div>
              <div className={sl.formGroup}>
                <label>{t('storeLocationsAdmin.street')}</label>
                <input
                  type="text"
                  className={sl.input}
                  value={form.street}
                  onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                  placeholder={t('storeLocationsAdmin.streetPlaceholder')}
                />
              </div>
              <div className={sl.row}>
                <div className={sl.formGroup}>
                  <label>{t('storeLocationsAdmin.city')}</label>
                  <input
                    type="text"
                    className={sl.input}
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div className={sl.formGroup}>
                  <label>{t('storeLocationsAdmin.stateRegion')}</label>
                  <input
                    type="text"
                    className={sl.input}
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  />
                </div>
              </div>
              <div className={sl.row}>
                <div className={sl.formGroup}>
                  <label>{t('storeLocationsAdmin.zip')}</label>
                  <input
                    type="text"
                    className={sl.input}
                    value={form.zip}
                    onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                  />
                </div>
                <div className={sl.formGroup}>
                  <label>{t('storeLocationsAdmin.country')}</label>
                  <input
                    type="text"
                    className={sl.input}
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    placeholder={t('storeLocationsAdmin.countryPlaceholder')}
                  />
                </div>
              </div>
              <div className={sl.row}>
                <div className={sl.formGroup}>
                  <label>{t('storeLocationsAdmin.latitude')} *</label>
                  <input
                    type="text"
                    className={sl.input}
                    value={form.lat}
                    onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                    placeholder={t('storeLocationsAdmin.latPlaceholder')}
                    required
                  />
                </div>
                <div className={sl.formGroup}>
                  <label>{t('storeLocationsAdmin.longitude')} *</label>
                  <input
                    type="text"
                    className={sl.input}
                    value={form.lng}
                    onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                    placeholder={t('storeLocationsAdmin.lngPlaceholder')}
                    required
                  />
                </div>
              </div>
              <div className={sl.formGroup}>
                <label>{t('storeLocationsAdmin.phone')}</label>
                <input
                  type="text"
                  className={sl.input}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder={t('storeLocationsAdmin.phonePlaceholder')}
                />
              </div>
              <div className={sl.formGroup}>
                <label>{t('storeLocationsAdmin.hours')}</label>
                <input
                  type="text"
                  className={sl.input}
                  value={form.hours}
                  onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
                  placeholder={t('storeLocationsAdmin.hoursPlaceholder')}
                />
              </div>
              <div className={sl.formGroup}>
                <label className={sl.toggle}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                  <span>{t('storeLocationsAdmin.activeLabel')}</span>
                </label>
              </div>
              <div className={sl.modalActions}>
                <button type="submit" className={sl.btn} disabled={saving}>
                  {saving ? t('storeLocationsAdmin.saving') : t('common.save')}
                </button>
                <button type="button" className={sl.cancelBtn} onClick={closeModal}>{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
