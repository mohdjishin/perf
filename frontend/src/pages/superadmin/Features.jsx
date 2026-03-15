import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import s from './SuperAdmin.module.css'
import f from './Features.module.css'

const defaultWhyItems = (t) => [
  { title: t('featuresAdmin.whyItem1Title'), description: t('featuresAdmin.whyItem1Desc') },
  { title: t('featuresAdmin.whyItem2Title'), description: t('featuresAdmin.whyItem2Desc') },
  { title: t('featuresAdmin.whyItem3Title'), description: t('featuresAdmin.whyItem3Desc') },
]

export default function SuperAdminFeatures() {
  const { t } = useTranslation()
  const [newArrivalHome, setNewArrivalHome] = useState(true)
  const [newArrivalShop, setNewArrivalShop] = useState(true)
  const [discountedHome, setDiscountedHome] = useState(true)
  const [discountedShop, setDiscountedShop] = useState(true)
  const [featuredHome, setFeaturedHome] = useState(true)
  const [seasonalBannerEnabled, setSeasonalBannerEnabled] = useState(true)
  const [i18nEnabled, setI18nEnabled] = useState(true)
  const [storeLocatorEnabled, setStoreLocatorEnabled] = useState(true)
  const [signupEnabled, setSignupEnabled] = useState(true)
  const [invoiceCompanyName, setInvoiceCompanyName] = useState('Blue Mist Perfumes')
  const [invoiceStreet, setInvoiceStreet] = useState('')
  const [invoiceCity, setInvoiceCity] = useState('')
  const [invoiceState, setInvoiceState] = useState('')
  const [invoiceZip, setInvoiceZip] = useState('')
  const [invoiceCountry, setInvoiceCountry] = useState('')
  const [invoicePhone, setInvoicePhone] = useState('')
  const [invoiceEmail, setInvoiceEmail] = useState('')
  const [invoiceTrn, setInvoiceTrn] = useState('')
  const [returnDaysAfterDelivery, setReturnDaysAfterDelivery] = useState(0)
  const [socialEnabled, setSocialEnabled] = useState(false)
  const [socialFacebook, setSocialFacebook] = useState('')
  const [socialFacebookEnabled, setSocialFacebookEnabled] = useState(true)
  const [socialInstagram, setSocialInstagram] = useState('')
  const [socialInstagramEnabled, setSocialInstagramEnabled] = useState(true)
  const [socialTwitter, setSocialTwitter] = useState('')
  const [socialTwitterEnabled, setSocialTwitterEnabled] = useState(true)
  const [socialYoutube, setSocialYoutube] = useState('')
  const [socialYoutubeEnabled, setSocialYoutubeEnabled] = useState(true)
  const [whySectionEnabled, setWhySectionEnabled] = useState(true)
  const [whySectionTitle, setWhySectionTitle] = useState('')
  const [whySectionItems, setWhySectionItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/settings/features')
      .then((data) => {
        setNewArrivalHome(data.new_arrival_section_enabled !== false)
        setNewArrivalShop(data.new_arrival_shop_filter_enabled !== false)
        setDiscountedHome(data.discounted_section_enabled !== false)
        setDiscountedShop(data.discounted_shop_filter_enabled !== false)
        setFeaturedHome(data.featured_section_enabled !== false)
        setSeasonalBannerEnabled(data.seasonal_banner_enabled !== false)
        setI18nEnabled(data.i18n_enabled !== false)
        setStoreLocatorEnabled(data.store_locator_enabled !== false)
        setSignupEnabled(data.signup_enabled !== false)
        setInvoiceCompanyName(data.invoice_company_name ?? 'Blue Mist Perfumes')
        setInvoiceStreet(data.invoice_street ?? '')
        setInvoiceCity(data.invoice_city ?? '')
        setInvoiceState(data.invoice_state ?? '')
        setInvoiceZip(data.invoice_zip ?? '')
        setInvoiceCountry(data.invoice_country ?? '')
        setInvoicePhone(data.invoice_phone ?? '')
        setInvoiceEmail(data.invoice_email ?? '')
        setInvoiceTrn(data.invoice_trn ?? '')
        setReturnDaysAfterDelivery(Math.max(0, parseInt(data.return_days_after_delivery, 10) || 0))
        setSocialEnabled(data.social_enabled === true)
        setSocialFacebook(data.social_facebook ?? '')
        setSocialFacebookEnabled(data.social_facebook_enabled !== false)
        setSocialInstagram(data.social_instagram ?? '')
        setSocialInstagramEnabled(data.social_instagram_enabled !== false)
        setSocialTwitter(data.social_twitter ?? '')
        setSocialTwitterEnabled(data.social_twitter_enabled !== false)
        setSocialYoutube(data.social_youtube ?? '')
        setSocialYoutubeEnabled(data.social_youtube_enabled !== false)
        setWhySectionEnabled(data.why_section_enabled !== false)
        setWhySectionTitle(data.why_section_title ?? t('featuresAdmin.sectionTitlePlaceholder'))
        setWhySectionItems(Array.isArray(data.why_section_items) && data.why_section_items.length > 0
          ? data.why_section_items.map((i) => ({ title: i.title ?? '', description: i.description ?? '' }))
          : defaultWhyItems(t))
      })
      .catch(() => setError(t('featuresAdmin.errorLoad')))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await api('/settings/features', {
        method: 'PUT',
        body: JSON.stringify({
          new_arrival_section_enabled: newArrivalHome,
          new_arrival_shop_filter_enabled: newArrivalShop,
          discounted_section_enabled: discountedHome,
          discounted_shop_filter_enabled: discountedShop,
          featured_section_enabled: featuredHome,
          seasonal_banner_enabled: seasonalBannerEnabled,
          i18n_enabled: i18nEnabled,
          store_locator_enabled: storeLocatorEnabled,
          signup_enabled: signupEnabled,
          invoice_company_name: invoiceCompanyName.trim() || undefined,
          invoice_street: invoiceStreet.trim() || undefined,
          invoice_city: invoiceCity.trim() || undefined,
          invoice_state: invoiceState.trim() || undefined,
          invoice_zip: invoiceZip.trim() || undefined,
          invoice_country: invoiceCountry.trim() || undefined,
          invoice_phone: invoicePhone.trim() || undefined,
          invoice_email: invoiceEmail.trim() || undefined,
          invoice_trn: invoiceTrn.trim() || undefined,
          return_days_after_delivery: Math.max(0, returnDaysAfterDelivery),
          social_enabled: socialEnabled,
          social_facebook: socialFacebook.trim() || undefined,
          social_facebook_enabled: socialFacebookEnabled,
          social_instagram: socialInstagram.trim() || undefined,
          social_instagram_enabled: socialInstagramEnabled,
          social_twitter: socialTwitter.trim() || undefined,
          social_twitter_enabled: socialTwitterEnabled,
          social_youtube: socialYoutube.trim() || undefined,
          social_youtube_enabled: socialYoutubeEnabled,
          why_section_enabled: whySectionEnabled,
          why_section_title: whySectionTitle.trim() || t('featuresAdmin.sectionTitlePlaceholder'),
          why_section_items: whySectionItems.filter((i) => i.title.trim() || i.description.trim()).map((i) => ({
            title: i.title.trim(),
            description: i.description.trim(),
          })),
        }),
      })
      setMessage(t('featuresAdmin.settingsSaved'))
      window.dispatchEvent(new CustomEvent('features:updated'))
    } catch (err) {
      setError(err.message || t('featuresAdmin.errorSave'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={s.page}>
        <Link to="/superadmin" className={s.back}>← {t('featuresAdmin.back')}</Link>
        <p className={f.loading}>{t('featuresAdmin.loading')}</p>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <Link to="/superadmin" className={s.back}>← {t('featuresAdmin.back')}</Link>
      <h1 className={s.title}>{t('featuresAdmin.title')}</h1>
      <p className={s.subtitle}>{t('featuresAdmin.subtitle')}</p>

      <form onSubmit={handleSave} className={f.form}>
        {error && <p className={f.error}>{error}</p>}
        {message && <p className={f.message}>{message}</p>}
        <p className={f.groupLabel}>{t('featuresAdmin.customerSignup')}</p>
        <label className={f.toggle}>
          <input
            type="checkbox"
            checked={signupEnabled}
            onChange={(e) => setSignupEnabled(e.target.checked)}
          />
          <span className={f.toggleLabel}>{t('featuresAdmin.customerSignupEnabled')}</span>
        </label>
        <p className={f.hint}>{t('featuresAdmin.customerSignupHint')}</p>

        <p className={f.groupLabel}>{t('featuresAdmin.featured')}</p>
        <label className={f.toggle}>
          <input type="checkbox" checked={featuredHome} onChange={(e) => setFeaturedHome(e.target.checked)} />
          <span>{t('featuresAdmin.homeSection')}</span>
        </label>
        <p className={f.groupLabel}>{t('featuresAdmin.newArrivals')}</p>
        <label className={f.toggle}>
          <input type="checkbox" checked={newArrivalHome} onChange={(e) => setNewArrivalHome(e.target.checked)} />
          <span>{t('featuresAdmin.homeSection')}</span>
        </label>
        <label className={f.toggle}>
          <input type="checkbox" checked={newArrivalShop} onChange={(e) => setNewArrivalShop(e.target.checked)} />
          <span>{t('featuresAdmin.shopFilter')}</span>
        </label>
        <p className={f.groupLabel}>{t('featuresAdmin.discounted')}</p>
        <label className={f.toggle}>
          <input type="checkbox" checked={discountedHome} onChange={(e) => setDiscountedHome(e.target.checked)} />
          <span>{t('featuresAdmin.homeSection')}</span>
        </label>
        <label className={f.toggle}>
          <input type="checkbox" checked={discountedShop} onChange={(e) => setDiscountedShop(e.target.checked)} />
          <span>{t('featuresAdmin.shopFilter')}</span>
        </label>
        <p className={f.groupLabel}>{t('featuresAdmin.seasonalBanner')}</p>
        <label className={f.toggle}>
          <input type="checkbox" checked={seasonalBannerEnabled} onChange={(e) => setSeasonalBannerEnabled(e.target.checked)} />
          <span>{t('featuresAdmin.showPromoBanner')}</span>
        </label>
        <p className={f.hint}>
          <Link to="/superadmin/seasonal-sale" className={f.link}>{t('featuresAdmin.configureBanner')}</Link> {t('featuresAdmin.configureBannerHint')}
        </p>
        <p className={f.groupLabel}>{t('featuresAdmin.multiLanguage')}</p>
        <label className={f.toggle}>
          <input type="checkbox" checked={i18nEnabled} onChange={(e) => setI18nEnabled(e.target.checked)} />
          <span>{t('featuresAdmin.i18nHint')}</span>
        </label>
        <p className={f.hint}>
          {t('featuresAdmin.i18nOffHint')}
        </p>
        <p className={f.groupLabel}>{t('featuresAdmin.storeLocator')}</p>
        <label className={f.toggle}>
          <input type="checkbox" checked={storeLocatorEnabled} onChange={(e) => setStoreLocatorEnabled(e.target.checked)} />
          <span>{t('featuresAdmin.storeLocatorHint')}</span>
        </label>
        <p className={f.hint}>
          {t('featuresAdmin.storeLocatorOffHint')}
        </p>
        <p className={f.groupLabel}>{t('featuresAdmin.invoiceSettings')}</p>
        <p className={f.hint}>{t('featuresAdmin.invoiceSettingsHint')}</p>
        <div className={f.whyFields}>
          <label className={f.fieldLabel}>
            {t('featuresAdmin.invoiceCompanyName')}
            <input type="text" className={f.input} value={invoiceCompanyName} onChange={(e) => setInvoiceCompanyName(e.target.value)} placeholder="Blue Mist Perfumes" maxLength={120} />
          </label>
          <label className={f.fieldLabel}>
            {t('featuresAdmin.invoiceStreet')}
            <input type="text" className={f.input} value={invoiceStreet} onChange={(e) => setInvoiceStreet(e.target.value)} placeholder={t('featuresAdmin.invoiceStreetPlaceholder')} maxLength={200} />
          </label>
          <div className={f.row}>
            <label className={f.fieldLabel}>
              {t('featuresAdmin.invoiceCity')}
              <input type="text" className={f.input} value={invoiceCity} onChange={(e) => setInvoiceCity(e.target.value)} maxLength={80} />
            </label>
            <label className={f.fieldLabel}>
              {t('featuresAdmin.invoiceState')}
              <input type="text" className={f.input} value={invoiceState} onChange={(e) => setInvoiceState(e.target.value)} placeholder={t('featuresAdmin.invoiceStatePlaceholder')} maxLength={80} />
            </label>
          </div>
          <div className={f.row}>
            <label className={f.fieldLabel}>
              {t('featuresAdmin.invoiceZip')}
              <input type="text" className={f.input} value={invoiceZip} onChange={(e) => setInvoiceZip(e.target.value)} maxLength={20} />
            </label>
            <label className={f.fieldLabel}>
              {t('featuresAdmin.invoiceCountry')}
              <input type="text" className={f.input} value={invoiceCountry} onChange={(e) => setInvoiceCountry(e.target.value)} placeholder="e.g. UAE" maxLength={80} />
            </label>
          </div>
          <label className={f.fieldLabel}>
            {t('featuresAdmin.invoicePhone')}
            <input type="text" className={f.input} value={invoicePhone} onChange={(e) => setInvoicePhone(e.target.value)} placeholder="+971 ..." maxLength={40} />
          </label>
          <label className={f.fieldLabel}>
            {t('featuresAdmin.invoiceEmail')}
            <input type="email" className={f.input} value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} placeholder="info@example.com" maxLength={120} />
          </label>
          <label className={f.fieldLabel}>
            {t('featuresAdmin.invoiceTrn')}
            <input type="text" className={f.input} value={invoiceTrn} onChange={(e) => setInvoiceTrn(e.target.value)} placeholder={t('featuresAdmin.invoiceTrnPlaceholder')} maxLength={60} />
          </label>
        </div>
        <p className={f.groupLabel}>{t('featuresAdmin.returnsPolicy')}</p>
        <p className={f.hint}>{t('featuresAdmin.returnsPolicyHint')}</p>
        <label className={f.fieldLabel}>
          {t('featuresAdmin.returnDaysAfterDelivery')}
          <input
            type="number"
            min="0"
            className={f.input}
            value={returnDaysAfterDelivery === 0 ? '' : returnDaysAfterDelivery}
            onChange={(e) => setReturnDaysAfterDelivery(Math.max(0, parseInt(e.target.value, 10) || 0))}
            placeholder="0"
          />
        </label>
        <p className={f.groupLabel}>{t('featuresAdmin.socialMedia')}</p>
        <label className={f.toggle}>
          <input type="checkbox" checked={socialEnabled} onChange={(e) => setSocialEnabled(e.target.checked)} />
          <span>{t('featuresAdmin.showSocialLinks')}</span>
        </label>
        <p className={f.hint}>{t('featuresAdmin.socialHint')}</p>
        <div className={f.whyFields}>
          <label className={f.toggle}>
            <input type="checkbox" checked={socialFacebookEnabled} onChange={(e) => setSocialFacebookEnabled(e.target.checked)} />
            <span>{t('featuresAdmin.showFacebook')}</span>
          </label>
          <label className={f.fieldLabel}>
            {t('featuresAdmin.facebookUrl')}
            <input type="url" className={f.input} value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} placeholder="https://facebook.com/..." />
          </label>
          <label className={f.toggle}>
            <input type="checkbox" checked={socialInstagramEnabled} onChange={(e) => setSocialInstagramEnabled(e.target.checked)} />
            <span>{t('featuresAdmin.showInstagram')}</span>
          </label>
          <label className={f.fieldLabel}>
            {t('featuresAdmin.instagramUrl')}
            <input type="url" className={f.input} value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} placeholder="https://instagram.com/..." />
          </label>
          <label className={f.toggle}>
            <input type="checkbox" checked={socialTwitterEnabled} onChange={(e) => setSocialTwitterEnabled(e.target.checked)} />
            <span>{t('featuresAdmin.showTwitter')}</span>
          </label>
          <label className={f.fieldLabel}>
            {t('featuresAdmin.twitterUrl')}
            <input type="url" className={f.input} value={socialTwitter} onChange={(e) => setSocialTwitter(e.target.value)} placeholder="https://x.com/..." />
          </label>
          <label className={f.toggle}>
            <input type="checkbox" checked={socialYoutubeEnabled} onChange={(e) => setSocialYoutubeEnabled(e.target.checked)} />
            <span>{t('featuresAdmin.showYoutube')}</span>
          </label>
          <label className={f.fieldLabel}>
            {t('featuresAdmin.youtubeUrl')}
            <input type="url" className={f.input} value={socialYoutube} onChange={(e) => setSocialYoutube(e.target.value)} placeholder="https://youtube.com/..." />
          </label>
        </div>
        <p className={f.groupLabel}>{t('featuresAdmin.whySection')}</p>
        <label className={f.toggle}>
          <input type="checkbox" checked={whySectionEnabled} onChange={(e) => setWhySectionEnabled(e.target.checked)} />
          <span>{t('featuresAdmin.whySectionLabel')}</span>
        </label>
        <div className={f.whyFields}>
          <label className={f.fieldLabel}>
            {t('featuresAdmin.sectionTitle')}
            <input
              type="text"
              className={f.input}
              value={whySectionTitle}
              onChange={(e) => setWhySectionTitle(e.target.value)}
              placeholder={t('featuresAdmin.sectionTitlePlaceholder')}
              maxLength={120}
            />
          </label>
          <p className={f.fieldLabel}>{t('featuresAdmin.bulletItems')}</p>
          {whySectionItems.map((item, index) => (
            <div key={index} className={f.whyItem}>
              <input
                type="text"
                className={f.input}
                value={item.title}
                onChange={(e) => {
                  const next = [...whySectionItems]
                  next[index] = { ...next[index], title: e.target.value }
                  setWhySectionItems(next)
                }}
                placeholder={t('featuresAdmin.titlePlaceholder')}
                maxLength={100}
              />
              <input
                type="text"
                className={f.input}
                value={item.description}
                onChange={(e) => {
                  const next = [...whySectionItems]
                  next[index] = { ...next[index], description: e.target.value }
                  setWhySectionItems(next)
                }}
                placeholder={t('featuresAdmin.descriptionPlaceholder')}
                maxLength={200}
              />
              <button
                type="button"
                className={f.removeItemBtn}
                onClick={() => setWhySectionItems(whySectionItems.filter((_, i) => i !== index))}
                aria-label={t('featuresAdmin.removeItem')}
              >
                {t('featuresAdmin.removeItem')}
              </button>
            </div>
          ))}
          <button
            type="button"
            className={f.addItemBtn}
            onClick={() => setWhySectionItems([...whySectionItems, { title: '', description: '' }])}
          >
            {t('featuresAdmin.addItem')}
          </button>
        </div>
        <p className={f.hint}>
          {t('featuresAdmin.bulletHint')}
        </p>
        <div className={f.actions}>
          <button type="submit" className={f.saveBtn} disabled={saving}>
            {saving ? t('featuresAdmin.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
