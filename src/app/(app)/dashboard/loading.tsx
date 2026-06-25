export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-pulse">
      <div>
        <div className="h-8 w-48 rounded-lg bg-gray-200" />
        <div className="mt-2 h-4 w-36 rounded bg-gray-100" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="h-3 w-20 rounded bg-gray-200" />
            <div className="mt-3 h-9 w-12 rounded-lg bg-gray-200" />
            <div className="mt-2 h-3 w-24 rounded bg-gray-100" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-3.5">
              <div className="h-4 w-36 rounded bg-gray-200" />
            </div>
            <div className="p-5 space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-4 w-24 rounded bg-gray-100" />
                  <div className="h-4 w-16 rounded bg-gray-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
