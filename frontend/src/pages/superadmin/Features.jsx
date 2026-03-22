import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, uploadFile, getMediaUrl } from '../../api/client'
import s from './SuperAdmin.module.css'
import f from './Features.module.css'
import { Toast } from '../../components/Toast'

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
  const [personalizationEnabled, setPersonalizationEnabled] = useState(false)
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
  const [telegramEnabled, setTelegramEnabled] = useState(false)
  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
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
  const [categorySectionTitle, setCategorySectionTitle] = useState('Shop by Collection')
  const [categorySectionLabel, setCategorySectionLabel] = useState('Discover Your Scent')
  const [heroSubtitleEn, setHeroSubtitleEn] = useState('')
  const [heroSubtitleAr, setHeroSubtitleAr] = useState('')
  const [heroTitleEn, setHeroTitleEn] = useState('')
  const [heroTitleAr, setHeroTitleAr] = useState('')
  const [heroDescriptionEn, setHeroDescriptionEn] = useState('')
  const [heroDescriptionAr, setHeroDescriptionAr] = useState('')
  const [heroButtonTextEn, setHeroButtonTextEn] = useState('')
  const [heroButtonTextAr, setHeroButtonTextAr] = useState('')
  const [heroImages, setHeroImages] = useState([])
  const [categorySectionEnabled, setCategorySectionEnabled] = useState(true)
  const [marqueeSectionEnabled, setMarqueeSectionEnabled] = useState(true)
  const [marqueeItemsEn, setMarqueeItemsEn] = useState([])
  const [marqueeItemsAr, setMarqueeItemsAr] = useState([])
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
        setPersonalizationEnabled(data.personalization_enabled === true)
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
        setTelegramEnabled(data.telegram_enabled === true)
        setTelegramBotToken(data.telegram_bot_token ?? '')
        setTelegramChatId(data.telegram_chat_id ?? '')
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
        setCategorySectionTitle(data.category_section_title ?? 'Shop by Collection')
        setCategorySectionLabel(data.category_section_label ?? 'Discover Your Scent')
        setHeroSubtitleEn(data.hero_subtitle_en ?? '')
        setHeroSubtitleAr(data.hero_subtitle_ar ?? '')
        setHeroTitleEn(data.hero_title_en ?? '')
        setHeroTitleAr(data.hero_title_ar ?? '')
        setHeroDescriptionEn(data.hero_description_en ?? '')
        setHeroDescriptionAr(data.hero_description_ar ?? '')
        setHeroButtonTextEn(data.hero_button_text_en ?? '')
        setHeroButtonTextAr(data.hero_button_text_ar ?? '')
        setHeroImages(Array.isArray(data.hero_images) && data.hero_images.length > 0 ? data.hero_images : ['/images/premium-hero.png'])
        setCategorySectionEnabled(data.category_section_enabled !== false)
        setMarqueeSectionEnabled(data.marquee_section_enabled !== false)
        setMarqueeItemsEn(Array.isArray(data.marquee_items_en) ? data.marquee_items_en : [])
        setMarqueeItemsAr(Array.isArray(data.marquee_items_ar) ? data.marquee_items_ar : [])
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
          personalization_enabled: personalizationEnabled,
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
          telegram_enabled: telegramEnabled,
          telegram_bot_token: telegramBotToken.trim() || undefined,
          telegram_chat_id: telegramChatId.trim() || undefined,
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
          category_section_title: categorySectionTitle.trim() || 'Shop by Collection',
          category_section_label: categorySectionLabel.trim() || 'Discover Your Scent',
          hero_subtitle_en: heroSubtitleEn.trim() || undefined,
          hero_subtitle_ar: heroSubtitleAr.trim() || undefined,
          hero_title_en: heroTitleEn.trim() || undefined,
          hero_title_ar: heroTitleAr.trim() || undefined,
          hero_description_en: heroDescriptionEn.trim() || undefined,
          hero_description_ar: heroDescriptionAr.trim() || undefined,
          hero_button_text_en: heroButtonTextEn.trim() || undefined,
          hero_button_text_ar: heroButtonTextAr.trim() || undefined,
          hero_images: heroImages.filter(img => img.trim()),
          category_section_enabled: categorySectionEnabled,
          marquee_section_enabled: marqueeSectionEnabled,
          marquee_items_en: marqueeItemsEn.filter(it => it.trim()),
          marquee_items_ar: marqueeItemsAr.filter(it => it.trim()),
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
      <Toast
        visible={!!message}
        message={message || ''}
        onClose={() => setMessage(null)}
      />
      <header className={s.header}>
        <div className={s.headerLeft}>
          <Link to="/superadmin" className={s.back}>← {t('featuresAdmin.back')}</Link>
          <h1 className={s.title}>{t('featuresAdmin.title')}</h1>
          <p className={s.subtitle}>{t('featuresAdmin.subtitle')}</p>
        </div>
        <div className={s.headerActions}>
          <button type="submit" form="features-form" className={f.saveBtn} disabled={saving}>
            {saving ? t('featuresAdmin.saving') : t('common.save')}
          </button>
        </div>
      </header>

      <form id="features-form" onSubmit={handleSave} className={f.formContainer}>
        {error && <p className={f.error}>{error}</p>}

        <div className={f.grid}>
          {/* General Configuration */}
          <section className={f.card}>
            <h2 className={f.cardTitle}>General Configuration</h2>
            <div className={f.cardBody}>
              <label className={f.toggle}>
                <input type="checkbox" checked={signupEnabled} onChange={(e) => setSignupEnabled(e.target.checked)} />
                <span className={f.toggleLabel}>{t('featuresAdmin.customerSignupEnabled')}</span>
              </label>
              <p className={f.hint}>{t('featuresAdmin.customerSignupHint')}</p>

              <label className={f.toggle}>
                <input type="checkbox" checked={i18nEnabled} onChange={(e) => setI18nEnabled(e.target.checked)} />
                <span>{t('featuresAdmin.i18nHint')}</span>
              </label>
              <p className={f.hint}>{t('featuresAdmin.i18nOffHint')}</p>

              <label className={f.toggle}>
                <input type="checkbox" checked={storeLocatorEnabled} onChange={(e) => setStoreLocatorEnabled(e.target.checked)} />
                <span>{t('featuresAdmin.storeLocatorHint')}</span>
              </label>
              <p className={f.hint}>{t('featuresAdmin.storeLocatorOffHint')}</p>

              <div className={f.divider} style={{ margin: '1rem 0' }} />

              <label className={f.toggle}>
                <input type="checkbox" checked={personalizationEnabled} onChange={(e) => setPersonalizationEnabled(e.target.checked)} />
                <span className={f.toggleLabel}>{t('featuresAdmin.personalizationEnabled') || 'Product Personalization'}</span>
              </label>
              <p className={f.hint}>{t('featuresAdmin.personalizationHint') || 'Allow customers to add custom engraving to products'}</p>
            </div>
          </section>

          {/* Home Page Sections */}
          <section className={f.card}>
            <h2 className={f.cardTitle}>Home Page Visibility</h2>
            <div className={f.cardBody}>
              <div className={f.visibilityGroup}>
                <label className={f.toggle}>
                  <input type="checkbox" checked={featuredHome} onChange={(e) => setFeaturedHome(e.target.checked)} />
                  <span>{t('featuresAdmin.featured')} - {t('featuresAdmin.homeSection')}</span>
                </label>
                <label className={f.toggle}>
                  <input type="checkbox" checked={newArrivalHome} onChange={(e) => setNewArrivalHome(e.target.checked)} />
                  <span>{t('featuresAdmin.newArrivals')} - {t('featuresAdmin.homeSection')}</span>
                </label>
                <label className={f.toggle}>
                  <input type="checkbox" checked={newArrivalShop} onChange={(e) => setNewArrivalShop(e.target.checked)} />
                  <span>{t('featuresAdmin.newArrivals')} - {t('featuresAdmin.shopFilter')}</span>
                </label>
                <label className={f.toggle}>
                  <input type="checkbox" checked={discountedHome} onChange={(e) => setDiscountedHome(e.target.checked)} />
                  <span>{t('featuresAdmin.discounted')} - {t('featuresAdmin.homeSection')}</span>
                </label>
                <label className={f.toggle}>
                  <input type="checkbox" checked={discountedShop} onChange={(e) => setDiscountedShop(e.target.checked)} />
                  <span>{t('featuresAdmin.discounted')} - {t('featuresAdmin.shopFilter')}</span>
                </label>
                <label className={f.toggle}>
                  <input type="checkbox" checked={seasonalBannerEnabled} onChange={(e) => setSeasonalBannerEnabled(e.target.checked)} />
                  <span>{t('featuresAdmin.seasonalBanner')}</span>
                </label>
              </div>
              <p className={f.hint}>
                <Link to="/superadmin/seasonal-sale" className={f.link}>{t('featuresAdmin.configureBanner')}</Link>
              </p>
            </div>
          </section>

          {/* Hero Section */}
          <section className={`${f.card} ${f.cardWide}`}>
            <h2 className={f.cardTitle}>{t('featuresAdmin.heroSection')}</h2>
            <div className={f.cardBody}>
              <div className={f.formGrid}>
                <div className={f.row}>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.heroSubtitle')} (EN)
                    <input type="text" className={f.input} value={heroSubtitleEn} onChange={(e) => setHeroSubtitleEn(e.target.value)} placeholder="e.g. Signature Egyptian Collection" />
                  </label>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.heroSubtitle')} (AR)
                    <input type="text" className={f.input} value={heroSubtitleAr} onChange={(e) => setHeroSubtitleAr(e.target.value)} dir="rtl" placeholder="مثلاً: مجموعة توقيع مصرية" />
                  </label>
                </div>
                <div className={f.row}>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.heroTitle')} (EN)
                    <input type="text" className={f.input} value={heroTitleEn} onChange={(e) => setHeroTitleEn(e.target.value)} placeholder="e.g. BLUE MIST PERFUMES" />
                  </label>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.heroTitle')} (AR)
                    <input type="text" className={f.input} value={heroTitleAr} onChange={(e) => setHeroTitleAr(e.target.value)} dir="rtl" placeholder="مثلاً: بلو ميست للعطور" />
                  </label>
                </div>
                <div className={f.row}>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.heroDescription')} (EN)
                    <textarea className={f.input} value={heroDescriptionEn} onChange={(e) => setHeroDescriptionEn(e.target.value)} rows={2} placeholder="e.g. Discover our exquisite range of scents..." />
                  </label>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.heroDescription')} (AR)
                    <textarea className={f.input} value={heroDescriptionAr} onChange={(e) => setHeroDescriptionAr(e.target.value)} rows={2} dir="rtl" placeholder="مثلاً: اكتشف مجموعتنا الرائعة من الروائح..." />
                  </label>
                </div>
                <div className={f.row}>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.heroButtonText')} (EN)
                    <input type="text" className={f.input} value={heroButtonTextEn} onChange={(e) => setHeroButtonTextEn(e.target.value)} placeholder="e.g. Explore Collection" />
                  </label>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.heroButtonText')} (AR)
                    <input type="text" className={f.input} value={heroButtonTextAr} onChange={(e) => setHeroButtonTextAr(e.target.value)} dir="rtl" placeholder="مثلاً: استكشف المجموعة" />
                  </label>
                </div>
              </div>

              <div className={f.heroImagesSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p className={f.subLabel}>{t('featuresAdmin.heroImages')}</p>
                  <span className={f.hint} style={{ margin: 0 }}>
                    Preferred: 1920×1080 (Landscape) or 1080×1920 (Portrait). Supports .mp4 videos.
                  </span>
                </div>
                <div className={f.heroImagesList}>
                  {heroImages.map((img, idx) => (
                    <div key={idx} className={f.heroImageRow}>
                      <div className={f.imageInputWrap}>
                        <input
                          type="text"
                          className={f.input}
                          value={img}
                          onChange={(e) => {
                            const next = [...heroImages]
                            next[idx] = e.target.value
                            setHeroImages(next)
                          }}
                          placeholder="Image URL"
                        />
                        {img && <img src={getMediaUrl(img)} alt="" className={f.inputPreview} />}
                      </div>
                      <input
                        type="file"
                        id={`hero-upload-${idx}`}
                        hidden
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          try {
                            setSaving(true)
                            const url = await uploadFile(file)
                            const next = [...heroImages]
                            next[idx] = url
                            setHeroImages(next)
                          } catch (err) {
                            setError(err.message)
                          } finally {
                            setSaving(false)
                          }
                        }}
                      />
                      <button type="button" className={f.smBtn} onClick={() => document.getElementById(`hero-upload-${idx}`).click()}>
                        {t('adminProducts.upload')}
                      </button>
                      <button type="button" className={f.smBtnDanger} onClick={() => setHeroImages(heroImages.filter((_, i) => i !== idx))}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <button type="button" className={f.addItemBtn} onClick={() => setHeroImages([...heroImages, ''])}>
                    + {t('featuresAdmin.addImage')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Categories & Why */}
          <section className={f.card}>
            <h2 className={f.cardTitle}>Promotional Sections</h2>
            <div className={f.cardBody}>
              <p className={f.subLabel}>Category Section (Shop by Collection)</p>
              <label className={f.fieldLabel}>Section Title</label>
              <input type="text" className={f.input} value={categorySectionTitle} onChange={(e) => setCategorySectionTitle(e.target.value)} placeholder="e.g. Shop by Collection" />
              <label className={f.fieldLabel}>Section Label</label>
              <input type="text" className={f.input} value={categorySectionLabel} onChange={(e) => setCategorySectionLabel(e.target.value)} placeholder="e.g. Discover Your Scent" />
              <label className={f.toggle} style={{ marginTop: '0.5rem' }}>
                <input type="checkbox" checked={categorySectionEnabled} onChange={(e) => setCategorySectionEnabled(e.target.checked)} />
                <span className={f.toggleLabel}>Enable Section</span>
              </label>

              <div className={f.divider} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className={f.subLabel} style={{ margin: 0 }}>Marquee Banner (Running Banner)</p>
                <label className={f.toggle}>
                  <input type="checkbox" checked={marqueeSectionEnabled} onChange={(e) => setMarqueeSectionEnabled(e.target.checked)} />
                  <span>Enable</span>
                </label>
              </div>

              {marqueeSectionEnabled && (
                <div className={f.whyEditor}>
                  <p className={f.hint} style={{ marginBottom: '1rem' }}>Suggest: 'Long Lasting', 'Premium Quality', 'UAE Crafted', 'Authentic Oud', 'Free Shipping AED 200+'</p>

                  <div className={f.row}>
                    <div style={{ flex: 1 }}>
                      <p className={f.fieldLabel}>Items (EN)</p>
                      {marqueeItemsEn.map((it, idx) => (
                        <div key={idx} className={f.heroImageRow} style={{ marginBottom: '0.5rem' }}>
                          <input type="text" className={f.input} value={it} onChange={(e) => {
                            const next = [...marqueeItemsEn]
                            next[idx] = e.target.value
                            setMarqueeItemsEn(next)
                          }} placeholder="e.g. Premium Quality" />
                          <button type="button" className={f.smBtnDanger} onClick={() => setMarqueeItemsEn(marqueeItemsEn.filter((_, i) => i !== idx))}>✕</button>
                        </div>
                      ))}
                      <button type="button" className={f.addItemBtn} onClick={() => setMarqueeItemsEn([...marqueeItemsEn, ''])}>+ Add Item (EN)</button>
                    </div>

                    <div style={{ flex: 1 }}>
                      <p className={f.fieldLabel}>Items (AR)</p>
                      {marqueeItemsAr.map((it, idx) => (
                        <div key={idx} className={f.heroImageRow} style={{ marginBottom: '0.5rem' }}>
                          <input type="text" className={f.input} value={it} dir="rtl" onChange={(e) => {
                            const next = [...marqueeItemsAr]
                            next[idx] = e.target.value
                            setMarqueeItemsAr(next)
                          }} placeholder="مثلاً: جودة ممتازة" />
                          <button type="button" className={f.smBtnDanger} onClick={() => setMarqueeItemsAr(marqueeItemsAr.filter((_, i) => i !== idx))}>✕</button>
                        </div>
                      ))}
                      <button type="button" className={f.addItemBtn} onClick={() => setMarqueeItemsAr([...marqueeItemsAr, ''])}>+ Add Item (AR)</button>
                    </div>
                  </div>
                </div>
              )}

              <div className={f.divider} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className={f.subLabel} style={{ margin: 0 }}>{t('featuresAdmin.whySection')}</p>
                <label className={f.toggle}>
                  <input type="checkbox" checked={whySectionEnabled} onChange={(e) => setWhySectionEnabled(e.target.checked)} />
                  <span>Enable</span>
                </label>
              </div>

              {whySectionEnabled && (
                <div className={f.whyEditor}>
                  <label className={f.fieldLabel}>{t('featuresAdmin.sectionTitle')}</label>
                  <input type="text" className={f.input} value={whySectionTitle} onChange={(e) => setWhySectionTitle(e.target.value)} placeholder="e.g. Why Blue Mist?" />
                  <p className={f.fieldLabel}>{t('featuresAdmin.bulletItems')}</p>
                  {whySectionItems.map((item, index) => (
                    <div key={index} className={f.whyItemCard}>
                      <input type="text" className={f.input} value={item.title} onChange={(e) => {
                        const next = [...whySectionItems]
                        next[index] = { ...next[index], title: e.target.value }
                        setWhySectionItems(next)
                      }} placeholder="Item Title (e.g. Pure Essence)" />
                      <textarea className={f.input} value={item.description} onChange={(e) => {
                        const next = [...whySectionItems]
                        next[index] = { ...next[index], description: e.target.value }
                        setWhySectionItems(next)
                      }} placeholder="Item Description (e.g. We use the finest ingredients...)" rows={2} />
                      <button type="button" className={f.smBtnDanger} onClick={() => setWhySectionItems(whySectionItems.filter((_, i) => i !== index))}>
                        {t('featuresAdmin.removeItem')}
                      </button>
                    </div>
                  ))}
                  <button type="button" className={f.addItemBtn} onClick={() => setWhySectionItems([...whySectionItems, { title: '', description: '' }])}>
                    {t('featuresAdmin.addItem')}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Social Media */}
          <section className={f.card}>
            <h2 className={f.cardTitle}>{t('featuresAdmin.socialMedia')}</h2>
            <div className={f.cardBody}>
              <label className={f.toggle}>
                <input type="checkbox" checked={socialEnabled} onChange={(e) => setSocialEnabled(e.target.checked)} />
                <span>{t('featuresAdmin.showSocialLinks')}</span>
              </label>

              {socialEnabled && (
                <div className={f.socialGroup}>
                  {['Instagram', 'Facebook', 'Twitter', 'Youtube'].map(platform => {
                    const low = platform.toLowerCase()
                    const stateVal = low === 'instagram' ? socialInstagram : (low === 'facebook' ? socialFacebook : (low === 'twitter' ? socialTwitter : socialYoutube))
                    const setVal = low === 'instagram' ? setSocialInstagram : (low === 'facebook' ? setSocialFacebook : (low === 'twitter' ? setSocialTwitter : setSocialYoutube))
                    const stateEna = low === 'instagram' ? socialInstagramEnabled : (low === 'facebook' ? socialFacebookEnabled : (low === 'twitter' ? socialTwitterEnabled : socialYoutubeEnabled))
                    const setEna = low === 'instagram' ? setSocialInstagramEnabled : (low === 'facebook' ? setSocialFacebookEnabled : (low === 'twitter' ? setSocialTwitterEnabled : setSocialYoutubeEnabled))

                    return (
                      <div key={platform} className={f.socialRow}>
                        <label className={f.toggle} style={{ marginBottom: 0 }}>
                          <input type="checkbox" checked={stateEna} onChange={(e) => setEna(e.target.checked)} />
                          <span>{platform}</span>
                        </label>
                        <input type="url" className={f.input} value={stateVal} onChange={(e) => setVal(e.target.value)} disabled={!stateEna} placeholder={`https://${low}.com/...`} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Invoicing & Returns */}
          <section className={`${f.card} ${f.cardWide}`}>
            <h2 className={f.cardTitle}>{t('featuresAdmin.invoiceSettings')}</h2>
            <div className={f.cardBody}>
              <div className={f.formGrid}>
                <div className={f.row}>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.invoiceCompanyName')}
                    <input type="text" className={f.input} value={invoiceCompanyName} onChange={(e) => setInvoiceCompanyName(e.target.value)} placeholder="e.g. Blue Mist Perfumes" />
                  </label>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.invoiceEmail')}
                    <input type="email" className={f.input} value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} placeholder="e.g. info@bluemist.com" />
                  </label>
                </div>
                <div className={f.row}>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.invoiceStreet')}
                    <input type="text" className={f.input} value={invoiceStreet} onChange={(e) => setInvoiceStreet(e.target.value)} placeholder="e.g. 123 Luxury Ave" />
                  </label>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.invoicePhone')}
                    <input type="text" className={f.input} value={invoicePhone} onChange={(e) => setInvoicePhone(e.target.value)} placeholder="e.g. +971 50 123 4567" />
                  </label>
                </div>
                <div className={f.row}>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.invoiceCity')}
                    <input type="text" className={f.input} value={invoiceCity} onChange={(e) => setInvoiceCity(e.target.value)} placeholder="e.g. Dubai" />
                  </label>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.invoiceState')}
                    <input type="text" className={f.input} value={invoiceState} onChange={(e) => setInvoiceState(e.target.value)} placeholder="e.g. Dubai" />
                  </label>
                </div>
                <div className={f.row}>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.invoiceZip')}
                    <input type="text" className={f.input} value={invoiceZip} onChange={(e) => setInvoiceZip(e.target.value)} placeholder="e.g. 00000" />
                  </label>
                  <label className={f.fieldLabel}>
                    {t('featuresAdmin.invoiceTrn')}
                    <input type="text" className={f.input} value={invoiceTrn} onChange={(e) => setInvoiceTrn(e.target.value)} placeholder="e.g. 100XXXXXXXXXXXX" />
                  </label>
                </div>
              </div>
              <div className={f.divider} />
              <label className={f.fieldLabel}>
                {t('featuresAdmin.returnDaysAfterDelivery')}
                <input
                  type="number"
                  min="0"
                  className={f.input}
                  style={{ maxWidth: '120px' }}
                  value={returnDaysAfterDelivery === 0 ? '' : returnDaysAfterDelivery}
                  onChange={(e) => setReturnDaysAfterDelivery(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="e.g. 7"
                />
              </label>
            </div>
          </section>

          {/* Admin Tools */}
          <section className={f.card}>
            <h2 className={f.cardTitle}>{t('featuresAdmin.telegramBot')}</h2>
            <div className={f.cardBody}>
              <label className={f.toggle}>
                <input type="checkbox" checked={telegramEnabled} onChange={(e) => setTelegramEnabled(e.target.checked)} />
                <span>{t('featuresAdmin.telegramBotEnabled')}</span>
              </label>
              <p className={f.hint}>{t('featuresAdmin.telegramHint')}</p>
              <label className={f.fieldLabel}>{t('featuresAdmin.telegramBotToken')}</label>
              <input type="password" className={f.input} value={telegramBotToken} onChange={(e) => setTelegramBotToken(e.target.value)} placeholder="Bot Token from @BotFather" />
              <label className={f.fieldLabel}>{t('featuresAdmin.telegramChatId')}</label>
              <input type="text" className={f.input} value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} placeholder="Chat ID for notifications" />
            </div>
          </section>
        </div>

        <div className={f.stickyFooter}>
          <button type="submit" className={f.saveBtn} disabled={saving}>
            {saving ? t('featuresAdmin.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
