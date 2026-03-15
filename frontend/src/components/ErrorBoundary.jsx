import React from 'react'
import { Link } from 'react-router-dom'

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV

/**
 * Catches render errors in children and shows a fallback UI instead of a blank screen.
 */
export class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      const fallback = this.props.fallback
      if (typeof fallback === 'function') return fallback(this.state.error)
      if (fallback != null) return fallback
      const err = this.state.error
      return (
        <div style={{ padding: '2rem', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Something went wrong</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
            This page could not be loaded. Please try again.
          </p>
          {err?.message && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem', wordBreak: 'break-word' }}>
              {err.message}
            </p>
          )}
          {isDev && err?.stack && (
            <pre style={{ textAlign: 'left', fontSize: '0.75rem', overflow: 'auto', background: 'var(--color-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem', maxHeight: 200 }}>
              {err.stack}
            </pre>
          )}
          <Link to="/shop" style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
            Back to Shop
          </Link>
        </div>
      )
    }
    return this.props.children
  }
}
