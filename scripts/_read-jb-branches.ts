import ExcelJS from 'exceljs'

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile('justburger-ingegar/Fuente_Datos_Trabajos_JustBurger.xlsx')
  console.log('Sheets:', wb.worksheets.map(w => w.name).join(', '))

  function cellStr(v: unknown): string {
    if (v == null) return ''
    if (typeof v === 'string') return v.trim()
    if (typeof v === 'object') return String((v as {text?: unknown; result?: unknown}).text ?? (v as {result?: unknown}).result ?? '').trim()
    return String(v).trim()
  }

  const wsSuc = wb.getWorksheet('Sucursales')
  if (wsSuc) {
    console.log('\n--- Hoja Sucursales ---')
    wsSuc.eachRow((row, i) => {
      const v = row.values as unknown[]
      console.log(`Row ${i}: ${[1,2,3,4,5].map(c => cellStr(v[c])).join(' | ')}`)
    })
  }

  // Unique values from col 3 of Tickets sheet (or first sheet)
  const wsT = wb.getWorksheet('Tickets') ?? wb.worksheets[0]
  if (wsT) {
    const header = (wsT.getRow(1).values as unknown[]).slice(1, 15).map(cellStr)
    console.log('\nTickets headers:', header.join(' | '))
    const unique = new Set<string>()
    wsT.eachRow((row, i) => {
      if (i === 1) return
      const v = row.values as unknown[]
      // col 3 = Sucursal based on import script
      const s = cellStr(v[3])
      if (s) unique.add(s)
    })
    console.log('\nSucursales únicas (col 3):')
    ;[...unique].sort().forEach(s => console.log(' -', s))
  }
}

main().catch(console.error)
