import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import s from './SuperAdmin.module.css'
import f from './Features.module.css'

// 4 simple options; backend still supports less_than_or_equal / greater_than_or_equal if sent from API
const THRESHOLD_CONDITIONS = [
  { value: 'always', labelKey: 'orderFee.applyAlways' },
  { value: 'greater_than', labelKey: 'orderFee.applyOver' },
  { value: 'less_than', labelKey: 'orderFee.applyUnder' },
  { value: 'equal', labelKey: 'orderFee.applyEquals' },
]

const defaultItem = () => ({
  label: '',
  kind: 'charge',
  chargeType: 'fixed',
  value: 0,
  thresholdAmount: 0,
  thresholdCondition: 'always',
})

export default function SuperAdminOrderFee() {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/settings/order-fee')
      .then((data) => {
        setEnabled(data.enabled === true)
        const list = Array.isArray(data.items) && data.items.length > 0
          ? data.items.map((it) => ({
              label: it.label ?? '',
              kind: it.kind === 'discount' ? 'discount' : 'charge',
              chargeType: it.chargeType === 'percent' ? 'percent' : 'fixed',
              value: Number(it.value) || 0,
              thresholdAmount: Number(it.thresholdAmount) || 0,
              thresholdCondition: (() => {
                const c = it.thresholdCondition
                if (c === 'less_than_or_equal') return 'less_than'
                if (c === 'greater_than_or_equal') return 'greater_than'
                if (['less_than', 'equal', 'greater_than'].includes(c)) return c
                if (c === 'above') return 'greater_than'
                if (c === 'below') return 'less_than'
                return 'always'
              })(),
            }))
          : []
        setItems(list)
      })
      .catch(() => setError('Failed to load order fee settings'))
      .finally(() => setLoading(false))
  }, [])

  const setItem = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const addItem = () => {
    setItems((prev) => [...prev, defaultItem()])
  }

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await api('/settings/order-fee', {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          items: items.map((it) => ({
            label: it.label.trim() || (it.kind === 'discount' ? 'Discount' : 'Fee'),
            kind: it.kind,
            chargeType: it.chargeType,
            value: it.value >= 0 ? it.value : 0,
            thresholdAmount: it.thresholdAmount >= 0 ? it.thresholdAmount : 0,
            thresholdCondition: it.thresholdCondition || 'always',
          })),
        }),
      })
      setMessage(t('orderFee.saved', 'Settings saved.'))
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={s.page}>
        <Link to="/superadmin" className={s.back}>← {t('nav.superAdmin', 'Super Admin')}</Link>
        <p className={f.loading}>{t('orderFee.loading', 'Loading...')}</p>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <Link to="/superadmin" className={s.back}>← {t('nav.superAdmin', 'Super Admin')}</Link>
      <h1 className={s.title}>{t('orderFee.title', 'Order fees & adjustments')}</h1>
      <p className={s.subtitle}>
        {t('orderFee.subtitleSimple', 'Add extra charges (e.g. shipping, tax) or discounts. Say how much and when they apply.')}
      </p>

      <form onSubmit={handleSave} className={f.form}>
        {error && <p className={f.error}>{error}</p>}
        {message && <p className={f.message}>{message}</p>}

        <label className={f.toggle}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>{t('orderFee.enableHint', 'Use these rules at checkout')}</span>
        </label>

        <p className={f.groupLabel}>{t('orderFee.eachLine', 'Each line')}</p>
        <p className={f.hint}>{t('orderFee.eachLineHint', 'Name (what customers see), add or subtract, amount (fixed or %), and when it applies.')}</p>

        {items.map((it, index) => (
          <div key={index} className={f.whyFields} style={{ marginTop: '1rem' }}>
            <div className={f.row} style={{ marginBottom: '0.5rem' }}>
              <label className={f.fieldLabel} style={{ flex: 1 }}>
                {t('orderFee.name', 'Name (e.g. Shipping, Tax)')}
                <input
                  type="text"
                  className={f.input}
                  value={it.label}
                  onChange={(e) => setItem(index, 'label', e.target.value)}
                  placeholder={it.kind === 'discount' ? 'e.g. Member discount' : 'e.g. Shipping'}
                  maxLength={80}
                />
              </label>
              <label className={f.fieldLabel} style={{ minWidth: '140px' }}>
                {t('orderFee.addOrSubtract', 'Add or subtract')}
                <select
                  className={f.input}
                  value={it.kind}
                  onChange={(e) => setItem(index, 'kind', e.target.value)}
                >
                  <option value="charge">{t('orderFee.addToTotal', 'Add to total')}</option>
                  <option value="discount">{t('orderFee.subtractFromTotal', 'Subtract from total')}</option>
                </select>
              </label>
            </div>
            <div className={f.row}>
              <label className={f.fieldLabel}>
                {it.chargeType === 'percent' ? t('orderFee.percentOfOrder', 'Percent of order') : t('orderFee.fixedAmount', 'Fixed amount')}
                <input
                  type="number"
                  step={it.chargeType === 'percent' ? '0.1' : '0.01'}
                  min="0"
                  className={f.input}
                  value={it.value === 0 ? '' : it.value}
                  onChange={(e) => setItem(index, 'value', parseFloat(e.target.value) || 0)}
                  placeholder={it.chargeType === 'percent' ? '5' : '5'}
                />
              </label>
              <label className={f.fieldLabel}>
                {t('orderFee.fixedOrPercent', 'Fixed or %')}
                <select
                  className={f.input}
                  value={it.chargeType}
                  onChange={(e) => setItem(index, 'chargeType', e.target.value)}
                >
                  <option value="fixed">{t('orderFee.fixed', 'Fixed (e.g. 5 AED)')}</option>
                  <option value="percent">{t('orderFee.percent', 'Percent (e.g. 5%)')}</option>
                </select>
              </label>
            </div>
            <div className={f.row}>
              <label className={f.fieldLabel}>
                {t('orderFee.whenApply', 'When to apply')}
                <select
                  className={f.input}
                  value={['always', 'greater_than', 'less_than', 'equal'].includes(it.thresholdCondition) ? it.thresholdCondition : 'always'}
                  onChange={(e) => setItem(index, 'thresholdCondition', e.target.value)}
                >
                  {THRESHOLD_CONDITIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                  ))}
                </select>
              </label>
              <label className={f.fieldLabel}>
                {t('orderFee.orderTotalAmount', 'Order total (AED)')}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={f.input}
                  value={it.thresholdAmount === 0 ? '' : it.thresholdAmount}
                  onChange={(e) => setItem(index, 'thresholdAmount', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  disabled={it.thresholdCondition === 'always'}
                />
              </label>
            </div>
            <button
              type="button"
              className={f.removeItemBtn}
              onClick={() => removeItem(index)}
              aria-label={t('orderFee.remove', 'Remove')}
            >
              {t('orderFee.remove', 'Remove')}
            </button>
          </div>
        ))}

        <button type="button" className={f.addItemBtn} onClick={addItem}>
          {t('orderFee.addLine', 'Add another line')}
        </button>

        <div className={f.actions} style={{ marginTop: '1.5rem' }}>
          <button type="submit" className={f.saveBtn} disabled={saving}>
            {saving ? t('orderFee.saving', 'Saving...') : t('common.save', 'Save')}
          </button>
        </div>
      </form>
    </div>
  )
}
