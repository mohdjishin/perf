import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useCart } from '../context/CartContext'
import { OrderSuccessModal } from '../components/OrderSuccessModal'
import s from './Checkout.module.css'

export default function CheckoutSuccess() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { clearCart } = useCart()
    const [status, setStatus] = useState('loading') // loading | success | error
    const [errorMsg, setErrorMsg] = useState('')
    const [transactionId, setTransactionId] = useState('')

    useEffect(() => {
        const sessionId = searchParams.get('session_id')
        if (!sessionId) {
            setStatus('error')
            setErrorMsg('No session ID found. Please try checking out again.')
            return
        }

        api(`/stripe/session-status?session_id=${encodeURIComponent(sessionId)}`)
            .then((data) => {
                if (data.paymentStatus === 'paid' || data.status === 'complete') {
                    clearCart()
                    setTransactionId(data.paymentIntentId || '')
                    setStatus('success')
                } else {
                    setStatus('error')
                    setErrorMsg(`Payment status: ${data.paymentStatus || data.status}. Please contact support if you believe this is an error.`)
                }
            })
            .catch((err) => {
                setStatus('error')
                setErrorMsg(err.message || 'Failed to verify payment. Please check your orders page.')
            })
    }, [searchParams, clearCart])

    if (status === 'loading') {
        return (
            <div className={s.page}>
                <div className={s.successLoading}>
                    <div className={s.spinner} />
                    <p>Verifying your payment...</p>
                </div>
            </div>
        )
    }

    if (status === 'success') {
        return (
            <OrderSuccessModal
                onClose={() => navigate('/')}
                transactionId={transactionId}
            />
        )
    }

    return (
        <div className={s.page}>
            <div className={s.errorContainer}>
                <h2>Payment Issue</h2>
                <p className={s.error}>{errorMsg}</p>
                <button className={s.btn} onClick={() => navigate('/orders')}>
                    View My Orders
                </button>
            </div>
        </div>
    )
}
