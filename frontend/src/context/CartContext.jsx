import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

function getCartKey(userId) {
  return userId ? `cart_${userId}` : null
}

export function CartProvider({ children }) {
  const { user } = useAuth()
  const cartKey = getCartKey(user?.id)

  const [items, setItems] = useState(() => {
    const key = getCartKey(user?.id)
    if (!key) return []
    try {
      return JSON.parse(localStorage.getItem(key) || '[]')
    } catch {
      return []
    }
  })

  // When user changes (login/logout), load that user's cart
  useEffect(() => {
    if (!cartKey) {
      setItems([])
      return
    }
    try {
      const stored = JSON.parse(localStorage.getItem(cartKey) || '[]')
      setItems(stored)
    } catch {
      setItems([])
    }
  }, [cartKey])

  // Persist cart to user-specific key
  useEffect(() => {
    if (!cartKey) return
    localStorage.setItem(cartKey, JSON.stringify(items))
  }, [cartKey, items])

  const addToCart = (product) => {
    const qty = product.quantity ?? 1
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + qty } : i
        )
      }
      return [...prev, { ...product, quantity: qty }]
    })
  }

  const updateQty = (productId, quantity) => {
    if (quantity < 1) {
      setItems((prev) => prev.filter((i) => i.id !== productId))
      return
    }
    setItems((prev) =>
      prev.map((i) => (i.id === productId ? { ...i, quantity } : i))
    )
  }

  const removeFromCart = (productId) => {
    setItems((prev) => prev.filter((i) => i.id !== productId))
  }

  const clearCart = () => setItems([])

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider
      value={{ items, addToCart, updateQty, removeFromCart, clearCart, total, count }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
