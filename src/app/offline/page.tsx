export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
      <div className="rounded-full bg-brand/10 p-6">
        <svg className="h-12 w-12 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 15.5a8.38 8.38 0 0015 0M5.07 8.93a8 8 0 0113.86 0M1.42 4.42l21.16 15.16M12 20v-2" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-ink">Sin conexión</h1>
      <p className="max-w-xs text-sm text-gray-500">
        No hay conexión a internet. Algunas secciones visitadas recientemente están disponibles de forma limitada.
      </p>
      <a href="/dashboard" className="mt-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90">
        Reintentar
      </a>
    </div>
  )
}
