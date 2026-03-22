import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getMediaUrl } from '../api/client'
import { getProductDisplay } from '../utils/productI18n'
import { formatPrice } from '../utils/currency'
import s from './ProductCard.module.css'

export default function ProductCard({ product }) {
    const { i18n } = useTranslation()
    const display = getProductDisplay(product, i18n.language)

    const isOutOfStock = product.stock === 0
    const isSale = product.salePrice && product.salePrice < product.price

    return (
        <Link to={`/product/${product.id}`} className={s.card}>
            <div className={s.imageWrap}>
                <img
                    src={getMediaUrl(product.imageUrl) || 'https://placehold.co/600x600/f8f9fa/c49a6c?text=Premium+Scent'}
                    alt={display.name}
                    className={s.image}
                    loading="lazy"
                />
                <div className={s.badges}>
                    {isOutOfStock && <span className={`${s.badge} ${s.badgeNeutral}`}>Out of Stock</span>}
                    {product.isNew && !isOutOfStock && <span className={`${s.badge} ${s.badgeAccent}`}>New Arrival</span>}
                    {isSale && !isOutOfStock && (
                        <span className={`${s.badge} ${s.badgeSale}`}>
                            {Math.round(((product.price - product.salePrice) / product.price) * 100)}% Off
                        </span>
                    )}
                </div>
            </div>
            <div className={s.content}>
                <p className={s.category}>{product.categoryName}</p>
                <h3 className={s.name}>{display.name}</h3>
                <div className={s.priceRow}>
                    {isSale ? (
                        <>
                            <span className={s.salePrice}>{formatPrice(product.salePrice)}</span>
                            <span className={s.originalPrice}>{formatPrice(product.price)}</span>
                        </>
                    ) : (
                        <span className={s.price}>{formatPrice(product.price)}</span>
                    )}
                </div>
            </div>
        </Link>
    )
}
