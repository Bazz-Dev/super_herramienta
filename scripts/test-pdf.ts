import { writeFileSync } from 'node:fs'
import { generateQuotePdf } from '../src/lib/quotes/pdf'
import { sampleQuote } from '../src/lib/quotes/sample'
import { TEMPLATES } from '../src/lib/quotes/types'

for (const template of TEMPLATES) {
  const pdf = await generateQuotePdf({ ...sampleQuote, template })
  const file = `tmp-quote-${template}.pdf`
  writeFileSync(file, pdf)
  console.log(`${template}: ${pdf.length} bytes -> ${file} (header ${pdf.subarray(0, 5).toString('latin1')})`)
}
