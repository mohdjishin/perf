/**
 * Returns localized name and description for a product based on locale.
 * Uses nameAr/descriptionAr when locale is 'ar' and they are non-empty.
 */
export function getProductDisplay(p, locale) {
  if (!p) return { name: '', description: '' }
  const isAr = locale === 'ar'
  const name = (isAr && (p.nameAr || '').trim()) ? p.nameAr : (p.name || '')
  const description = (isAr && (p.descriptionAr || '').trim()) ? p.descriptionAr : (p.description || '')
  return { name, description }
}

/**
 * Returns a translation key for category (e.g. "ORIENTAL" -> "oriental").
 */
export function categoryKey(category) {
  return (category || 'fragrance').toLowerCase().replace(/\s+/g, '_')
}
