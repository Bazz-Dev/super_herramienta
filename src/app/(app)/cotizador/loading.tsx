export default function Loading() {
  return (
    <div className="p-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
      {/* Editor column */}
      <div className="flex flex-col gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm animate-pulse">
            <div className="mb-3 h-4 w-28 rounded bg-gray-200" />
            <div className="space-y-2">
              <div className="h-9 rounded-lg bg-gray-100" />
              {i < 2 && <div className="h-9 rounded-lg bg-gray-100" />}
            </div>
          </div>
        ))}
      </div>
      {/* Preview column — desktop only */}
      <div className="hidden lg:block">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
          <div className="flex gap-1.5">
            {[...Array(3)].map((_, i) => <div key={i} className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />)}
          </div>
        </div>
        <div className="rounded-xl bg-gray-100 animate-pulse" style={{ aspectRatio: '210/297' }} />
      </div>
    </div>
  )
}
