import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useFeatures } from '../context/FeaturesContext'
import s from './Navbar.module.css'

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()
  const { count: cartCount } = useCart()
  const { i18nEnabled, storeLocatorEnabled } = useFeatures()
  const locale = i18n.language
  const setLocale = (lng) => i18n.changeLanguage(lng === 'ar' ? 'ar' : 'en')
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  // When admin turns off multi-language, force English and LTR
  useEffect(() => {
    if (!i18nEnabled && locale !== 'en') {
      i18n.changeLanguage('en')
    }
  }, [i18nEnabled, locale, i18n])

  const handleLogout = () => {
    logout()
    navigate('/')
    setMenuOpen(false)
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <nav className={s.nav}>
      <div className={s.container}>
        <Link to="/" className={s.logo} onClick={closeMenu}>
          <img src="/images/logo.png" alt={t('common.brandName')} className={s.logoImg} />
          <span className={s.logoText}>{t('common.brandName')}</span>
        </Link>
        {i18nEnabled && (
          <div className={s.langSwitcher}>
            <button
              type="button"
              className={locale === 'en' ? s.langActive : s.langBtn}
              onClick={() => setLocale('en')}
              aria-label={t('lang.en')}
            >
              EN
            </button>
            <span className={s.langSep}>|</span>
            <button
              type="button"
              className={locale === 'ar' ? s.langActive : s.langBtn}
              onClick={() => setLocale('ar')}
              aria-label={t('lang.ar')}
            >
              عربي
            </button>
          </div>
        )}
        <button
          className={s.menuBtn}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          aria-expanded={menuOpen}
        >
          <span className={s.menuIcon} data-open={menuOpen} />
          <span className={s.menuIcon} data-open={menuOpen} />
          <span className={s.menuIcon} data-open={menuOpen} />
        </button>
        <div className={`${s.links} ${menuOpen ? s.linksOpen : ''}`}>
          <Link to="/" className={s.link} onClick={closeMenu}>
            {t('nav.home')}
          </Link>
          <Link to="/shop" className={s.link} onClick={closeMenu}>
            {(user?.role === 'admin' || user?.role === 'super_admin') ? t('nav.viewProducts') : t('nav.shop')}
          </Link>
          {storeLocatorEnabled && (
            <Link to="/store-locator" className={s.link} onClick={closeMenu}>
              {t('nav.storeLocator')}
            </Link>
          )}
          {user ? (
            <>
              {user.role === 'customer' && (
                <>
                  <Link to="/cart" className={s.link} onClick={closeMenu}>
                    {t('nav.cart')}{cartCount ? ` (${cartCount})` : ''}
                  </Link>
                  <Link to="/orders" className={s.link} onClick={closeMenu}>
                    {t('nav.orders')}
                  </Link>
                </>
              )}
              {user.role === 'admin' && (
                <Link to="/admin" className={s.link} onClick={closeMenu}>
                  {t('nav.admin')}
                </Link>
              )}
              {user.role === 'super_admin' && (
                <Link to="/superadmin" className={s.link} onClick={closeMenu}>
                  {t('nav.superAdmin')}
                </Link>
              )}
              <Link to="/profile" className={s.userLink} onClick={closeMenu}>
                {user.profileUrl ? (
                  <img src={user.profileUrl} alt="" className={s.avatar} />
                ) : (
                  <div className={s.avatarPlaceholder}>{user.firstName[0]}</div>
                )}
                <span className={s.userName}>{user.firstName}</span>
              </Link>
              <button onClick={handleLogout} className={s.logoutBtn}>
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={s.link} onClick={closeMenu}>
                {t('nav.login')}
              </Link>
              <Link to="/register" className={s.signUpBtn} onClick={closeMenu}>
                {t('nav.signUp')}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
