import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { PageSkeletonGrid } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import s from './Admin.module.css'

const LOW_STOCK_THRESHOLD = 10

export default function AdminStock() {
  const { t } = useTranslation()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'low' | 'out'

  useEffect(() => {
    setLoading(true)
    api('/products?limit=500')
      .then((data) => setProducts(data.items || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [])

  const lowCount = products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length
  const outCount = products.filter((p) => p.stock === 0).length

  const filtered =
    filter === 'low'
      ? products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD)
      : filter === 'out'
        ? products.filter((p) => p.stock === 0)
        : products

  const getStockStatus = (stock) => {
    if (stock === 0) return 'out'
    if (stock <= LOW_STOCK_THRESHOLD) return 'low'
    return 'ok'
  }

  if (loading) return <PageSkeletonGrid count={8} />

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <Link to="/admin" className={s.back}>
            ← {t('adminStock.dashboard')}
          </Link>
          <h1 className={s.title}>{t('adminStock.title')}</h1>
          <p className={s.subtitle}>{t('adminStock.subtitle')}</p>
        </div>
      </header>

      <div className={s.stockTabs}>
        <button
          type="button"
          className={filter === 'all' ? s.stockTabActive : s.stockTab}
          onClick={() => setFilter('all')}
        >
          {t('adminStock.all')} ({products.length})
        </button>
        <button
          type="button"
          className={filter === 'low' ? s.stockTabActive : s.stockTab}
          onClick={() => setFilter('low')}
        >
          {t('adminStock.lowStock')} ({lowCount})
        </button>
        <button
          type="button"
          className={filter === 'out' ? s.stockTabActive : s.stockTab}
          onClick={() => setFilter('out')}
        >
          {t('adminStock.outOfStock')} ({outCount})
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('adminStock.noProducts')}
          message={
            filter === 'all'
              ? t('adminStock.emptyMessage')
              : filter === 'low'
                ? t('adminStock.noLowStock')
                : t('adminStock.noOutOfStock')
          }
        />
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('adminStock.image')}</th>
                <th>{t('adminStock.name')}</th>
                <th>{t('adminStock.category')}</th>
                <th>{t('adminStock.stock')}</th>
                <th>{t('adminStock.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const status = getStockStatus(p.stock)
                return (
                  <tr key={p.id || p._id} className={status === 'out' ? s.stockRowOut : status === 'low' ? s.stockRowLow : ''}>
                    <td>
                      <img
                        src={p.imageUrl || 'https://placehold.co/60x60/e2e8f0/94a3b8?text=·'}
                        alt=""
                        className={s.thumb}
                        loading="lazy"
                      />
                    </td>
                    <td>{p.name}</td>
                    <td>{p.category || '—'}</td>
                    <td>{p.stock}</td>
                    <td>
                      <span className={status === 'out' ? s.stockBadgeOut : status === 'low' ? s.stockBadgeLow : s.stockBadgeOk}>
                        {status === 'out' ? t('adminStock.outOfStock') : status === 'low' ? t('adminStock.lowStockLabel') : t('adminStock.inStock')}
                      </span>
                    </td>
                    <td>
                      <Link to="/admin/products" className={s.smBtn} style={{ textDecoration: 'none' }}>
                        {t('adminStock.editProduct')}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
