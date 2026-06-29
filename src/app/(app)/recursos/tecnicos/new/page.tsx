import Link from 'next/link'
import { TechnicianForm } from '@/components/resources/technician-form'
import { requireActor } from '@/lib/tenant'
import { createTechnician } from '../actions'

export default async function NewTecnicoPage() {
  await requireActor()
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/tecnicos" className="text-xs text-gray-400 hover:text-gray-600">
        ← Técnicos
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Nuevo técnico</h1>
      <TechnicianForm action={createTechnician} submitLabel="Crear técnico" />
    </div>
  )
}
