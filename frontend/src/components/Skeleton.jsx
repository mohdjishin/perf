/**
 * Reusable skeleton placeholders for loading states (shimmer animation).
 */
import s from './Skeleton.module.css'

export function SkeletonLine({ width, className = '' }) {
  return (
    <div
      className={`${s.line} ${width === 'short' ? s.lineShort : ''} ${className}`}
      style={width && width !== 'short' ? { width } : undefined}
      aria-hidden
    />
  )
}

export function SkeletonCircle({ size = 40, className = '' }) {
  return (
    <div
      className={`${s.circle} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  )
}

export function SkeletonCard({ className = '' }) {
  return <div className={`${s.card} ${className}`} aria-hidden />
}

export function SkeletonRect({ width, height, className = '' }) {
  return (
    <div
      className={`${s.rect} ${className}`}
      style={{ width: width || '100%', height: height || '100%' }}
      aria-hidden
    />
  )
}

/** Full-page skeleton: title + grid of product-like cards (for Shop, Home, etc.) */
export function PageSkeletonGrid({ count = 8 }) {
  return (
    <div className={s.page}>
      <div className={s.title} aria-hidden />
      <div className={s.subtitle} aria-hidden />
      <div className={s.grid}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i}>
            <div className={s.gridCard} />
            <div className={s.gridCardFooter}>
              <div className={s.gridCardLine} />
              <div className={`${s.gridCardLine} ${s.gridCardLineShort}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Full-page skeleton: title + list rows (for Orders, Users, etc.) */
export function PageSkeletonList({ rows = 5 }) {
  return (
    <div className={s.page}>
      <div className={s.title} aria-hidden />
      <div className={s.subtitle} aria-hidden />
      <div className={s.list}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={s.listItem}>
            <div className={s.listAvatar} />
            <div className={s.listBody}>
              <div className={s.listLine} />
              <div className={`${s.listLine} ${s.listLineShort}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Product detail page skeleton */
export function PageSkeletonProduct() {
  return (
    <div className={s.detail}>
      <div className={s.detailImage} aria-hidden />
      <div className={s.detailInfo}>
        <div className={s.detailTitle} aria-hidden />
        <div className={s.detailPrice} aria-hidden />
        <div className={s.detailDesc} aria-hidden />
        <div className={s.detailDesc} aria-hidden />
        <div className={s.detailDesc} aria-hidden />
        <div className={s.detailBtn} aria-hidden />
      </div>
    </div>
  )
}

/** Default page skeleton (grid) for Suspense / generic loading */
export function PageSkeleton() {
  return <PageSkeletonGrid count={8} />
}
