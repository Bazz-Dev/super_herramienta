import Link from 'next/link'
import { CrewForm } from '@/components/resources/crew-form'
import { requireActor } from '@/lib/resources/actor'
import { technicianOptions } from '@/lib/resources/crews'
import { createCrew } from '../actions'

export default async function NewCuadrillaPage() {
  const actor = await requireActor()
  const technicians = await technicianOptions(actor)
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/cuadrillas" className="text-xs text-gray-400 hover:text-gray-600">← Cuadrillas</Link>
      <h1 className="mb-6 text-2xl font-bold">Nueva cuadrilla</h1>
      <CrewForm action={createCrew} technicians={technicians} submitLabel="Crear cuadrilla" />
    </div>
  )
}
