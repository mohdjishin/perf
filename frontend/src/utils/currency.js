/**
 * Format price in AED (UAE Dirham)
 */
export function formatPrice(amount) {
  if (amount == null || isNaN(amount)) return 'AED 0.00'
  return `AED ${Number(amount).toFixed(2)}`
}
