/**
 * Back button or link - use for navigation to previous/parent page
 */
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import s from './BackButton.module.css'

export function BackButton({ to, label, asLink = true }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const displayLabel = label ?? t('common.back')

  if (asLink && to) {
    return (
      <Link to={to} className={s.back}>
        {displayLabel}
      </Link>
    )
  }

  return (
    <button type="button" className={s.back} onClick={() => navigate(-1)}>
      {displayLabel}
    </button>
  )
}
