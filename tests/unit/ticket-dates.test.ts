import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fromDateInput, toDateInput } from '../../src/lib/cashflow/dates.ts'

// new-ticket-form.tsx envía "YYYY-MM-DDTHH:MM:00" (fecha+hora combinadas) —
// fromDateInput() es solo para fechas puras y le agregaba T00:00:00.000Z,
// rompiendo el string y dejando estimatedDate en null siempre al crear un
// ticket con fecha programada. El fix en createTicket() usa new Date(`${s}Z`)
// para este caso combinado — este test fija ese contrato.
test('combined date+time string (ticket creation) parses to the exact UTC instant, never Invalid Date', () => {
  const combined = '2026-08-05T14:30:00'
  const d = new Date(`${combined}Z`)
  assert.equal(Number.isNaN(d.getTime()), false)
  assert.equal(d.toISOString(), '2026-08-05T14:30:00.000Z')
})

test('regression marker: fromDateInput() on an already-combined datetime string is invalid (why the fix was needed)', () => {
  const combined = '2026-08-05T14:30:00'
  const bugged = fromDateInput(combined)
  // Antes del fix esto silenciosamente pasaba a null en createTicket().
  assert.equal(bugged, null)
})

test('fromDateInput/toDateInput round-trip a plain date-only string (edit flow, gastos)', () => {
  const dateOnly = '2026-08-05'
  const d = fromDateInput(dateOnly)
  assert.ok(d)
  assert.equal(toDateInput(d), dateOnly)
})

test('fromDateInput returns null for empty/undefined input', () => {
  assert.equal(fromDateInput(''), null)
  assert.equal(fromDateInput(undefined), null)
  assert.equal(fromDateInput(null), null)
})
