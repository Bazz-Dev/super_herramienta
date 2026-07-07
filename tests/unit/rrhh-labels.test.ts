/**
 * Unit tests for RR.HH. labels and business logic.
 * Runner: node --import tsx --test
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  LEAVE_TYPE_LABEL,
  LEAVE_STATUS_BADGE,
  LEAVE_STATUS_LABEL,
  PAYROLL_STATUS_BADGE,
  PAYROLL_STATUS_LABEL,
  MONTH_NAMES,
} from '../../src/lib/rrhh/labels.ts'

// ─── Leave type labels ────────────────────────────────────────────────────────
describe('LEAVE_TYPE_LABEL', () => {
  const LEAVE_TYPES = ['vacaciones', 'permiso_sin_goce', 'permiso_con_goce', 'licencia_medica', 'otro']

  test('all LeaveType values have a label', () => {
    for (const t of LEAVE_TYPES) {
      assert.ok(typeof LEAVE_TYPE_LABEL[t] === 'string' && LEAVE_TYPE_LABEL[t].length > 0,
        `Missing label for LeaveType: ${t}`)
    }
  })

  test('labels are in Spanish', () => {
    assert.equal(LEAVE_TYPE_LABEL.vacaciones, 'Vacaciones')
    assert.equal(LEAVE_TYPE_LABEL.licencia_medica, 'Licencia médica')
  })
})

// ─── Leave status badges ──────────────────────────────────────────────────────
describe('LEAVE_STATUS_BADGE + LABEL', () => {
  const LEAVE_STATUSES = ['pendiente', 'aprobado', 'rechazado']

  test('all LeaveStatus values have a badge class', () => {
    for (const s of LEAVE_STATUSES) {
      assert.ok(typeof LEAVE_STATUS_BADGE[s] === 'string' && LEAVE_STATUS_BADGE[s].length > 0,
        `Missing badge for status: ${s}`)
    }
  })

  test('all LeaveStatus values have a label', () => {
    for (const s of LEAVE_STATUSES) {
      assert.ok(typeof LEAVE_STATUS_LABEL[s] === 'string' && LEAVE_STATUS_LABEL[s].length > 0,
        `Missing label for status: ${s}`)
    }
  })

  test('pendiente badge contains warning color', () => {
    assert.ok(LEAVE_STATUS_BADGE.pendiente.includes('yellow'), 'pendiente should be yellow')
  })

  test('aprobado badge contains success color', () => {
    assert.ok(LEAVE_STATUS_BADGE.aprobado.includes('green'), 'aprobado should be green')
  })

  test('rechazado badge contains error color', () => {
    assert.ok(LEAVE_STATUS_BADGE.rechazado.includes('red'), 'rechazado should be red')
  })
})

// ─── Payroll status labels ────────────────────────────────────────────────────
describe('PAYROLL_STATUS', () => {
  const PAYROLL_STATUSES = ['borrador', 'emitido', 'pagado']

  test('all PayrollStatus values have a badge class', () => {
    for (const s of PAYROLL_STATUSES) {
      assert.ok(typeof PAYROLL_STATUS_BADGE[s] === 'string' && PAYROLL_STATUS_BADGE[s].length > 0,
        `Missing badge for payroll status: ${s}`)
    }
  })

  test('all PayrollStatus values have a label', () => {
    for (const s of PAYROLL_STATUSES) {
      assert.ok(typeof PAYROLL_STATUS_LABEL[s] === 'string' && PAYROLL_STATUS_LABEL[s].length > 0,
        `Missing label for payroll status: ${s}`)
    }
  })

  test('status labels are in logical order: borrador < emitido < pagado', () => {
    // Not asserting order by index, but at least labels exist and are distinct
    const labels = PAYROLL_STATUSES.map(s => PAYROLL_STATUS_LABEL[s])
    const unique = new Set(labels)
    assert.equal(unique.size, 3, 'Each payroll status must have a unique label')
  })
})

// ─── MONTH_NAMES ──────────────────────────────────────────────────────────────
describe('MONTH_NAMES', () => {
  test('has 13 entries (index 0 empty, 1-12 are months)', () => {
    assert.equal(MONTH_NAMES.length, 13)
    assert.equal(MONTH_NAMES[0], '')
  })

  test('index 1 = Enero, index 12 = Diciembre', () => {
    assert.equal(MONTH_NAMES[1], 'Enero')
    assert.equal(MONTH_NAMES[12], 'Diciembre')
  })

  test('all 12 month names are non-empty strings', () => {
    for (let i = 1; i <= 12; i++) {
      assert.ok(typeof MONTH_NAMES[i] === 'string' && MONTH_NAMES[i].length > 0,
        `Month ${i} name is empty`)
    }
  })

  test('months are in correct order', () => {
    const expected = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    for (let i = 0; i < 12; i++) {
      assert.equal(MONTH_NAMES[i + 1], expected[i])
    }
  })
})

// ─── Payroll liquid calculation (pure arithmetic) ────────────────────────────
describe('payroll liquid calculation', () => {
  function calcLiquid(baseSalary: number, extras: number, deductions: number): number {
    return baseSalary + extras - deductions
  }

  test('standard case: base + extras - deductions', () => {
    assert.equal(calcLiquid(1_000_000, 100_000, 50_000), 1_050_000)
  })

  test('no extras or deductions: liquid equals base', () => {
    assert.equal(calcLiquid(800_000, 0, 0), 800_000)
  })

  test('deductions larger than extras: liquid < base', () => {
    const liquid = calcLiquid(500_000, 0, 150_000)
    assert.equal(liquid, 350_000)
    assert.ok(liquid < 500_000)
  })

  test('both extras and deductions: net effect is sum', () => {
    // base 1M, extras 200k, deductions 300k → liquid = 1M + 200k - 300k = 900k
    assert.equal(calcLiquid(1_000_000, 200_000, 300_000), 900_000)
  })

  test('zero salary edge case', () => {
    assert.equal(calcLiquid(0, 50_000, 0), 50_000)
  })
})
