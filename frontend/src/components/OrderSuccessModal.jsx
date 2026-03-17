/**
 * Modal shown after order is placed successfully.
 * Offers options to view orders or continue shopping.
 */
import { Link } from 'react-router-dom'
import s from './OrderSuccessModal.module.css'

export function OrderSuccessModal({ onClose, transactionId }) {
  return (
    <div
      className={s.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-success-title"
    >
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.icon}>✓</div>
        <h2 id="order-success-title" className={s.title}>{transactionId ? 'Order Confirmed' : 'Order Placed'}</h2>
        <p className={s.message}>Thank you for your purchase. Your order has been successfully processed.</p>
        {transactionId && (
          <div className={s.transactionInfo}>
            <span className={s.transactionLabel}>Transaction Reference</span>
            <span className={s.transactionId}>{transactionId}</span>
          </div>
        )}
        <div className={s.actions}>
          <Link to="/orders" className={s.primaryBtn} onClick={onClose}>
            View My Orders
          </Link>
          <Link to="/shop" className={s.secondaryBtn} onClick={onClose}>
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
