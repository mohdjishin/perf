import s from './StarRating.module.css'

const MAX = 5

/**
 * Display-only star rating (e.g. on product cards). value 0–5.
 */
export function StarRatingDisplay({ value, max = MAX, className = '' }) {
  const v = Math.max(0, Math.min(max, Number(value) || 0))
  const full = Math.floor(v)
  const half = v - full >= 0.5 ? 1 : 0
  const empty = max - full - half
  return (
    <span className={`${s.stars} ${className}`} aria-label={`${v} out of ${max} stars`}>
      {Array.from({ length: full }, (_, i) => (
        <span key={`f-${i}`} className={s.starFull} aria-hidden>★</span>
      ))}
      {half ? <span className={s.starHalf} aria-hidden>★</span> : null}
      {Array.from({ length: empty }, (_, i) => (
        <span key={`e-${i}`} className={s.starEmpty} aria-hidden>★</span>
      ))}
    </span>
  )
}

/**
 * Editable star rating (e.g. admin product form). value 0–5, onChange(1–5 or 0 to clear).
 */
export function StarRatingEdit({ value, onChange, max = MAX, className = '', disabled }) {
  const v = Math.max(0, Math.min(max, Number(value) || 0))
  return (
    <span className={`${s.stars} ${s.editable} ${className}`} role="group" aria-label="Rating">
      {Array.from({ length: max }, (_, i) => {
        const star = i + 1
        const filled = star <= v
        return (
          <button
            key={star}
            type="button"
            className={filled ? s.starFull : s.starEmpty}
            onClick={() => !disabled && onChange(star)}
            onKeyDown={(e) => {
              if (disabled) return
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault()
                onChange(Math.min(max, v + 1))
              }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault()
                onChange(Math.max(0, v - 1))
              }
            }}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            {'★'}
          </button>
        )
      })}
      {v > 0 && (
        <button
          type="button"
          className={s.clearRating}
          onClick={() => !disabled && onChange(0)}
          disabled={disabled}
          aria-label="Clear rating"
        >
          Clear
        </button>
      )}
    </span>
  )
}
