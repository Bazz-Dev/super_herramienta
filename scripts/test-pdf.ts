import { writeFileSync } from 'node:fs'
import { generateQuotePdf } from '../src/lib/quotes/pdf'
import { sampleQuote } from '../src/lib/quotes/sample'

const pdf = await generateQuotePdf(sampleQuote)
writeFileSync('tmp-quote.pdf', pdf)
console.log('PDF generado:', pdf.length, 'bytes | header:', pdf.subarray(0, 5).toString('latin1'))
