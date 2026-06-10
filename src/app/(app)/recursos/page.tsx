import Link from 'next/link'

const SECTIONS = [
  { name: 'Técnicos', desc: 'Personas, especialidades y contacto', href: '/recursos/tecnicos', ready: true },
  { name: 'Cuadrillas', desc: 'Grupos de técnicos para asignar como unidad', href: '/recursos/cuadrillas', ready: true },
  { name: 'Maquinaria / activos', desc: 'Equipos y herramientas con estado', href: '/recursos/activos', ready: true },
  { name: 'Cronograma', desc: 'Asignaciones y calendario de trabajos', href: '/recursos/cronograma', ready: true },
]

export default function RecursosPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Recursos</h1>
      <p className="mt-1 text-sm text-gray-500">Gestión de técnicos, cuadrillas, activos y cronograma.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{s.name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${s.ready ? 'bg-brand/15 text-brand-600' : 'bg-gray-100 text-gray-500'}`}
                >
                  {s.ready ? 'Disponible' : 'Próximamente'}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{s.desc}</p>
            </>
          )
          return s.ready ? (
            <Link
              key={s.name}
              href={s.href}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-150 hover:border-brand hover:shadow-md"
            >
              {inner}
            </Link>
          ) : (
            <div key={s.name} className="rounded-xl border border-gray-200 bg-white p-5 opacity-70 shadow-sm">
              {inner}
            </div>
          )
        })}
      </div>
    </div>
  )
}
