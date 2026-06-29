import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CrewForm } from '@/components/resources/crew-form'
import { requireActor } from '@/lib/tenant'
import { getCrew, technicianOptions } from '@/lib/resources/crews'
import { updateCrew } from '../actions'

export default async function EditCuadrillaPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor()
  const { id } = await params
  const [crew, technicians] = await Promise.all([getCrew(actor, id), technicianOptions(actor)])
  if (!crew) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/cuadrillas" className="text-xs text-gray-400 hover:text-gray-600">← Cuadrillas</Link>
      <h1 className="mb-6 text-2xl font-bold">Editar cuadrilla</h1>
      <CrewForm
        action={updateCrew.bind(null, crew.id)}
        technicians={technicians}
        initial={{
          name: crew.name,
          description: crew.description,
          active: crew.active,
          technicianIds: crew.technicians.map((t) => t.id),
        }}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
