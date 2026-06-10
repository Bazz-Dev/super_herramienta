import Link from 'next/link'
import { auth } from '@/auth'

const MODULES = [
  { name: 'Generador de Propuesta Técnico Comercial', desc: 'Plantillas, formularios y exportación PDF', status: 'Disponible', href: '/cotizador' },
  { name: 'Recursos', desc: 'Técnicos, vehículos, activos, cuadrillas y clientes', status: 'Disponible', href: '/recursos' },
  { name: 'Cronograma', desc: 'Calendario de trabajos: equipos, clientes y permisos', status: 'Disponible', href: '/cronograma' },
  { name: 'Pipeline', desc: 'Cotizaciones enviadas, estados y seguimiento', status: 'Próximamente', href: null },
]

export default async function DashboardPage() {
  const session = await auth()
  const user = session!.user
  const firstName = (user.name ?? 'Usuario').split(' ')[0]

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Hola, {firstName} 👋</h1>
      <p className="mt-1 text-gray-500">
        {user.role === 'super'
          ? 'Tienes acceso a todos los tenants.'
          : `Trabajando en el tenant: ${user.tenantSlug}.`}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => {
          const card = (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{m.name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    m.href ? 'bg-brand/15 text-brand-600' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {m.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{m.desc}</p>
            </>
          )
          return m.href ? (
            <Link
              key={m.name}
              href={m.href}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand hover:shadow-md"
            >
              {card}
            </Link>
          ) : (
            <div
              key={m.name}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              {card}
            </div>
          )
        })}
      </div>
    </div>
  )
}
