import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TechnicianForm } from '@/components/resources/technician-form'
import { requireActor } from '@/lib/resources/actor'
import { getTechnician } from '@/lib/resources/technicians'
import { ASSET_STATUS_LABELS, type AssetStatusId } from '@/lib/resources/labels'
import { updateTechnician } from '../actions'

export default async function EditTecnicoPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor()
  const { id } = await params
  const tech = await getTechnician(actor, id)
  if (!tech) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/tecnicos" className="text-xs text-gray-400 hover:text-gray-600">
        ← Técnicos
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Editar técnico</h1>
      <TechnicianForm action={updateTechnician.bind(null, tech.id)} initial={tech} submitLabel="Guardar cambios" />

      {/* Inventario de la camioneta */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Inventario de la camioneta
            {tech.vehiclePlate && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{tech.vehiclePlate}</span>}
          </h2>
          <Link href="/recursos/activos/new" className="text-xs text-brand-600 hover:underline">
            + Asignar herramienta
          </Link>
        </div>
        {tech.tools.length === 0 ? (
          <p className="text-xs text-gray-400">
            Sin herramientas asignadas. En <strong>Activos</strong>, asigna la herramienta a este técnico.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {tech.tools.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span className="text-ink">
                  {t.name}
                  {t.code && <span className="ml-2 text-xs text-gray-400">{t.code}</span>}
                </span>
                <span className="text-xs text-gray-500">{ASSET_STATUS_LABELS[t.status as AssetStatusId]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
