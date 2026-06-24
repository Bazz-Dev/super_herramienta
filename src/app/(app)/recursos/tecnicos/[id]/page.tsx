import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TechnicianForm } from '@/components/resources/technician-form'
import { DocSection } from '@/components/resources/doc-section'
import { requireActor } from '@/lib/resources/actor'
import { getTechnician } from '@/lib/resources/technicians'
import {
  ASSET_STATUS_LABELS,
  CONTRACT_TYPE_BADGE,
  CONTRACT_TYPE_LABELS,
  type AssetStatusId,
  type ContractTypeId,
} from '@/lib/resources/labels'
import { updateTechnician } from '../actions'

function daysUntil(d: Date | null | undefined): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function calcAge(birthDate: Date | null | undefined): number | null {
  if (!birthDate) return null
  const d = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
  return age
}

export default async function EditTecnicoPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor()
  const { id } = await params
  const tech = await getTechnician(actor, id)
  if (!tech) notFound()

  const contractType = (tech.contractType ?? 'indefinido') as ContractTypeId
  const contractDays = daysUntil(tech.contractEndDate)
  const contractExpired = contractDays != null && contractDays < 0
  const contractWarn = contractDays != null && contractDays >= 0 && contractDays <= 30
  const age = calcAge(tech.birthDate)

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/tecnicos" className="text-xs text-gray-400 hover:text-gray-600">
        ← Técnicos
      </Link>

      {/* Header card */}
      <div className="mt-3 mb-6 flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold ${CONTRACT_TYPE_BADGE[contractType]}`}>
          {tech.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-ink">{tech.name}</h1>
          <p className="text-sm text-gray-500">{tech.specialty ?? 'Sin especialidad'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONTRACT_TYPE_BADGE[contractType]}`}>
              {CONTRACT_TYPE_LABELS[contractType]}
            </span>
            {age != null && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                {age} años{tech.birthDate ? ` · nació ${formatDate(tech.birthDate)}` : ''}
              </span>
            )}
            {(contractExpired || contractWarn) && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${contractExpired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {contractExpired
                  ? `Contrato vencido ${formatDate(tech.contractEndDate)}`
                  : `Contrato vence en ${contractDays}d (${formatDate(tech.contractEndDate)})`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Camioneta asignada + inventario */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Camioneta e inventario
            {tech.vehicle && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{tech.vehicle.plate}</span>}
          </h2>
          {tech.vehicle ? (
            <Link href={`/recursos/vehiculos/${tech.vehicle.id}`} className="text-xs text-brand-600 hover:underline">
              Ver camioneta
            </Link>
          ) : (
            <Link href="/recursos/vehiculos/new" className="text-xs text-brand-600 hover:underline">
              + Asignar camioneta
            </Link>
          )}
        </div>
        {!tech.vehicle ? (
          <p className="text-xs text-gray-400">
            Este técnico no tiene camioneta. En <strong>Vehículos</strong>, crea o edita una y asígnasela.
          </p>
        ) : tech.vehicle.assets.length === 0 ? (
          <p className="text-xs text-gray-400">
            La camioneta {tech.vehicle.plate} no tiene herramientas. En <strong>Maquinaria / activos</strong>, asígnalas.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {tech.vehicle.assets.map((a) => (
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

      {/* Edit form */}
      <h2 className="mb-4 text-lg font-semibold text-ink">Editar datos</h2>
      <TechnicianForm action={updateTechnician.bind(null, tech.id)} initial={tech} submitLabel="Guardar cambios" />

      {/* Documents */}
      <DocSection
        technicianId={tech.id}
        initial={(tech.documents ?? []).map((d) => ({
          ...d,
          expiryDate: d.expiryDate ?? null,
        }))}
      />
    </div>
  )
}
