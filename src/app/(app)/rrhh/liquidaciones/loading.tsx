export default function Loading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between animate-pulse">
        <div>
          <div className="mb-2 h-6 w-36 rounded bg-gray-200" />
          <div className="h-3 w-56 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-gray-200" />
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-1.5 h-3 w-24 rounded bg-gray-200" />
            <div className="h-7 w-20 rounded bg-gray-300" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-4 py-3.5 last:border-b-0 animate-pulse">
            <div className="flex-1">
              <div className="mb-1 h-3.5 w-36 rounded bg-gray-200" />
              <div className="h-3 w-24 rounded bg-gray-100" />
            </div>
            <div className="h-3 w-20 rounded bg-gray-100" />
            <div className="h-3 w-20 rounded bg-gray-200" />
            <div className="h-5 w-16 rounded-full bg-gray-200" />
            <div className="h-7 w-16 rounded-md bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  )
}
