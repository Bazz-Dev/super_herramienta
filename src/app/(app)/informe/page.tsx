import { ReportEditor } from '@/components/reports/report-editor'
import { sampleReport } from '@/lib/reports/sample'

export default function InformePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Creador de Informe Técnico</h1>
        <p className="mt-1 text-sm text-gray-500">
          Edita las secciones y el registro fotográfico. La vista previa se actualiza en vivo y el
          PDF se descarga ordenado en formato A4.
        </p>
      </div>
      <ReportEditor initial={sampleReport} />
    </div>
  )
}
