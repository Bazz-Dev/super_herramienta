import Link from 'next/link'
import { requireActor } from '@/lib/tenant'
import { listAllDocuments } from '@/lib/resources/documentacion'
import { DocumentacionView } from '@/components/resources/documentacion-view'

export default async function DocumentacionPage() {
  const actor = await requireActor(['super', 'supervisor'])
  const { rows, incompleteTechnicians, owners } = await listAllDocuments(actor)

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">← Dashboard</Link>
      <h1 className="text-2xl font-bold">Documentación y acreditación</h1>
      <p className="mt-1 text-sm text-gray-500">
        Vista cruzada de los documentos de técnicos y de la empresa — para preparar rápido un paquete de
        acreditación ante un cliente, mutualidad o plataforma de proveedores, sin abrir cada ficha por separado.
      </p>

      <div className="mt-6">
        <DocumentacionView rows={rows} incompleteTechnicians={incompleteTechnicians} owners={owners} />
      </div>
    </div>
  )
}
