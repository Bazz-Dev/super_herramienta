export default function VehiculosLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-3 w-16 rounded bg-gray-100" />
          <div className="mt-1 h-8 w-32 rounded-lg bg-gray-200" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-gray-200" />
      </div>
      <div className="mt-5 h-9 w-72 rounded-md bg-gray-200" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex justify-between items-center">
              <div>
                <div className="h-6 w-24 rounded bg-gray-200" />
                <div className="mt-1 h-3 w-32 rounded bg-gray-100" />
              </div>
              <div className="h-5 w-16 rounded-full bg-gray-200" />
            </div>
            <div className="px-4 py-3 space-y-3">
              <div className="h-4 w-28 rounded bg-gray-100" />
              <div className="h-4 w-20 rounded bg-gray-100" />
            </div>
            <div className="border-t border-gray-100 px-4 py-2.5 flex justify-between">
              <div className="h-7 w-20 rounded-md bg-gray-200" />
              <div className="h-7 w-7 rounded-md bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
