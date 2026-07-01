export default function Loading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between animate-pulse">
        <div>
          <div className="mb-2 h-6 w-24 rounded bg-gray-200" />
          <div className="h-3 w-56 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-gray-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="mb-1.5 h-5 w-40 rounded bg-gray-200" />
                <div className="h-3 w-24 rounded bg-gray-100" />
              </div>
              <div className="h-5 w-16 rounded-full bg-gray-200" />
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-24 rounded-md bg-gray-200" />
              <div className="h-7 w-24 rounded-md bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
