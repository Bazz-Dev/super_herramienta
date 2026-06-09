import { DownloadPdfButton } from '@/components/quotes/download-pdf-button'
import { QuotePreview } from '@/components/quotes/quote-preview'
import { sampleQuote } from '@/lib/quotes/sample'
import { renderQuoteHTML } from '@/lib/quotes/template'

export default function CotizadorPage() {
  const data = sampleQuote
  const html = renderQuoteHTML(data)

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cotizador</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vista previa idéntica al PDF · {data.quoteId}
          </p>
        </div>
        <DownloadPdfButton data={data} />
      </div>

      <div className="mt-8 flex justify-center">
        <QuotePreview html={html} />
      </div>
    </div>
  )
}
