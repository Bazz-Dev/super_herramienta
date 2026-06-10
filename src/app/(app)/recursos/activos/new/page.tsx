import Link from 'next/link'
import { AssetForm } from '@/components/resources/asset-form'
import { requireActor } from '@/lib/resources/actor'
import { technicianOptions } from '@/lib/resources/crews'
import { createAsset } from '../actions'

export default async function NewActivoPage() {
  const actor = await requireActor()
  const technicians = await technicianOptions(actor)
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/activos" className="text-xs text-gray-400 hover:text-gray-600">← Activos</Link>
      <h1 className="mb-6 text-2xl font-bold">Nuevo activo</h1>
      <AssetForm action={createAsset} technicians={technicians} submitLabel="Crear activo" />
    </div>
  )
}
