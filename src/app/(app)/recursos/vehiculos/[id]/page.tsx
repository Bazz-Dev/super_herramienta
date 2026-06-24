import Link from 'next/link'
import { notFound } from 'next/navigation'
import { VehicleForm } from '@/components/resources/vehicle-form'
import { requireActor } from '@/lib/resources/actor'
import { getVehicle, technicianOptionsForVehicle } from '@/lib/resources/vehicles'
import { ASSET_STATUS_LABELS, type AssetStatusId } from '@/lib/resources/labels'
import { updateVehicle } from '../actions'

export default async function EditVehiculoPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor()
  const { id } = await params
  const [vehicle, technicians] = await Promise.all([getVehicle(actor, id), technicianOptionsForVehicle(actor)])
  if (!vehicle) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/vehiculos" className="text-xs text-gray-400 hover:text-gray-600">← Vehículos</Link>
      <h1 className="mb-6 text-2xl font-bold">Editar camioneta</h1>
      <VehicleForm
        action={updateVehicle.bind(null, vehicle.id)}
        technicians={technicians}
        vehicleId={vehicle.id}
        initial={{
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          status: vehicle.status,
          technicianId: vehicle.technicianId,
          notes: vehicle.notes,
          revTecnicaExpiry: vehicle.revTecnicaExpiry,
          soapExpiry: vehicle.soapExpiry,
          permisoCirculacionExpiry: vehicle.permisoCirculacionExpiry,
          lastServiceDate: vehicle.lastServiceDate,
          nextServiceDate: vehicle.nextServiceDate,
        }}
        submitLabel="Guardar cambios"
      />

      {/* Inventario de la camioneta */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Inventario / herramientas</h2>
          <Link href="/recursos/activos/new" className="text-xs text-brand-600 hover:underline">
            + Asignar herramienta
          </Link>
        </div>
        {vehicle.assets.length === 0 ? (
          <p className="text-xs text-gray-400">
            Sin herramientas en esta camioneta. En <strong>Maquinaria / activos</strong>, asigna la herramienta a esta camioneta.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {vehicle.assets.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <span className="text-ink">
                  {a.name}
                  {a.code && <span className="ml-2 text-xs text-gray-400">{a.code}</span>}
                </span>
                <span className="text-xs text-gray-500">{ASSET_STATUS_LABELS[a.status as AssetStatusId]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
