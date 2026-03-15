import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  ComposedChart,
} from 'recharts'
import { api } from '../../api/client'
import { formatPrice } from '../../utils/currency'
import { BackButton } from '../../components/BackButton'
import { PageSkeleton } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import s from './Analytics.module.css'

const PERIODS = [
  { key: 'day', label: 'Daily (last 30 days)' },
  { key: 'month', label: 'Monthly (last 12 months)' },
  { key: 'year', label: 'Yearly (last 5 years)' },
]

export default function Analytics() {
  const [period, setPeriod] = useState('month')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api(`/analytics/sales?period=${period}&top=10`)
      .then(setData)
      .catch((err) => setError(err?.message || 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [period])

  if (loading && !data) return <PageSkeleton />
  if (error) {
    return (
      <div className={s.page}>
        <BackButton to="/superadmin" label="Super Admin" />
        <EmptyState
          title="Unable to load analytics"
          message={error}
          actionLabel="Retry"
          onAction={() => {
            setError(null)
            setLoading(true)
            api(`/analytics/sales?period=${period}&top=10`)
              .then(setData)
              .catch((err) => setError(err?.message || 'Failed to load analytics'))
              .finally(() => setLoading(false))
          }}
        />
      </div>
    )
  }

  const summary = data?.summary || {}
  const salesOverTime = data?.salesOverTime || []
  const topProducts = data?.topProducts || []
  const fromLabel = data?.from ? new Date(data.from).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''
  const toLabel = data?.to ? new Date(data.to).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''

  return (
    <div className={s.page}>
      <BackButton to="/superadmin" label="Super Admin" />
      <div className={s.header}>
        <h1 className={s.title}>Sales Analytics</h1>
        <p className={s.subtitle}>Revenue (net of refunds), orders, and top products</p>
      </div>

      <div className={s.periodTabs}>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`${s.tab} ${period === p.key ? s.tabActive : ''}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className={s.rangeLabel}>
        {fromLabel} – {toLabel}
      </p>

      <div className={s.summaryGrid}>
        <div className={s.summaryCard}>
          <span className={s.summaryLabel}>Total Revenue (net of refunds)</span>
          <span className={s.summaryValue}>{formatPrice(summary.totalRevenue)}</span>
        </div>
        <div className={s.summaryCard}>
          <span className={s.summaryLabel}>Orders</span>
          <span className={s.summaryValue}>{summary.orderCount ?? 0}</span>
        </div>
      </div>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Sales Over Time</h2>
        <p className={s.sectionHint}>Revenue (AED) — line chart. Orders — bar chart.</p>
        {salesOverTime.length === 0 ? (
          <p className={s.emptyChart}>No sales in this period.</p>
        ) : (
          <div className={s.chartWrap}>
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={salesOverTime} margin={{ top: 16, right: 56, left: 56, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.6} vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: 'var(--color-text)', fontSize: 13, fontWeight: 500 }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                  label={{ value: 'Period', position: 'insideBottom', offset: -8, fill: 'var(--color-text-muted)', fontSize: 12 }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: 'var(--color-text)', fontSize: 13 }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                  label={{ value: 'Revenue (AED)', angle: -90, position: 'insideLeft', fill: 'var(--color-accent)', fontSize: 12, fontWeight: 600 }}
                  width={48}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: 'var(--color-text)', fontSize: 13 }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                  label={{ value: 'Orders', angle: 90, position: 'insideRight', fill: 'var(--color-success)', fontSize: 12, fontWeight: 600 }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '2px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '12px 16px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                  labelStyle={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: 6 }}
                  formatter={(value, name) => [name === 'Revenue' ? formatPrice(value) : value, name === 'Revenue' ? 'Revenue' : 'Orders']}
                  labelFormatter={(label) => `Period: ${label}`}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
                />
                <Legend wrapperStyle={{ paddingTop: 16 }} iconSize={14} iconType="square" />
                <Line yAxisId="left" type="monotone" dataKey="total" name="Revenue" stroke="var(--color-accent)" strokeWidth={3} dot={{ fill: 'var(--color-accent)', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, stroke: 'var(--color-surface)', strokeWidth: 2 }} />
                <Bar yAxisId="right" dataKey="orderCount" name="Orders" fill="var(--color-success)" fillOpacity={0.85} stroke="var(--color-success)" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={28} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Top Products by Revenue</h2>
        {topProducts.length === 0 ? (
          <p className={s.emptyChart}>No product sales in this period.</p>
        ) : (
          <div className={s.chartWrap}>
            <ResponsiveContainer width="100%" height={Math.max(320, topProducts.length * 52)}>
              <BarChart
                data={topProducts}
                layout="vertical"
                margin={{ top: 16, right: 32, left: 8, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} opacity={0.6} />
                <XAxis
                  type="number"
                  tick={{ fill: 'var(--color-text)', fontSize: 13 }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `AED ${(v / 1000).toFixed(1)}k` : `AED ${v}`)}
                  label={{ value: 'Revenue (AED)', position: 'insideBottom', offset: -8, fill: 'var(--color-text-muted)', fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="productName"
                  width={200}
                  tick={{ fill: 'var(--color-text)', fontSize: 13, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '2px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '12px 16px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload
                    return (
                      <div className={s.tooltipBox}>
                        <div className={s.tooltipTitle}>{p.productName}</div>
                        <div className={s.tooltipRow}>Revenue: <strong>{formatPrice(p.revenue)}</strong></div>
                        <div className={s.tooltipRow}>Units sold: <strong>{p.quantity}</strong></div>
                      </div>
                    )
                  }}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
                />
                <Bar dataKey="revenue" name="Revenue" fill="var(--color-accent)" radius={[0, 4, 4, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <p className={s.footerNote}>
        <Link to="/admin/orders" className={s.link}>View all orders</Link> for details.
      </p>
    </div>
  )
}
