export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Back link */}
      <div className="mb-3 h-3 w-16 rounded bg-gray-200 animate-pulse" />
      {/* Header card */}
      <div className="mt-3 mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm animate-pulse flex gap-4">
        <div className="h-14 w-14 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-40 rounded bg-gray-200" />
          <div className="h-3 w-24 rounded bg-gray-100" />
          <div className="flex gap-2 mt-1">
            <div className="h-5 w-20 rounded-full bg-gray-200" />
            <div className="h-5 w-16 rounded-full bg-gray-100" />
          </div>
        </div>
      </div>
      {/* Tabs skeleton */}
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {[80, 60, 72, 90].map((w, i) => (
          <div key={i} className="h-9 rounded-t bg-gray-100 animate-pulse" style={{ width: w }} />
        ))}
      </div>
      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-3 animate-pulse text-center">
            <div className="h-8 w-10 rounded bg-gray-200 mx-auto mb-1" />
            <div className="h-3 w-16 rounded bg-gray-100 mx-auto" />
          </div>
        ))}
      </div>
      {/* Content card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm animate-pulse space-y-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-100" />)}
      </div>
    </div>
  )
}
