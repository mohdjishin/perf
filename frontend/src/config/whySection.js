/**
 * Config for the "Why" quote section on the home page.
 * Enable/disable and content come from the API; truncation uses fixed limits below for a clean layout.
 */

export const WHY_SECTION_DEFAULTS = {
  title: 'Why Blue Mist Perfumes',
  /** Hardcoded max chars for item title (truncated with … if over) */
  maxTitleChars: 40,
  /** Hardcoded max chars for item description (truncated with … if over) */
  maxDescriptionChars: 80,
  /** Fallback items when API has none */
  items: [
    { title: 'Authentic Oud', description: 'Premium agarwood sourced from the finest regions' },
    { title: 'Dubai Crafted', description: 'Hand-blended by master perfumers in the UAE' },
    { title: 'Arabian Heritage', description: 'Timeless fragrances that honour tradition' },
  ],
}

/**
 * Truncates a string to maxLen characters, appending … if trimmed.
 */
export function truncate(str, maxLen) {
  if (str == null || maxLen <= 0) return ''
  const s = String(str).trim()
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen).trim() + '…'
}
