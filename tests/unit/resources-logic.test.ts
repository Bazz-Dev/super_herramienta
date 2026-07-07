/**
 * Unit tests for resources business logic (labels + schemas).
 * Runner: node --import tsx --test
 * No database, no Next.js — pure TypeScript.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  CONTRACT_TYPE,
  CONTRACT_TYPE_ACTIVE,
  CONTRACT_TYPE_TERMINATED,
  CONTRACT_TYPE_LABELS,
  CONTRACT_TYPE_BADGE,
  CONTRACT_TYPE_CARD,
  CONTRACT_TYPE_DOT,
  VEHICLE_STATUS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUS_BADGE,
  ASSET_STATUS,
  ASSET_STATUS_LABELS,
  ASSET_STATUS_BADGE,
  type ContractTypeId,
} from '../../src/lib/resources/labels.ts'

import {
  technicianInputSchema,
  vehicleInputSchema,
  clientInputSchema,
} from '../../src/lib/resources/schemas.ts'

// ─── 1. CONTRACT_TYPE_ACTIVE ──────────────────────────────────────────────────
describe('CONTRACT_TYPE_ACTIVE', () => {
  it('contains indefinido, plazo_fijo, ayudante', () => {
    assert.ok(CONTRACT_TYPE_ACTIVE.includes('indefinido'))
    assert.ok(CONTRACT_TYPE_ACTIVE.includes('plazo_fijo'))
    assert.ok(CONTRACT_TYPE_ACTIVE.includes('ayudante'))
  })

  it('does NOT contain no_renovado or despedido', () => {
    assert.ok(!CONTRACT_TYPE_ACTIVE.includes('no_renovado'))
    assert.ok(!CONTRACT_TYPE_ACTIVE.includes('despedido'))
  })

  it('has exactly 3 entries', () => {
    assert.equal(CONTRACT_TYPE_ACTIVE.length, 3)
  })
})

// ─── 2. CONTRACT_TYPE_TERMINATED ─────────────────────────────────────────────
describe('CONTRACT_TYPE_TERMINATED', () => {
  it('contains no_renovado and despedido', () => {
    assert.ok(CONTRACT_TYPE_TERMINATED.includes('no_renovado'))
    assert.ok(CONTRACT_TYPE_TERMINATED.includes('despedido'))
  })

  it('does NOT contain active employment types', () => {
    assert.ok(!CONTRACT_TYPE_TERMINATED.includes('indefinido'))
    assert.ok(!CONTRACT_TYPE_TERMINATED.includes('plazo_fijo'))
    assert.ok(!CONTRACT_TYPE_TERMINATED.includes('ayudante'))
  })

  it('has exactly 2 entries', () => {
    assert.equal(CONTRACT_TYPE_TERMINATED.length, 2)
  })
})

// ─── 3. isTerminated lookup (via array) ──────────────────────────────────────
describe('isTerminated via array lookup', () => {
  function isTerminated(c: ContractTypeId): boolean {
    return CONTRACT_TYPE_TERMINATED.includes(c)
  }

  it('returns true for no_renovado', () => assert.ok(isTerminated('no_renovado')))
  it('returns true for despedido', () => assert.ok(isTerminated('despedido')))
  it('returns false for indefinido', () => assert.ok(!isTerminated('indefinido')))
  it('returns false for plazo_fijo', () => assert.ok(!isTerminated('plazo_fijo')))
  it('returns false for ayudante', () => assert.ok(!isTerminated('ayudante')))

  it('ACTIVE and TERMINATED are mutually exclusive and cover all CONTRACT_TYPE values', () => {
    const all = new Set<string>(CONTRACT_TYPE)
    const active = new Set<string>(CONTRACT_TYPE_ACTIVE)
    const terminated = new Set<string>(CONTRACT_TYPE_TERMINATED)
    // no overlap
    for (const v of active) assert.ok(!terminated.has(v), `${v} in both arrays`)
    // full coverage
    const union = new Set([...active, ...terminated])
    assert.equal(union.size, all.size)
    for (const v of all) assert.ok(union.has(v), `${v} missing from both arrays`)
  })
})

// ─── 4. vehicleInputSchema ────────────────────────────────────────────────────
describe('vehicleInputSchema', () => {
  it('parses valid data successfully', () => {
    const result = vehicleInputSchema.safeParse({
      plate: 'ABC-123',
      brand: 'Toyota',
      model: 'Hilux',
      year: '2022',
      status: 'active',
    })
    assert.ok(result.success)
    assert.equal(result.data!.plate, 'ABC-123')
    assert.equal(result.data!.year, 2022)          // string → number transform
    assert.equal(result.data!.status, 'active')
  })

  it('fails when plate is missing', () => {
    const result = vehicleInputSchema.safeParse({ brand: 'Ford' })
    assert.ok(!result.success)
    const fields = result.error!.issues.map((i) => i.path[0])
    assert.ok(fields.includes('plate'))
  })

  it('fails when plate is empty string', () => {
    const result = vehicleInputSchema.safeParse({ plate: '   ' })
    assert.ok(!result.success)
  })

  it('fails when status is an invalid value', () => {
    const result = vehicleInputSchema.safeParse({ plate: 'XYZ-999', status: 'broken' })
    assert.ok(!result.success)
    const fields = result.error!.issues.map((i) => i.path[0])
    assert.ok(fields.includes('status'))
  })

  it('defaults status to active when omitted', () => {
    const result = vehicleInputSchema.safeParse({ plate: 'DEF-456' })
    assert.ok(result.success)
    assert.equal(result.data!.status, 'active')
  })

  it('rejects year < 1950', () => {
    const result = vehicleInputSchema.safeParse({ plate: 'GH-001', year: '1900' })
    assert.ok(!result.success)
  })

  it('rejects year > 2100', () => {
    const result = vehicleInputSchema.safeParse({ plate: 'GH-002', year: '2200' })
    assert.ok(!result.success)
  })

  it('empty year string becomes undefined (optional)', () => {
    const result = vehicleInputSchema.safeParse({ plate: 'GH-003', year: '' })
    assert.ok(result.success)
    assert.equal(result.data!.year, undefined)
  })
})

// ─── 5. technicianInputSchema ─────────────────────────────────────────────────
describe('technicianInputSchema', () => {
  it('parses with minimum required field (name)', () => {
    const result = technicianInputSchema.safeParse({ name: 'Juan Pérez' })
    assert.ok(result.success)
    assert.equal(result.data!.name, 'Juan Pérez')
    assert.equal(result.data!.active, true)           // default
    assert.equal(result.data!.contractType, 'indefinido') // default
  })

  it('fails when name is missing', () => {
    const result = technicianInputSchema.safeParse({})
    assert.ok(!result.success)
  })

  it('fails when name is empty string', () => {
    const result = technicianInputSchema.safeParse({ name: '   ' })
    assert.ok(!result.success)
  })

  it('dailyRate as numeric string is coerced to number', () => {
    const result = technicianInputSchema.safeParse({ name: 'Test', dailyRate: '50000' })
    assert.ok(result.success)
    assert.equal(result.data!.dailyRate, 50000)
  })

  it('dailyRate=0 is valid (nonnegative)', () => {
    const result = technicianInputSchema.safeParse({ name: 'Test', dailyRate: '0' })
    assert.ok(result.success)
    assert.equal(result.data!.dailyRate, 0)
  })

  it('negative dailyRate fails validation', () => {
    const result = technicianInputSchema.safeParse({ name: 'Test', dailyRate: '-100' })
    assert.ok(!result.success)
  })

  it('non-numeric dailyRate string fails', () => {
    const result = technicianInputSchema.safeParse({ name: 'Test', dailyRate: 'abc' })
    assert.ok(!result.success)
  })

  it('invalid contractType fails', () => {
    const result = technicianInputSchema.safeParse({ name: 'Test', contractType: 'freelance' })
    assert.ok(!result.success)
  })

  it('all valid contractType values are accepted', () => {
    const valid = ['indefinido', 'plazo_fijo', 'ayudante', 'no_renovado', 'despedido'] as const
    for (const ct of valid) {
      const result = technicianInputSchema.safeParse({ name: 'Test', contractType: ct })
      assert.ok(result.success, `contractType '${ct}' should be valid`)
    }
  })

  it('invalid email format fails', () => {
    const result = technicianInputSchema.safeParse({ name: 'Test', email: 'not-an-email' })
    assert.ok(!result.success)
  })

  it('valid email is accepted', () => {
    const result = technicianInputSchema.safeParse({ name: 'Test', email: 'juan@ingegarchile.cl' })
    assert.ok(result.success)
  })

  it('empty email string becomes undefined', () => {
    const result = technicianInputSchema.safeParse({ name: 'Test', email: '' })
    assert.ok(result.success)
    assert.equal(result.data!.email, undefined)
  })
})

// ─── 6. clientInputSchema ─────────────────────────────────────────────────────
describe('clientInputSchema', () => {
  it('parses with only required name', () => {
    const result = clientInputSchema.safeParse({ name: 'ACME Corp' })
    assert.ok(result.success)
    assert.equal(result.data!.name, 'ACME Corp')
    assert.deepEqual(result.data!.ruts, [])  // default empty array
  })

  it('fails when name is missing', () => {
    const result = clientInputSchema.safeParse({})
    assert.ok(!result.success)
  })

  it('label is optional — omitting it is valid', () => {
    const result = clientInputSchema.safeParse({ name: 'ACME' })
    assert.ok(result.success)
    assert.equal(result.data!.label, undefined)
  })

  it('valid label values are accepted', () => {
    const valid = ['principal', 'ocasional', 'prospecto', 'inactivo', 'proyecto'] as const
    for (const lbl of valid) {
      const result = clientInputSchema.safeParse({ name: 'ACME', label: lbl })
      assert.ok(result.success, `label '${lbl}' should be valid`)
    }
  })

  it('invalid label fails', () => {
    const result = clientInputSchema.safeParse({ name: 'ACME', label: 'vip' })
    assert.ok(!result.success)
  })

  it('ruts array accepts objects with rut + optional label', () => {
    const result = clientInputSchema.safeParse({
      name: 'ACME',
      ruts: [
        { rut: '76.000.000-K', label: 'Casa matriz' },
        { rut: '76.000.001-1' },
      ],
    })
    assert.ok(result.success)
    assert.equal(result.data!.ruts.length, 2)
  })

  it('rut entry with empty rut string fails', () => {
    const result = clientInputSchema.safeParse({
      name: 'ACME',
      ruts: [{ rut: '' }],
    })
    assert.ok(!result.success)
  })

  it('valid email accepted', () => {
    const result = clientInputSchema.safeParse({ name: 'ACME', email: 'info@acme.com' })
    assert.ok(result.success)
  })

  it('invalid email fails', () => {
    const result = clientInputSchema.safeParse({ name: 'ACME', email: 'bad-email' })
    assert.ok(!result.success)
  })

  it('empty email becomes undefined', () => {
    const result = clientInputSchema.safeParse({ name: 'ACME', email: '' })
    assert.ok(result.success)
    assert.equal(result.data!.email, undefined)
  })
})

// ─── 7. Label maps completeness ───────────────────────────────────────────────
describe('label maps completeness', () => {
  it('CONTRACT_TYPE_LABELS has a defined label for every CONTRACT_TYPE value', () => {
    for (const ct of CONTRACT_TYPE) {
      assert.notEqual(
        CONTRACT_TYPE_LABELS[ct],
        undefined,
        `CONTRACT_TYPE_LABELS missing entry for '${ct}'`,
      )
      assert.ok(
        typeof CONTRACT_TYPE_LABELS[ct] === 'string' && CONTRACT_TYPE_LABELS[ct].length > 0,
        `CONTRACT_TYPE_LABELS['${ct}'] is empty`,
      )
    }
  })

  it('CONTRACT_TYPE_BADGE has a defined class for every CONTRACT_TYPE value', () => {
    for (const ct of CONTRACT_TYPE) {
      assert.ok(
        typeof CONTRACT_TYPE_BADGE[ct] === 'string' && CONTRACT_TYPE_BADGE[ct].length > 0,
        `CONTRACT_TYPE_BADGE missing '${ct}'`,
      )
    }
  })

  it('CONTRACT_TYPE_CARD has a defined class for every CONTRACT_TYPE value', () => {
    for (const ct of CONTRACT_TYPE) {
      assert.ok(
        typeof CONTRACT_TYPE_CARD[ct] === 'string' && CONTRACT_TYPE_CARD[ct].length > 0,
        `CONTRACT_TYPE_CARD missing '${ct}'`,
      )
    }
  })

  it('CONTRACT_TYPE_DOT has a defined class for every CONTRACT_TYPE value', () => {
    for (const ct of CONTRACT_TYPE) {
      assert.ok(
        typeof CONTRACT_TYPE_DOT[ct] === 'string' && CONTRACT_TYPE_DOT[ct].length > 0,
        `CONTRACT_TYPE_DOT missing '${ct}'`,
      )
    }
  })

  it('VEHICLE_STATUS_LABELS has a defined label for every VEHICLE_STATUS value', () => {
    for (const vs of VEHICLE_STATUS) {
      assert.ok(
        typeof VEHICLE_STATUS_LABELS[vs] === 'string' && VEHICLE_STATUS_LABELS[vs].length > 0,
        `VEHICLE_STATUS_LABELS missing '${vs}'`,
      )
    }
  })

  it('VEHICLE_STATUS_BADGE has a defined class for every VEHICLE_STATUS value', () => {
    for (const vs of VEHICLE_STATUS) {
      assert.ok(
        typeof VEHICLE_STATUS_BADGE[vs] === 'string' && VEHICLE_STATUS_BADGE[vs].length > 0,
        `VEHICLE_STATUS_BADGE missing '${vs}'`,
      )
    }
  })

  it('ASSET_STATUS_LABELS has a defined label for every ASSET_STATUS value', () => {
    for (const as_ of ASSET_STATUS) {
      assert.ok(
        typeof ASSET_STATUS_LABELS[as_] === 'string' && ASSET_STATUS_LABELS[as_].length > 0,
        `ASSET_STATUS_LABELS missing '${as_}'`,
      )
    }
  })

  it('ASSET_STATUS_BADGE has a defined class for every ASSET_STATUS value', () => {
    for (const as_ of ASSET_STATUS) {
      assert.ok(
        typeof ASSET_STATUS_BADGE[as_] === 'string' && ASSET_STATUS_BADGE[as_].length > 0,
        `ASSET_STATUS_BADGE missing '${as_}'`,
      )
    }
  })
})
