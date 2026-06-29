import Link from 'next/link'
import { AssetForm } from '@/components/resources/asset-form'
import { requireActor } from '@/lib/tenant'
import { vehicleOptions } from '@/lib/resources/vehicles'
import { createAsset } from '../actions'

export default async function NewActivoPage() {
  const actor = await requireActor()
  const vehicles = await vehicleOptions(actor)
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/activos" className="text-xs text-gray-400 hover:text-gray-600">← Activos</Link>
      <h1 className="mb-6 text-2xl font-bold">Nuevo activo</h1>
      <AssetForm action={createAsset} vehicles={vehicles} submitLabel="Crear activo" />
    </div>
  )
}
