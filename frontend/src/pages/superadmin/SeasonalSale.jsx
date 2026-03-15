import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, uploadFile } from '../../api/client'
import s from './SuperAdmin.module.css'
import b from './SeasonalSale.module.css'

export default function SeasonalSale() {
  const [enabled, setEnabled] = useState(false)
  const [headline, setHeadline] = useState('')
  const [subheadline, setSubheadline] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [theme, setTheme] = useState('dark')
  const [showOn, setShowOn] = useState('both')
  const [ctaNewTab, setCtaNewTab] = useState(false)
  const [dismissible, setDismissible] = useState(false)
  const [seasonalFlag, setSeasonalFlag] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [availableFlags, setAvailableFlags] = useState([])

  useEffect(() => {
    api('/banners/seasonal-sale')
      .then((data) => {
        setEnabled(data.enabled ?? false)
        setHeadline(data.headline || '')
        setSubheadline(data.subheadline || '')
        setCtaText(data.cta_text || '')
        setStartDate(data.start_date || '')
        setEndDate(data.end_date || '')
        setImageUrl(data.image_url || '')
        setTheme(data.theme === 'light' ? 'light' : 'dark')
        setShowOn(data.show_on === 'home' || data.show_on === 'shop' ? data.show_on : 'both')
        setCtaNewTab(!!data.cta_new_tab)
        setDismissible(!!data.dismissible)
        setSeasonalFlag(data.seasonal_flag || '')
      })
      .catch(() => setError('Could not load banner settings.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    api('/products/seasonal-flags')
      .then((data) => setAvailableFlags(data.flags || []))
      .catch(() => setAvailableFlags([]))
  }, [])

  const handleBannerImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file)
      setImageUrl(url)
    } catch (err) {
      setError(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await api('/banners/seasonal-sale', {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          headline: headline.trim() || undefined,
          subheadline: subheadline.trim() || undefined,
          cta_text: ctaText.trim() || undefined,
          start_date: startDate.trim() || undefined,
          end_date: endDate.trim() || undefined,
          image_url: imageUrl.trim() || undefined,
          theme,
          show_on: showOn,
          cta_new_tab: ctaNewTab,
          dismissible,
          seasonal_flag: seasonalFlag.trim() || undefined,
        }),
      })
      setMessage('Seasonal sale banner saved. It will show on Home and/or Shop when enabled and within the date range.')
    } catch (err) {
      setError(err.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={s.page}>
        <Link to="/superadmin" className={s.back}>← Super Admin</Link>
        <p className={b.loading}>Loading…</p>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <Link to="/superadmin" className={s.back}>← Super Admin</Link>
      <h1 className={s.title}>Seasonal Sale Banner</h1>
      <p className={s.subtitle}>Customize the promo banner shown on Home and Shop. Set a seasonal flag — the button will link to Shop filtered by that flag.</p>

      <form onSubmit={handleSave} className={b.form}>
        {error && <p className={b.error}>{error}</p>}
        {message && <p className={b.message}>{message}</p>}

        <label className={b.toggle}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Enable seasonal sale banner</span>
        </label>

        <label className={b.field}>
          <span className={b.label}>Seasonal flag</span>
          <input
            type="text"
            list="seasonal-flags-datalist"
            value={seasonalFlag}
            onChange={(e) => setSeasonalFlag(e.target.value)}
            placeholder={availableFlags.length ? `e.g. ${availableFlags.slice(0, 2).join(', ')}` : 'e.g. christmas, ramadan'}
            className={b.input}
            aria-describedby="seasonal-flag-hint"
          />
          <datalist id="seasonal-flags-datalist">
            {availableFlags.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <span id="seasonal-flag-hint" className={b.hint}>
            {availableFlags.length
              ? `Suggestions: ${availableFlags.join(', ')}. Or type a new flag (then set it on products in Admin).`
              : 'Button links to /shop?seasonal=<flag>. Set the same flag on products in Admin → Products.'}
          </span>
        </label>

        <label className={b.field}>
          <span className={b.label}>Headline</span>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g. Summer Sale — Up to 30% Off"
            className={b.input}
          />
        </label>
        <label className={b.field}>
          <span className={b.label}>Subheadline (optional)</span>
          <input
            type="text"
            value={subheadline}
            onChange={(e) => setSubheadline(e.target.value)}
            placeholder="e.g. Selected oud & bakhoor"
            className={b.input}
          />
        </label>
        <label className={b.field}>
          <span className={b.label}>Button text</span>
          <input
            type="text"
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            placeholder="e.g. Shop the sale"
            className={b.input}
          />
        </label>
        <div className={b.row}>
          <label className={b.field}>
            <span className={b.label}>Start date (optional)</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={b.input}
            />
          </label>
          <label className={b.field}>
            <span className={b.label}>End date (optional)</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={b.input}
            />
          </label>
        </div>
        <label className={b.field}>
          <span className={b.label}>Background image (optional)</span>
          <div className={b.imageOptions}>
            <div className={b.uploadWrap}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleBannerImageUpload}
                disabled={uploading}
                className={b.fileInput}
                id="banner-image-upload"
              />
              <label htmlFor="banner-image-upload" className={`${b.uploadBtn} ${uploading ? b.uploading : ''}`}>
                {uploading ? 'Uploading…' : 'Upload image'}
              </label>
            </div>
            <span className={b.or}>or URL:</span>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://… or leave empty for gradient"
              className={b.input}
              style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
              aria-label="Background image URL"
            />
          </div>
          {imageUrl && (
            <div className={b.imagePreview}>
              <img
                src={imageUrl}
                alt="Banner preview"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </div>
          )}
        </label>
        <label className={b.field}>
          <span className={b.label}>Show banner on</span>
          <select value={showOn} onChange={(e) => setShowOn(e.target.value)} className={b.input}>
            <option value="both">Both (Home and Shop)</option>
            <option value="home">Home only</option>
            <option value="shop">Shop only</option>
          </select>
        </label>
        <label className={b.toggle}>
          <input type="checkbox" checked={ctaNewTab} onChange={(e) => setCtaNewTab(e.target.checked)} />
          <span>Open button link in new tab</span>
        </label>
        <label className={b.toggle}>
          <input type="checkbox" checked={dismissible} onChange={(e) => setDismissible(e.target.checked)} />
          <span>Dismissible (hidden for 24h after close)</span>
        </label>
        <label className={b.field}>
          <span className={b.label}>Theme</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} className={b.input}>
            <option value="dark">Dark (light text on dark)</option>
            <option value="light">Light (dark text on light)</option>
          </select>
        </label>

        <div className={b.actions}>
          <button type="submit" className={b.saveBtn} disabled={saving}>
            {saving ? 'Saving…' : 'Save banner'}
          </button>
        </div>
      </form>
    </div>
  )
}
