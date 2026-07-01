export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Profile hero skeleton */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm animate-pulse">
        <div className="flex items-start gap-5">
          <div className="h-16 w-16 rounded-2xl bg-gray-200 shrink-0" />
          <div className="flex-1">
            <div className="mb-2 h-6 w-48 rounded bg-gray-200" />
            <div className="mb-3 h-4 w-32 rounded bg-gray-100" />
            <div className="flex gap-2">
              {[80, 110, 90].map((w, i) => <div key={i} className="h-5 rounded-full bg-gray-200" style={{ width: w }} />)}
            </div>
          </div>
        </div>
        {/* KPI chips */}
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl bg-gray-100 p-3">
              <div className="mb-1 h-5 w-10 rounded bg-gray-200" />
              <div className="h-3 w-16 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Two column skeleton */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[...Array(2)].map((_, col) => (
          <div key={col} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
            <div className="mb-4 h-4 w-32 rounded bg-gray-200" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 last:border-b-0 last:mb-0 last:pb-0">
                <div className="h-3 w-24 rounded bg-gray-200" />
                <div className="h-3 w-20 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Schedule skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
        <div className="mb-4 h-4 w-40 rounded bg-gray-200" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="mb-3 flex gap-3 rounded-lg border border-gray-100 p-3">
            <div className="h-10 w-10 rounded-lg bg-gray-200 shrink-0" />
            <div className="flex-1">
              <div className="mb-1.5 h-3.5 w-48 rounded bg-gray-200" />
              <div className="h-3 w-32 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
