import { QuoteEditor } from '@/components/quotes/quote-editor'
import { sampleQuote } from '@/lib/quotes/sample'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { quoteDataSchema, type QuoteData } from '@/lib/quotes/types'

interface Props {
  searchParams: Promise<{ docId?: string }>
}

export default async function CotizadorPage({ searchParams }: Props) {
  const actor = await requireActor()
  const { docId } = await searchParams

  const [clients, savedDoc] = await Promise.all([
    prisma.client.findMany({
      where: { ...tenantScope(actor) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    docId ? prisma.clientDocument.findFirst({
      where: { id: docId, ...tenantScope(actor), type: 'propuesta' },
      select: { dataJson: true, title: true },
    }) : null,
  ])

  let initialData: QuoteData = sampleQuote
  if (savedDoc?.dataJson) {
    try {
      const raw = JSON.parse(savedDoc.dataJson)
      // Sanitize via Zod: catches malformed taxRate (e.g. 19 instead of 0.19),
      // missing fields from older schema versions, and applies current defaults.
      const result = quoteDataSchema.safeParse(raw)
      initialData = result.success ? result.data : (raw as QuoteData)
    } catch { /* keep sampleQuote */ }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Generador de Propuesta Técnico Comercial</h1>
          <p className="mt-1 text-sm text-gray-500">
            {savedDoc ? `Editando: ${savedDoc.title}` : 'Edita los datos y descarga el PDF. La vista previa se actualiza en vivo.'}
          </p>
        </div>
        {savedDoc && (
          <a href="/cotizador" className="text-xs text-gray-400 hover:text-gray-600 mt-1">+ Nueva propuesta</a>
        )}
      </div>
      <QuoteEditor initial={initialData} clients={clients} docId={docId} />
    </div>
  )
}
