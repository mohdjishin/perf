/**
 * Reusable empty/loading/error state for consistent UX across pages
 */
import { Link } from 'react-router-dom'
import s from './EmptyState.module.css'

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className={s.wrapper}>
      <div className={s.box}>
        <div className={s.spinner} />
        <p className={s.message}>{message}</p>
      </div>
    </div>
  )
}

export function EmptyState({ title, message, actionLabel, actionTo, onAction, fullWidth }) {
  return (
    <div className={`${s.wrapper} ${fullWidth ? s.fullWidth : ''}`}>
      <div className={s.box}>
        <p className={s.title}>{title}</p>
        {message && <p className={s.message}>{message}</p>}
        {actionLabel && (
          actionTo ? (
            <Link to={actionTo} className={s.action}>
              {actionLabel}
            </Link>
          ) : onAction ? (
            <button type="button" onClick={onAction} className={s.action}>
              {actionLabel}
            </button>
          ) : null
        )}
      </div>
    </div>
  )
}

export function ErrorState({ title, message, action }) {
  return (
    <div className={s.wrapper}>
      <div className={s.box}>
        <p className={s.title}>{title}</p>
        {message && <p className={s.message}>{message}</p>}
        {action && <div className={s.actionWrap}>{action}</div>}
      </div>
    </div>
  )
}
