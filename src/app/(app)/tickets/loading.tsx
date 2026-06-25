export default function TicketsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-52 rounded-lg bg-gray-200" />
          <div className="mt-2 h-4 w-32 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-gray-200" />
      </div>
      <div className="flex gap-3">
        <div className="h-8 w-40 rounded-md bg-gray-200" />
        <div className="h-8 w-40 rounded-md bg-gray-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-9 rounded-lg bg-gray-200" />
            {[...Array(3)].map((_, j) => (
              <div key={j} className="h-24 rounded-lg bg-white border border-gray-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
