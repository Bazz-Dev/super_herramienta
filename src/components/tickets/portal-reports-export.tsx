'use client'

interface TicketRow {
  code: string
  title: string
  branch: string
  urgency: string
  status: string
  category: string
  assignedTo: string
  created: string
  closed: string
}

const STATUS_ES: Record<string, string> = {
  nuevo: 'Nuevo', en_revision: 'En revisión', en_ejecucion: 'En ejecución',
  esperando_aprobacion: 'Esp. aprobación', resuelto: 'Resuelto', cancelado: 'Cancelado',
}
const URG_ES: Record<string, string> = {
  emergencia: 'Emergencia', urgencia: 'Urgente', no_urgente: 'Normal', preventivo: 'Preventivo',
}

export function PortalReportsExport({ rows, clientName, primary }: { rows: TicketRow[]; clientName: string; primary: string }) {
  function exportCsv() {
    const headers = ['ID', 'Título', 'Sucursal', 'Urgencia', 'Estado', 'Categoría', 'Técnico', 'Creado', 'Cierre']
    const data = rows.map(r => [
      r.code,
      `"${r.title.replace(/"/g, '""')}"`,
      r.branch,
      URG_ES[r.urgency] ?? r.urgency,
      STATUS_ES[r.status] ?? r.status,
      r.category,
      r.assignedTo,
      r.created,
      r.closed,
    ])
    const csv = [headers.join(','), ...data.map(r => r.join(','))].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${clientName.toLowerCase().replace(/\s+/g, '-')}-solicitudes.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button
        onClick={() => window.print()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '12px', fontWeight: '700',
          border: '1px solid rgba(255,255,255,0.35)', cursor: 'pointer',
        }}
      >
        ⎙ Imprimir
      </button>
      <button
        onClick={exportCsv}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '8px',
          background: primary, color: '#111', fontSize: '12px', fontWeight: '700',
          border: 'none', cursor: 'pointer',
        }}
      >
        ↓ Exportar CSV
      </button>
    </div>
  )
}
