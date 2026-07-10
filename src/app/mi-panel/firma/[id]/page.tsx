import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { SignDocumentForm } from '@/components/rrhh/sign-document-form'

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente de firma',
  firmado: 'Firmado',
  rechazado: 'Rechazado',
}

const STATUS_CLS: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border border-amber-200',
  firmado: 'bg-green-50 text-green-700 border border-green-200',
  rechazado: 'bg-red-50 text-red-600 border border-red-200',
}

function fDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function FirmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.technicianId) redirect('/mi-panel')

  const sig = await prisma.signatureRequest.findFirst({
    where: { id, technicianId: session.user.technicianId },
    include: { technician: { select: { rut: true } } },
  })
  if (!sig) notFound()

  let docContent: Record<string, unknown> | null = null
  try { docContent = JSON.parse(sig.documentData) } catch { /* raw text */ }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <Link href="/mi-panel" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700">
        ← Mi panel
      </Link>

      {/* Document header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{sig.documentType}</p>
            <h1 className="mt-0.5 text-xl font-bold text-gray-900">{sig.documentTitle}</h1>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 ${STATUS_CLS[sig.status] ?? ''}`}>
            {STATUS_LABEL[sig.status] ?? sig.status}
          </span>
        </div>

        {/* Document body */}
        <div className="prose prose-sm max-w-none rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
          {docContent && typeof docContent === 'object' ? (
            <pre className="whitespace-pre-wrap font-sans text-sm">
              {JSON.stringify(docContent, null, 2)}
            </pre>
          ) : (
            <p className="whitespace-pre-wrap">{sig.documentData}</p>
          )}
        </div>

        {/* Meta */}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-gray-400">Emitido</dt>
            <dd className="font-medium text-gray-700">{fDate(sig.createdAt)}</dd>
          </div>
          {sig.status === 'firmado' && (
            <>
              <div>
                <dt className="text-gray-400">Firmado</dt>
                <dd className="font-medium text-gray-700">{fDate(sig.signedAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">RUT confirmado</dt>
                <dd className="font-medium text-gray-700">{sig.rutConfirmed}</dd>
              </div>
            </>
          )}
          {sig.status === 'rechazado' && (
            <div className="col-span-2">
              <dt className="text-gray-400">Motivo rechazo</dt>
              <dd className="font-medium text-gray-700">{sig.rejectedNote ?? '—'}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Action form — only shown when pending */}
      {sig.status === 'pendiente' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Acción requerida</h2>
          <SignDocumentForm
            signatureId={sig.id}
            techRut={sig.technician.rut}
          />
        </div>
      )}
    </div>
  )
}
