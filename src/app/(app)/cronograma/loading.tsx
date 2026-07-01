export default function Loading() {
  return (
    <div className="p-6">
      {/* Toolbar skeleton */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-9 w-24 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-9 w-24 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-9 w-24 rounded-lg bg-gray-200 animate-pulse" />
        <div className="ml-auto h-9 w-40 rounded-lg bg-gray-200 animate-pulse" />
      </div>

      {/* Calendar grid skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-gray-400 border-r border-gray-100 last:border-r-0">{d}</div>
          ))}
        </div>
        {/* Weeks */}
        {[...Array(5)].map((_, w) => (
          <div key={w} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
            {[...Array(7)].map((_, d) => (
              <div key={d} className="min-h-[90px] p-2 border-r border-gray-100 last:border-r-0">
                <div className="mb-1 h-5 w-5 rounded-full bg-gray-100 animate-pulse" />
                {Math.random() > 0.6 && (
                  <div className="h-5 rounded-md bg-brand/20 animate-pulse" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
