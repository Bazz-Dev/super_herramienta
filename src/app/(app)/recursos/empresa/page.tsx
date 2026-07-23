import Link from 'next/link'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { CompanyDocSection } from '@/components/resources/company-doc-section'

export default async function EmpresaPage() {
  const actor = await requireActor(['super', 'supervisor'])

  const docs = await prisma.companyDocument.findMany({
    where: { tenantId: actor.tenantId },
    orderBy: { uploadedAt: 'desc' },
  })

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">← Dashboard</Link>
      <h1 className="text-2xl font-bold">Empresa</h1>
      <p className="mt-1 text-sm text-gray-500">
        Documentos institucionales — reglamento interno, mutualidad, procedimientos — para acreditar a la empresa
        ante plataformas de proveedores/clientes.
      </p>

      <div className="mt-6">
        <CompanyDocSection initial={docs} />
      </div>
    </div>
  )
}
