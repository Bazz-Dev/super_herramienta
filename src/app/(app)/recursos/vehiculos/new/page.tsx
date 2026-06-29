import Link from 'next/link'
import { VehicleForm } from '@/components/resources/vehicle-form'
import { requireActor } from '@/lib/tenant'
import { technicianOptionsForVehicle } from '@/lib/resources/vehicles'
import { createVehicle } from '../actions'

export default async function NewVehiculoPage() {
  const actor = await requireActor()
  const technicians = await technicianOptionsForVehicle(actor)
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/vehiculos" className="text-xs text-gray-400 hover:text-gray-600">← Vehículos</Link>
      <h1 className="mb-6 text-2xl font-bold">Nueva camioneta</h1>
      <VehicleForm action={createVehicle} technicians={technicians} submitLabel="Crear camioneta" />
    </div>
  )
}
