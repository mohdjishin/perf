/**
 * Reusable pagination controls. Shows prev/next and page numbers. Optional summary (e.g. "1–10 of 24").
 */
import s from './Pagination.module.css'

export default function Pagination({ page, totalPages, total, onPageChange, pageSize = 10 }) {
  if (!totalPages || totalPages <= 1) return null

  const pages = []
  const showPages = 5
  let start = Math.max(1, page - Math.floor(showPages / 2))
  let end = Math.min(totalPages, start + showPages - 1)
  if (end - start + 1 < showPages) {
    start = Math.max(1, end - showPages + 1)
  }
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  const from = total != null ? (page - 1) * pageSize + 1 : null
  const to = total != null ? Math.min(page * pageSize, total) : null

  return (
    <div className={s.wrap}>
      {total != null && from != null && to != null && (
        <p className={s.summary}>
          Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
        </p>
      )}
      <nav className={s.pagination} aria-label="Pagination">
        <button
          type="button"
          className={s.btn}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ‹
        </button>
        <div className={s.pages}>
          {start > 1 && (
            <>
              <button type="button" className={s.pageBtn} onClick={() => onPageChange(1)}>
                1
              </button>
              {start > 2 && <span className={s.ellipsis}>…</span>}
            </>
          )}
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              className={`${s.pageBtn} ${p === page ? s.active : ''}`}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ))}
          {end < totalPages && (
            <>
              {end < totalPages - 1 && <span className={s.ellipsis}>…</span>}
              <button type="button" className={s.pageBtn} onClick={() => onPageChange(totalPages)}>
                {totalPages}
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          className={s.btn}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          ›
        </button>
      </nav>
    </div>
  )
}
