export default function Loading() {
  return (
    <div className="p-6 space-y-5">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between animate-pulse">
        <div>
          <div className="mb-2 h-6 w-48 rounded bg-gray-200" />
          <div className="h-3 w-72 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-gray-200" />
      </div>

      {/* Client folder cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm animate-pulse">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gray-200" />
              <div>
                <div className="mb-1 h-4 w-28 rounded bg-gray-200" />
                <div className="h-3 w-20 rounded bg-gray-100" />
              </div>
            </div>
            <div className="space-y-2">
              {[...Array(2)].map((_, j) => (
                <div key={j} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <div className="h-3 w-32 rounded bg-gray-200" />
                  <div className="h-3 w-10 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
