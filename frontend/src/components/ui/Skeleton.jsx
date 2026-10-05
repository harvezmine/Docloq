export function Skeleton({ width = "100%", height = "1rem", className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700 ${className}`}
      style={{ width, height }}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="w-full">
      <div className="flex gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} width={`${100 / cols}%`} height="0.75rem" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4 px-6 py-4 border-b border-slate-50 dark:border-slate-800/50">
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={`${row}-${col}`} width={`${100 / cols}%`} height="0.875rem" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = "" }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/50 p-5 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <Skeleton width="2.5rem" height="2.5rem" className="rounded-xl" />
        <Skeleton width="5rem" height="0.75rem" />
      </div>
      <Skeleton width="4rem" height="1.5rem" className="mb-1" />
      <Skeleton width="6rem" height="0.75rem" />
    </div>
  );
}

export function Pagination({ currentPage, totalItems, pageSize, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 dark:border-slate-800/50">
      <p className="text-xs text-slate-400">
        Page {currentPage} of {totalPages}
        <span className="ml-2 text-slate-500">({totalItems} items)</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Previous
        </button>
        {/* Page numbers, show up to 5 */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let page;
          if (totalPages <= 5) {
            page = i + 1;
          } else if (currentPage <= 3) {
            page = i + 1;
          } else if (currentPage >= totalPages - 2) {
            page = totalPages - 4 + i;
          } else {
            page = currentPage - 2 + i;
          }
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                currentPage === page
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {page}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default Skeleton;
