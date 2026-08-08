// Feedback para operaciones que toman un momento perceptible (más de un
// instante, pero no tanto como para justificar una pantalla de carga
// dedicada) — pedido explícito del dueño: "en vez de un spinner básico,
// usar una animación discreta y profesional... con mensajes contextuales...
// debe sentirse que algo está ocurriendo, no que la app se congeló". 3
// puntos con animate-bounce escalonado (mismo lenguaje visual que un
// indicador de "escribiendo…" de chat) en vez del anillo genérico de
// Spinner — ese sigue siendo el correcto para loaders de botón cortos
// (ej. "Guardando…"), este es para el caso "esto puede demorar un
// momento y quiero que se note".
export function ActivityIndicator({ message, className }: { message: string; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className ?? ''}`} role="status" aria-live="polite">
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-70" style={{ animationDelay: '0ms', animationDuration: '900ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-70" style={{ animationDelay: '150ms', animationDuration: '900ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-70" style={{ animationDelay: '300ms', animationDuration: '900ms' }} />
      </span>
      <span className="text-sm font-medium text-gray-500">{message}</span>
    </div>
  )
}

// Variante a pantalla/panel completo — reemplaza un <Spinner size={32}/>
// suelto y sin texto (el patrón que dejaba la app "sintiéndose pegada": algo
// gira pero no dice qué está pasando ni cuánto puede demorar).
export function ActivityOverlay({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-gray-400">
      <ActivityIndicator message={message} className="text-gray-600" />
    </div>
  )
}
