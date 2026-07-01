export default function Loading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between animate-pulse">
        <div>
          <div className="mb-2 h-6 w-28 rounded bg-gray-200" />
          <div className="h-3 w-48 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-gray-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm animate-pulse">
            <div className="mb-3 h-5 w-32 rounded bg-gray-200" />
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-gray-200 shrink-0" />
                  <div className="h-3 w-28 rounded bg-gray-100" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <div className="h-7 w-16 rounded-md bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
