import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BackButton } from '../../components/BackButton'
import s from './SuperAdmin.module.css'

export default function SuperAdmin() {
  const { t } = useTranslation()
  return (
    <div className={s.page}>
      <BackButton to="/" label={t('nav.home')} />
      <h1 className={s.title}>{t('superadmin.title')}</h1>
      <p className={s.subtitle}>{t('superadmin.subtitle')}</p>
      <div className={s.grid}>
        <Link to="/superadmin/analytics" className={s.card}>
          <h3>{t('superadmin.analytics')}</h3>
          <p>{t('superadmin.analyticsDesc')}</p>
        </Link>
        <Link to="/admin/products" className={s.card}>
          <h3>{t('superadmin.products')}</h3>
          <p>{t('superadmin.productsDesc')}</p>
        </Link>
        <Link to="/admin/categories" className={s.card}>
          <h3>{t('superadmin.categories')}</h3>
          <p>{t('superadmin.categoriesDesc')}</p>
        </Link>
        <Link to="/superadmin/features" className={s.card}>
          <h3>{t('superadmin.features')}</h3>
          <p>{t('superadmin.featuresDesc')}</p>
        </Link>
        <Link to="/superadmin/order-fee" className={s.card}>
          <h3>{t('superadmin.orderFee', 'Order fee / Shipping')}</h3>
          <p>{t('superadmin.orderFeeDesc', 'Configure shipping charge above threshold, fixed or %')}</p>
        </Link>
        <Link to="/superadmin/seasonal-sale" className={s.card}>
          <h3>{t('superadmin.seasonalSale')}</h3>
          <p>{t('superadmin.seasonalSaleDesc')}</p>
        </Link>
        <Link to="/superadmin/users" className={s.card}>
          <h3>{t('superadmin.userManagement')}</h3>
          <p>{t('superadmin.userManagementDesc')}</p>
        </Link>
        <Link to="/superadmin/investigate" className={s.card}>
          <h3>{t('superadmin.investigate')}</h3>
          <p>{t('superadmin.investigateDesc')}</p>
        </Link>
        <Link to="/superadmin/store-locations" className={s.card}>
          <h3>{t('superadmin.storeLocations')}</h3>
          <p>{t('superadmin.storeLocationsDesc')}</p>
        </Link>
      </div>
    </div>
  )
}
