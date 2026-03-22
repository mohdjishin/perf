import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/EmptyState'
import { BackButton } from '../components/BackButton'
import s from './NotFound.module.css'

export default function NotFound() {
    const { t } = useTranslation()

    return (
        <div className={s.page}>
            <div className={s.container}>
                <BackButton to="/" label={t('nav.home') || 'Home'} />
                <EmptyState
                    title="404 — Scent Not Found"
                    message="The page you are looking for doesn't exist or has been moved. Discover our other exquisite collections instead."
                    actionLabel="Browse Shop"
                    actionTo="/shop"
                />
            </div>
        </div>
    )
}
