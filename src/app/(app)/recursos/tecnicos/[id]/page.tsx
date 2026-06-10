import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TechnicianForm } from '@/components/resources/technician-form'
import { requireActor } from '@/lib/resources/actor'
import { getTechnician } from '@/lib/resources/technicians'
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
    </div>
  )
}
