export default function Loading() {
  return (
    <div className="p-6 space-y-5">
      {/* Header skeleton */}
      <div className="flex items-center justify-between animate-pulse">
        <div>
          <div className="mb-2 h-6 w-32 rounded bg-gray-200" />
          <div className="h-3 w-48 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-gray-200" />
      </div>

      {/* Search bar skeleton */}
      <div className="h-10 w-full rounded-lg border border-gray-200 bg-white animate-pulse" />

      {/* Table rows skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 grid grid-cols-5 gap-4 animate-pulse">
          {[100, 80, 80, 70, 60].map((w, i) => <div key={i} className="h-3 rounded bg-gray-200" style={{ width: w }} />)}
        </div>
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-4 py-3.5 last:border-b-0 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1">
              <div className="mb-1 h-3.5 w-36 rounded bg-gray-200" />
              <div className="h-3 w-24 rounded bg-gray-100" />
            </div>
            <div className="h-5 w-20 rounded-full bg-gray-200" />
            <div className="h-5 w-16 rounded-full bg-gray-100" />
            <div className="h-7 w-16 rounded-md bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  )
}
