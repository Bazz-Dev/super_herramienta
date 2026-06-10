import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AssetForm } from '@/components/resources/asset-form'
import { requireActor } from '@/lib/resources/actor'
import { getAsset } from '@/lib/resources/assets'
import { vehicleOptions } from '@/lib/resources/vehicles'
import { updateAsset } from '../actions'

export default async function EditActivoPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor()
  const { id } = await params
  const [asset, vehicles] = await Promise.all([getAsset(actor, id), vehicleOptions(actor)])
  if (!asset) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/activos" className="text-xs text-gray-400 hover:text-gray-600">← Activos</Link>
      <h1 className="mb-6 text-2xl font-bold">Editar activo</h1>
      <AssetForm action={updateAsset.bind(null, asset.id)} vehicles={vehicles} initial={asset} submitLabel="Guardar cambios" />
    </div>
  )
}
