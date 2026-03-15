/**
 * Toast notification - shows message with optional action button.
 * Used for "Added to cart" and similar feedback.
 */
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import s from './Toast.module.css'

export function Toast({ message, actionLabel, actionTo, onClose, visible, autoHideMs = 4000 }) {
  useEffect(() => {
    if (!visible || !autoHideMs) return
    const t = setTimeout(onClose, autoHideMs)
    return () => clearTimeout(t)
  }, [visible, autoHideMs, onClose])

  if (!visible) return null

  return (
    <div className={s.toast} role="alert">
      <p className={s.message}>{message}</p>
      {actionLabel && actionTo && (
        <Link to={actionTo} className={s.action} onClick={onClose}>
          {actionLabel}
        </Link>
      )}
      <button className={s.close} onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  )
}
