/**
 * Row-level authorization policies.
 *
 * Every mutation that touches a record owned by a specific tenant goes through
 * these guards. Centralizing them here means there is exactly ONE place to audit
 * cross-tenant isolation.
 *
 * Usage in a Server Action:
 *   assertOwns(actor, record.tenantId)           // throws if wrong tenant
 *   assertRole(actor, ['super', 'supervisor'])   // throws if role not allowed
 */
import type { TenantActor } from '@/lib/tenant'

export class PolicyError extends Error {
  constructor(message = 'No autorizado') {
    super(message)
    this.name = 'PolicyError'
  }
}

/** Throws if the actor does not belong to the same tenant as the record. */
export function assertOwns(actor: TenantActor, recordTenantId: string): void {
  if (actor.role === 'super') return
  if (actor.tenantId !== recordTenantId) throw new PolicyError()
}

/** Throws if the actor's role is not in the allowed list. */
export function assertRole(actor: TenantActor, allowed: TenantActor['role'][]): void {
  if (!allowed.includes(actor.role)) throw new PolicyError('Rol insuficiente')
}

/** Throws if the actor is a `tecnico` and is not the owner of the record. */
export function assertTechnicianOwns(actor: TenantActor, technicianId: string): void {
  if (actor.role === 'super' || actor.role === 'supervisor') return
  if (actor.technicianId !== technicianId) throw new PolicyError()
}

/** Returns true if the actor can manage (create/edit/delete) resources. */
export function canManage(actor: TenantActor): boolean {
  return actor.role === 'super' || actor.role === 'supervisor'
}

/** Returns true if the actor can approve expenses. */
export function canApproveExpense(actor: TenantActor): boolean {
  return actor.role === 'super' || actor.role === 'supervisor'
}
