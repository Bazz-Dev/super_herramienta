import { Tooltip } from './tooltip'

// Señal visual mínima para un valor que no vino de que el usuario lo tipeara
// ahí mismo (generado, importado, calculado). Antes usaba el `title` nativo
// del navegador (sin primitivo de Tooltip en el proyecto); ahora que existe
// uno, lo usa — mismo colores exactos (info-100/info-500 == blue-100/blue-500
// de Tailwind), consistencia visual en vez de estilo default del navegador.
export function AutoFilledBadge({ reason }: { reason: string }) {
  return (
    <Tooltip content={reason} className="ml-1 align-middle">
      <span
        aria-label={reason}
        className="flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full bg-info-100 text-[9px] font-bold leading-none text-info-500"
      >
        i
      </span>
    </Tooltip>
  )
}
