import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BackButton } from '../../components/BackButton'
import { api } from '../../api/client'
import s from './Admin.module.css'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ pendingOrdersCount: 0, unreadReviewsCount: 0 })

  useEffect(() => {
    api('/admin/stats')
      .then((data) => setStats({
        pendingOrdersCount: data.pendingOrdersCount ?? 0,
        unreadReviewsCount: data.unreadReviewsCount ?? 0,
      }))
      .catch(() => {})
  }, [])

  return (
    <div className={s.page}>
      <BackButton to="/" label="Home" />
      <h1 className={s.title}>Admin Dashboard</h1>
      <p className={s.subtitle}>View orders, create products</p>
      <div className={s.grid}>
        <Link to="/admin/products" className={s.card}>
          <h3>Products</h3>
          <p>Add new products</p>
        </Link>
        <Link to="/admin/orders" className={s.card}>
          <h3>
            Orders
            {stats.pendingOrdersCount > 0 && (
              <span className={s.cardBadge} aria-label={`${stats.pendingOrdersCount} pending`}>
                {stats.pendingOrdersCount}
              </span>
            )}
          </h3>
          <p>View all orders</p>
        </Link>
        <Link to="/admin/reviews" className={s.card}>
          <h3>
            Reviews
            {stats.unreadReviewsCount > 0 && (
              <span className={s.cardBadge} aria-label={`${stats.unreadReviewsCount} new`}>
                {stats.unreadReviewsCount}
              </span>
            )}
          </h3>
          <p>Newly added reviews</p>
        </Link>
        <Link to="/admin/categories" className={s.card}>
          <h3>Categories</h3>
          <p>Create and manage product categories</p>
        </Link>
        <Link to="/admin/stock" className={s.card}>
          <h3>Stock</h3>
          <p>View inventory levels and low-stock warnings</p>
        </Link>
        <Link to="/admin/return-requests" className={s.card}>
          <h3>Return requests</h3>
          <p>Accept or reject customer return requests</p>
        </Link>
      </div>
    </div>
  )
}
