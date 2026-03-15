import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from './Navbar'
import Footer from './Footer'
import s from './Layout.module.css'

export default function Layout() {
  const { t } = useTranslation()
  return (
    <div className="layout">
      <a href="#main-content" className={s.skipLink}>{t('common.skipToContent')}</a>
      <Navbar />
      <main id="main-content" className="layoutMain" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
