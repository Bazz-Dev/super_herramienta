import { QuoteEditor } from '@/components/quotes/quote-editor'
import { sampleQuote } from '@/lib/quotes/sample'

export default function CotizadorPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Generador de Propuesta Técnico Comercial</h1>
        <p className="mt-1 text-sm text-gray-500">
          Edita los datos y descarga el PDF. La vista previa se actualiza en vivo.
        </p>
      </div>
      <QuoteEditor initial={sampleQuote} />
    </div>
  )
}
