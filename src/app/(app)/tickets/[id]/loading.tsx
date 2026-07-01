export default function Loading() {
  return (
    <div className="p-6 animate-pulse">
      {/* Ticket header card skeleton */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="h-5 w-24 rounded-full bg-gray-200" />
          <div className="h-5 w-28 rounded-full bg-gray-100" />
        </div>
        <div className="mb-2 h-3 w-32 rounded bg-gray-200" />
        <div className="mb-3 h-7 w-96 rounded bg-gray-300" />
        <div className="h-4 w-72 rounded bg-gray-100" />
        <div className="mt-4 grid grid-cols-4 gap-4 border-t border-gray-100 pt-4">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div className="mb-1 h-3 w-20 rounded bg-gray-200" />
              <div className="h-4 w-28 rounded bg-gray-300" />
            </div>
          ))}
        </div>
      </div>

      {/* Controls + History grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 h-4 w-40 rounded bg-gray-200" />
              <div className="space-y-2">
                <div className="h-9 rounded-md bg-gray-100" />
                <div className="h-9 rounded-md bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 h-4 w-36 rounded bg-gray-200" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="mb-4 flex gap-3">
              <div className="mt-0.5 h-3 w-3 rounded-full bg-gray-300 shrink-0" />
              <div className="flex-1">
                <div className="mb-1 h-3 w-full rounded bg-gray-200" />
                <div className="h-3 w-24 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
