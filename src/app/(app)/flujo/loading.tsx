export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      {/* KPI row skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm animate-pulse">
            <div className="mb-2 h-3 w-20 rounded bg-gray-200" />
            <div className="h-7 w-24 rounded bg-gray-300" />
          </div>
        ))}
      </div>

      {/* Chart area skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
        <div className="mb-4 h-4 w-40 rounded bg-gray-200" />
        <div className="flex items-end gap-2 h-40">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="flex-1 rounded-t bg-gray-200" style={{ height: `${30 + Math.random() * 70}%` }} />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3 animate-pulse">
          <div className="h-4 w-32 rounded bg-gray-200" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-4 py-3 animate-pulse last:border-b-0">
            <div className="h-3 w-24 rounded bg-gray-200" />
            <div className="h-3 flex-1 rounded bg-gray-100" />
            <div className="h-3 w-16 rounded bg-gray-200" />
            <div className="h-5 w-16 rounded-full bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  )
}
