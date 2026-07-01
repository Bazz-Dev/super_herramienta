export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      {/* Back link + header */}
      <div className="animate-pulse">
        <div className="mb-4 h-4 w-24 rounded bg-gray-200" />
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gray-200 shrink-0" />
          <div>
            <div className="mb-1.5 h-6 w-48 rounded bg-gray-200" />
            <div className="h-4 w-32 rounded bg-gray-100" />
          </div>
          <div className="ml-auto h-7 w-24 rounded-full bg-gray-200" />
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[...Array(3)].map((_, col) => (
          <div key={col} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
            <div className="mb-4 h-4 w-32 rounded bg-gray-200" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="mb-3 flex justify-between border-b border-gray-100 pb-3 last:border-b-0 last:mb-0 last:pb-0">
                <div className="h-3 w-20 rounded bg-gray-200" />
                <div className="h-3 w-24 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Sections */}
      {[...Array(2)].map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
          <div className="mb-4 h-4 w-40 rounded bg-gray-200" />
          {[...Array(3)].map((_, j) => (
            <div key={j} className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 last:border-b-0 last:mb-0 last:pb-0">
              <div className="h-3 w-40 rounded bg-gray-200" />
              <div className="h-5 w-20 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
