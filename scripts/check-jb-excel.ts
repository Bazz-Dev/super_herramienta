import ExcelJS from 'exceljs'
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile('justburger-ingegar/Fuente_Datos_Trabajos_JustBurger.xlsx')
for (const ws of wb.worksheets) {
  console.log('\n=== Hoja:', ws.name, '| filas:', ws.rowCount, '===')
  const headers = ws.getRow(1).values as unknown[]
  console.log('Headers:', headers.slice(1, 35).join(' | '))
  const r2 = ws.getRow(2).values as unknown[]
  console.log('Fila 2: ', r2.slice(1, 35).join(' | '))
}
