import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { formatPrice } from '../utils/currency'
import { EmptyState } from '../components/EmptyState'
import { BackButton } from '../components/BackButton'
import s from './Cart.module.css'

export default function Cart() {
  const { items, updateQty, removeFromCart, total } = useCart()

  if (items.length === 0) {
    return (
      <div className={s.page}>
        <BackButton to="/shop" label="Shop" />
        <EmptyState
          title="Your cart is empty"
          message="Add fragrances from our collection to get started."
          actionLabel="Continue Shopping"
          actionTo="/shop"
        />
      </div>
    )
  }

  return (
    <div className={s.page}>
      <BackButton to="/shop" label="Shop" />
      <h1 className={s.title}>Cart</h1>
      <div className={s.grid}>
        <div className={s.list}>
          {items.map((item) => (
            <div key={item.id} className={s.item}>
              <div className={s.itemImage}>
                <img
                  src={item.imageUrl || 'https://placehold.co/80x100/e2e8f0/94a3b8?text=·'}
                  alt={item.name}
                  loading="lazy"
                />
              </div>
              <div className={s.itemInfo}>
                <h3 className={s.itemName}>{item.name}</h3>
                <p className={s.itemPrice}>{formatPrice(item.price)}</p>
                <div className={s.itemActions}>
                  <div className={s.qtyWrap}>
                    <button
                      onClick={() => updateQty(item.id, item.quantity - 1)}
                      className={s.qtyBtn}
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.id, item.quantity + 1)}
                      className={s.qtyBtn}
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className={s.removeBtn}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className={s.itemTotal}>{formatPrice(item.price * item.quantity)}</div>
            </div>
          ))}
        </div>
        <div className={s.summary}>
          <h3 className={s.summaryTitle}>Summary</h3>
          <div className={s.summaryRow}>
            <span>Subtotal</span>
            <span>{formatPrice(total)}</span>
          </div>
          <Link to="/checkout" className={s.checkoutBtn}>Checkout</Link>
        </div>
      </div>
    </div>
  )
}
