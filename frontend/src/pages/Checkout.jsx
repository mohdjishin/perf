import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useCart } from '../context/CartContext'
import { formatPrice } from '../utils/currency'
import { OrderSuccessModal } from '../components/OrderSuccessModal'
import { BackButton } from '../components/BackButton'
import { Toast } from '../components/Toast'
import s from './Checkout.module.css'

const emptyAddress = { street: '', city: '', state: '', zip: '', country: '' }

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
  const subtotal = total // cart total = items sum (subtotal before fee)
  const [feeEstimate, setFeeEstimate] = useState(null)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [useNewAddress, setUseNewAddress] = useState(false)
  const [address, setAddress] = useState(emptyAddress)
  const [saveAddressForLater, setSaveAddressForLater] = useState(false)
  const [saveAddressLabel, setSaveAddressLabel] = useState('Home')
  const [saveAddressLabelCustom, setSaveAddressLabelCustom] = useState('')
  const [saveAddressLoading, setSaveAddressLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    })
  }

  const handleUseNewAddress = () => {
    setUseNewAddress(true)
    setSelectedId(null)
    setAddress(emptyAddress)
  }

  const handleChange = (e) => {
    setAddress((a) => ({ ...a, [e.target.name]: e.target.value }))
    if (selectedId) setSelectedId(null)
  }

  const canSaveAddress = address.street?.trim() && address.city?.trim() && address.zip?.trim() && address.country?.trim()

  const getLabelToSave = () => (saveAddressLabel === 'Custom' ? saveAddressLabelCustom.trim() : saveAddressLabel)

  const saveAddressToAccount = async () => {
    if (!canSaveAddress) return
    const labelToSave = getLabelToSave()
    if (!labelToSave && saveAddressLabel === 'Custom') {
      setError('Enter a name for this address (e.g. Parents, Villa)')
      return
    }
    setSaveAddressLoading(true)
    setError('')
    try {
      const created = await api('/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label: labelToSave || 'Other',
          street: address.street.trim(),
          city: address.city.trim(),
          state: (address.state || '').trim(),
          zip: address.zip.trim(),
          country: address.country.trim(),
        }),
      })
      setAddresses((prev) => [...prev, created])
      setSelectedId(created.id)
      setUseNewAddress(false)
      setAddress({
        street: created.street,
        city: created.city,
        state: created.state || '',
        zip: created.zip,
        country: created.country,
      })
      setToastMessage('Address saved to your account')
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
      await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
          address,
        }),
      })
      clearCart()
      setOrderSuccess(true)
      if (saveAddressForLater && address.street?.trim() && address.city?.trim() && address.zip?.trim() && address.country?.trim()) {
        const labelToSave = saveAddressLabel === 'Custom' ? saveAddressLabelCustom.trim() : saveAddressLabel
        api('/addresses', {
          method: 'POST',
          body: JSON.stringify({
            label: labelToSave || 'Other',
            street: address.street.trim(),
            city: address.city.trim(),
            state: (address.state || '').trim(),
            zip: address.zip.trim(),
            country: address.country.trim(),
          }),
        }).catch(() => {})
      }
    } catch (err) {
      setError(err.data?.error || err.message)
    } finally {
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
          {addresses.length > 0 && (
            <div className={s.addressOptions}>
              {(() => {
                const grouped = groupAddressesByLabel(addresses)
                const sections = [
                  { key: 'Home', addrs: grouped.Home },
                  { key: 'Office', addrs: grouped.Office },
                  { key: 'Other', addrs: grouped.Other },
                  { key: null, addrs: grouped.rest },
                ].filter((s) => s.addrs.length > 0)
                return (
                  <>
                    {sections.map(({ key, addrs }) => (
                      <div key={key || 'other'} className={s.addressGroup}>
                        {key && <span className={s.addressGroupLabel}>{key}</span>}
                        {addrs.map((addr) => (
                          <label key={addr.id} className={`${s.addressOption} ${selectedId === addr.id && !useNewAddress ? s.selected : ''}`}>
                            <input
                              type="radio"
                              name="addressChoice"
                              checked={selectedId === addr.id && !useNewAddress}
                              onChange={() => handleSelectAddress(addr)}
                            />
                            <div className={s.addressOptionContent}>
                              {addr.label && addr.label !== key && <span className={s.addressLabel}>{addr.label}</span>}
                              <span className={s.addressText}>
                                {addr.street}<br />
                                {addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.zip}, {addr.country}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    ))}
                    <label className={`${s.addressOption} ${useNewAddress ? s.selected : ''}`}>
                      <input
                        type="radio"
                        name="addressChoice"
                        checked={useNewAddress}
                        onChange={handleUseNewAddress}
                      />
                      <span>Add new address</span>
                    </label>
                  </>
                )
              })()}
            </div>
          )}
          {useNewAddress ? (
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
                placeholder="Country (e.g. UAE)"
                value={address.country}
                onChange={handleChange}
                required
                className={s.input}
              />
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
                      placeholder="e.g. Parents, Villa, Work"
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
                    disabled={!canSaveAddress || saveAddressLoading || (saveAddressLabel === 'Custom' && !saveAddressLabelCustom.trim())}
                    className={s.saveAddressBtn}
                  >
                    {saveAddressLoading ? 'Saving…' : 'Save to my addresses'}
                  </button>
                  <label className={s.saveAddressCheckbox}>
                    <input
                      type="checkbox"
                      checked={saveAddressForLater}
                      onChange={(e) => setSaveAddressForLater(e.target.checked)}
                    />
                    Also save when I place this order
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className={s.addressDisplay}>
              <p className={s.deliveryLabel}>Delivery to</p>
              <p className={s.addressLine}>{address.street || '—'}</p>
              <p className={s.addressLine}>
                {[address.city, address.state, address.zip].filter(Boolean).join(', ') || '—'}
              </p>
              <p className={s.addressLine}>{address.country || '—'}</p>
            </div>
          )}
        </div>
        <div className={s.section}>
          <h3 className={s.sectionTitle}>Order</h3>
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
        {error && <p className={s.error}>{error}</p>}
        <button type="submit" disabled={loading} className={s.btn}>
          {loading ? 'Placing order...' : 'Place Order'}
        </button>
      </form>
    </div>
  )
}
