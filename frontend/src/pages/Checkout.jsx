import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useCart } from '../context/CartContext'
import { formatPrice } from '../utils/currency'
import { OrderSuccessModal } from '../components/OrderSuccessModal'
import { BackButton } from '../components/BackButton'
import { Toast } from '../components/Toast'
import s from './Checkout.module.css'

const emptyAddress = { street: '', city: '', state: '', zip: '', country: '', phone: '', secondaryPhone: '' }

const ADDRESS_LABELS = ['Home', 'Office', 'Other']

/** Group addresses by label for display: Home, Office, Other, then rest as "Other" */
function groupAddressesByLabel(addresses) {
  const groups = { Home: [], Office: [], Other: [] }
  const rest = []
  for (const addr of addresses) {
    const label = (addr.label || '').trim()
    if (label === 'Home') groups.Home.push(addr)
    else if (label === 'Office') groups.Office.push(addr)
    else if (label === 'Other') groups.Other.push(addr)
    else if (label) rest.push(addr)
    else rest.push(addr)
  }
  return { ...groups, rest }
}

export default function Checkout() {
  const { items, total, clearCart } = useCart()
  const navigate = useNavigate()
  const subtotal = total
  const [feeEstimate, setFeeEstimate] = useState(null)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [useNewAddress, setUseNewAddress] = useState(false)
  const [editingSavedId, setEditingSavedId] = useState(null)
  const [address, setAddress] = useState(emptyAddress)
  const [saveAddressForLater, setSaveAddressForLater] = useState(false)
  const [saveAddressLabel, setSaveAddressLabel] = useState('Home')
  const [saveAddressLabelCustom, setSaveAddressLabelCustom] = useState('')
  const [saveAddressLoading, setSaveAddressLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Check for cancelled return from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('cancelled') === 'true') {
      setError('Payment was cancelled. You can try again.')
      // Clean the URL
      window.history.replaceState({}, '', '/checkout')
    }
  }, [])

  useEffect(() => {
    if (subtotal <= 0) {
      setFeeEstimate({ subtotal: 0, fee: 0, total: 0, breakdown: [] })
      return
    }
    api(`/orders/fee-estimate?subtotal=${encodeURIComponent(subtotal)}`)
      .then((data) => setFeeEstimate({
        subtotal: data.subtotal,
        fee: data.fee,
        total: data.total,
        breakdown: Array.isArray(data.breakdown) ? data.breakdown : [],
      }))
      .catch(() => setFeeEstimate({ subtotal, fee: 0, total: subtotal, breakdown: [] }))
  }, [subtotal])

  useEffect(() => {
    api('/addresses')
      .then((res) => {
        const addrs = res.addresses || []
        setAddresses(addrs)
        const defaultAddr = addrs.find((a) => a.isDefault) || addrs[0]
        if (defaultAddr) {
          setSelectedId(defaultAddr.id)
          setUseNewAddress(false)
          setAddress({
            street: defaultAddr.street,
            city: defaultAddr.city,
            state: defaultAddr.state || '',
            zip: defaultAddr.zip,
            country: defaultAddr.country,
            phone: defaultAddr.phone || '',
            secondaryPhone: defaultAddr.secondaryPhone || '',
          })
        } else {
          setUseNewAddress(true)
          setAddress(emptyAddress)
        }
      })
      .catch(() => setUseNewAddress(true))
  }, [])

  const handleSelectAddress = (addr) => {
    setSelectedId(addr.id)
    setUseNewAddress(false)
    setAddress({
      street: addr.street,
      city: addr.city,
      state: addr.state || '',
      zip: addr.zip,
      country: addr.country,
      phone: addr.phone || '',
      secondaryPhone: addr.secondaryPhone || '',
    })
  }

  const handleUseNewAddress = () => {
    setUseNewAddress(true)
    setSelectedId(null)
    setEditingSavedId(null)
    setAddress(emptyAddress)
  }

  const handleEditAddress = (addr) => {
    setEditingSavedId(addr.id)
    setUseNewAddress(true)
    setSelectedId(null)
    setAddress({
      street: addr.street,
      city: addr.city,
      state: addr.state || '',
      zip: addr.zip,
      country: addr.country,
      phone: addr.phone || '',
      secondaryPhone: addr.secondaryPhone || '',
    })
  }

  const handleChange = (e) => {
    setAddress((a) => ({ ...a, [e.target.name]: e.target.value }))
    if (selectedId) setSelectedId(null)
  }

  const performSaveAddress = async (addrData) => {
    if (!addrData.street?.trim() || !addrData.city?.trim() || !addrData.zip?.trim() || !addrData.country?.trim() || !addrData.phone?.trim()) return
    const labelToSave = saveAddressLabel === 'Custom' ? saveAddressLabelCustom.trim() : saveAddressLabel
    return api('/addresses', {
      method: 'POST',
      body: JSON.stringify({
        label: labelToSave || 'Other',
        street: addrData.street.trim(),
        city: addrData.city.trim(),
        state: (addrData.state || '').trim(),
        zip: addrData.zip.trim(),
        country: addrData.country.trim(),
        phone: addrData.phone.trim(),
        secondaryPhone: (addrData.secondaryPhone || '').trim(),
      }),
    })
  }

  const saveAddressToAccount = async () => {
    setSaveAddressLoading(true)
    setError('')
    try {
      let created
      if (editingSavedId) {
        created = await api(`/addresses/${editingSavedId}`, {
          method: 'PUT',
          body: JSON.stringify({
            label: saveAddressLabel === 'Custom' ? saveAddressLabelCustom.trim() : saveAddressLabel,
            street: address.street.trim(),
            city: address.city.trim(),
            state: (address.state || '').trim(),
            zip: address.zip.trim(),
            country: address.country.trim(),
            phone: address.phone.trim(),
            secondaryPhone: (address.secondaryPhone || '').trim(),
          }),
        })
        // PUT might return {ok: true} or the updated object. Assuming it returns {ok:true} for now based on usual patterns, 
        // but if it doesn't return the object, we just refresh or manually update state.
        // Let's assume we need to refresh the list.
        const updatedList = await api('/addresses')
        setAddresses(updatedList.addresses || [])
        created = (updatedList.addresses || []).find(a => a.id === editingSavedId)
      } else {
        created = await performSaveAddress(address)
      }

      if (created) {
        setAddresses((prev) => [...prev, created])
        setSelectedId(created.id)
        setUseNewAddress(false)
        setAddress({
          street: created.street,
          city: created.city,
          state: created.state || '',
          zip: created.zip,
          country: created.country,
          phone: created.phone || '',
          secondaryPhone: created.secondaryPhone || '',
        })
        setToastMessage('Address saved to your account')
      }
    } catch (err) {
      setError(err.data?.error || err.message)
    } finally {
      setSaveAddressLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Create order on backend (returns checkoutUrl for Stripe hosted page)
      const orderResp = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
          address,
        }),
      })

      // 2. Save address if requested
      if (saveAddressForLater) {
        performSaveAddress(address).catch(() => { })
      }

      // 3. Redirect to Stripe Checkout hosted page
      if (orderResp.checkoutUrl) {
        window.location.href = orderResp.checkoutUrl
      } else {
        // Fallback: if no checkout URL (e.g. free order), show success
        clearCart()
        setOrderSuccess(true)
      }
    } catch (err) {
      setError(err.data?.error || err.message)
      setLoading(false)
    }
  }

  if (items.length === 0 && !orderSuccess) {
    navigate('/cart')
    return null
  }

  if (orderSuccess) {
    return (
      <OrderSuccessModal
        onClose={() => {
          setOrderSuccess(false)
          navigate('/')
        }}
      />
    )
  }

  return (
    <div className={s.page}>
      <Toast
        visible={!!toastMessage}
        message={toastMessage || ''}
        onClose={() => setToastMessage(null)}
        autoHideMs={4000}
      />
      <BackButton to="/cart" label="Cart" />
      <h1 className={s.title}>Checkout</h1>
      <form onSubmit={handleSubmit} className={s.form}>
        <div className={s.section}>
          <h3 className={s.sectionTitle}>Shipping Address</h3>
          {!(useNewAddress || editingSavedId) ? (
            /* LIST VIEW */
            <div className={s.addressOptions}>
              {(() => {
                const grouped = groupAddressesByLabel(addresses)
                const sections = [
                  { key: 'Home', addrs: grouped.Home },
                  { key: 'Office', addrs: grouped.Office },
                  { key: 'Other', addrs: grouped.Other },
                  { key: null, addrs: grouped.rest },
                ].filter((s) => s.addrs.length > 0)
                if (sections.length === 0) return (
                  <button type="button" className={s.addNewAddrBtn} onClick={handleUseNewAddress}>
                    + Add shipping address
                  </button>
                )
                return (
                  <>
                    {sections.map(({ key, addrs }) => (
                      <div key={key || 'other'} className={s.addressGroup}>
                        {key && <span className={s.addressGroupLabel}>{key}</span>}
                        {addrs.map((addr) => (
                          <label key={addr.id} className={`${s.addressOption} ${selectedId === addr.id ? s.selected : ''}`}>
                            <input
                              type="radio"
                              name="addressChoice"
                              checked={selectedId === addr.id}
                              onChange={() => handleSelectAddress(addr)}
                            />
                            <div className={s.addressOptionContent}>
                              {addr.label && addr.label !== key && <span className={s.addressLabel}>{addr.label}</span>}
                              <span className={s.addressText}>
                                {addr.street}<br />
                                {addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.zip}, {addr.country}
                                {addr.phone && <><br />Phone: {addr.phone}</>}
                              </span>
                              <button
                                type="button"
                                className={s.editAddrBtn}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleEditAddress(addr)
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          </label>
                        ))}
                      </div>
                    ))}
                    <button type="button" className={s.addNewAddrBtn} onClick={handleUseNewAddress}>
                      + Add new address
                    </button>
                  </>
                )
              })()}
            </div>
          ) : (
            /* FORM VIEW (ADD OR EDIT) */
            <div className={s.addressFormWrap}>
              <div className={s.formHeader}>
                <h4 className={s.formTitle}>{editingSavedId ? 'Edit Address' : 'New Address'}</h4>
                <button type="button" className={s.backToAddressesBtn} onClick={() => { setUseNewAddress(false); setEditingSavedId(null); if (selectedId) handleSelectAddress(addresses.find(a => a.id === selectedId)); }}>
                  Back to addresses
                </button>
              </div>

              <div className={s.addressForm}>
                <input
                  name="street"
                  placeholder="Street / Building"
                  value={address.street}
                  onChange={handleChange}
                  required
                  className={s.input}
                />
                <div className={s.row}>
                  <input
                    name="city"
                    placeholder="City"
                    value={address.city}
                    onChange={handleChange}
                    required
                    className={s.input}
                  />
                  <input
                    name="state"
                    placeholder="Emirate"
                    value={address.state}
                    onChange={handleChange}
                    className={s.input}
                  />
                  <input
                    name="zip"
                    placeholder="P.O. Box"
                    value={address.zip}
                    onChange={handleChange}
                    required
                    className={s.input}
                  />
                </div>
                <input
                  name="country"
                  placeholder="Country (e.g. UAE) *"
                  value={address.country}
                  onChange={handleChange}
                  required
                  className={s.input}
                />
                <div className={s.row}>
                  <input
                    name="phone"
                    placeholder="Phone Number *"
                    value={address.phone}
                    onChange={handleChange}
                    required
                    className={s.input}
                  />
                  <input
                    name="secondaryPhone"
                    placeholder="Secondary Phone (Optional)"
                    value={address.secondaryPhone}
                    onChange={handleChange}
                    className={s.input}
                  />
                </div>

                <div className={s.saveAddressRow}>
                  <div className={s.saveAddressLabelRow}>
                    <span className={s.saveAddressLabelText}>Save as</span>
                    <select
                      value={saveAddressLabel}
                      onChange={(e) => setSaveAddressLabel(e.target.value)}
                      className={s.saveAddressSelect}
                    >
                      {ADDRESS_LABELS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                      <option value="Custom">Custom</option>
                    </select>
                    {saveAddressLabel === 'Custom' && (
                      <input
                        type="text"
                        placeholder="e.g. Parents, Villa"
                        value={saveAddressLabelCustom}
                        onChange={(e) => setSaveAddressLabelCustom(e.target.value)}
                        className={s.saveAddressCustomInput}
                      />
                    )}
                  </div>

                  <div className={s.saveAddressActions}>
                    <button
                      type="button"
                      onClick={saveAddressToAccount}
                      disabled={!address.street?.trim() || !address.city?.trim() || !address.zip?.trim() || !address.country?.trim() || !address.phone?.trim() || saveAddressLoading || (saveAddressLabel === 'Custom' && !saveAddressLabelCustom.trim())}
                      className={s.saveAddressBtn}
                    >
                      {saveAddressLoading ? 'Saving…' : (editingSavedId ? 'Update Address' : 'Save address')}
                    </button>

                    <label className={s.saveAddressCheckbox}>
                      <input
                        type="checkbox"
                        checked={saveAddressForLater}
                        onChange={(e) => setSaveAddressForLater(e.target.checked)}
                      />
                      Save to account for later
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={s.section}>
          <h3 className={s.sectionTitle}>Order Summary</h3>
          {items.map((i) => (
            <div key={i.id} className={s.orderItem}>
              <span>{i.name} × {i.quantity}</span>
              <span>{formatPrice(i.price * i.quantity)}</span>
            </div>
          ))}
          <div className={s.orderRow}>
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {feeEstimate != null && feeEstimate.breakdown && feeEstimate.breakdown.length > 0 && feeEstimate.breakdown.map((line, i) => (
            <div key={i} className={s.orderRow}>
              <span>{line.label || 'Fee'}</span>
              <span>{line.amount >= 0 ? formatPrice(line.amount) : `-${formatPrice(-line.amount)}`}</span>
            </div>
          ))}
          {feeEstimate != null && (feeEstimate.fee !== 0) && !(feeEstimate.breakdown && feeEstimate.breakdown.length > 0) && (
            <div className={s.orderRow}>
              <span>Shipping / Fee</span>
              <span>{feeEstimate.fee >= 0 ? formatPrice(feeEstimate.fee) : `-${formatPrice(-feeEstimate.fee)}`}</span>
            </div>
          )}
          <div className={s.total}>
            <span>Total</span>
            <span>{formatPrice(feeEstimate != null ? feeEstimate.total : total)}</span>
          </div>
        </div>

        <div className={s.paymentNote}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>You'll be redirected to Stripe's secure checkout to complete payment</span>
        </div>

        {error && <p className={s.error}>{error}</p>}
        <button type="submit" disabled={loading} className={s.btn}>
          {loading ? 'Creating order...' : 'Proceed to Payment'}
        </button>
      </form>
    </div>
  )
}
