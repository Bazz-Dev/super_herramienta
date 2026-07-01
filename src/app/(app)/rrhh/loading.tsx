export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm animate-pulse">
            <div className="mb-1.5 h-3 w-20 rounded bg-gray-200" />
            <div className="h-7 w-16 rounded bg-gray-300" />
          </div>
        ))}
      </div>

      {/* Team list skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3 animate-pulse">
          <div className="h-4 w-28 rounded bg-gray-200" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-4 py-3.5 last:border-b-0 animate-pulse">
            <div className="h-9 w-9 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1">
              <div className="mb-1 h-3.5 w-40 rounded bg-gray-200" />
              <div className="h-3 w-24 rounded bg-gray-100" />
            </div>
            <div className="h-5 w-20 rounded-full bg-gray-200" />
            <div className="h-5 w-20 rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
