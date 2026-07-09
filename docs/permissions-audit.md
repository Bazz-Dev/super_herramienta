# Permissions Audit — INGEGAR Platform

**Date:** 2026-07-09  
**Scope:** Server Actions, API routes, protected pages  
**Roles:** `super | supervisor | client | tecnico`

**Protection layers verified:**
- `(app)` layout: blocks unauthenticated, redirects `tecnico` → `/mi-panel`, redirects `client` → portal
- `requireActor(roles?)` in `src/lib/tenant.ts`: role gate + viewas support
- `canViewPortal()` in `src/lib/portal-auth.ts`: portal gate
- `policies.ts`: `assertRole`, `assertOwns`, `assertTechnicianOwns`, `canApproveExpense`

> **Note:** Pages under the `(app)` layout are protected from `tecnico` and `client` by the layout redirect. The critical surface is **Server Actions**, which are callable via direct HTTP POST regardless of the layout.

---

## Priority 1 — Server Actions

### `src/app/(app)/flujo/actions.ts`
Status: ~~🚨 Gap~~ → ✅ Fixed  
Issue: All 8 functions (`createBranch`, `updateBranch`, `deleteBranch`, `createJob`, `updateJob`, `deleteJob`, `addCost`, `deleteCost`) used `requireActor()` with no role restriction. A `tecnico` or `client` with a valid session could call these directly via HTTP POST to create/delete branches, jobs, and costs.  
Fix applied: `await requireActor()` → `await requireActor(['super', 'supervisor'])` (all 8 calls)

---

### `src/app/(app)/cronograma/actions.ts`
Status: ~~🚨 Gap~~ → ✅ Fixed  
Issue: `createAssignment`, `updateAssignment`, `deleteAssignment` all used `requireActor()` with no role restriction.  
Fix applied: `await requireActor()` → `await requireActor(['super', 'supervisor'])` (all 3 calls)

---

### `src/app/(app)/recursos/clientes/actions.ts`
Status: ~~🚨 Gap~~ → ✅ Fixed  
Issue: `createClient`, `updateClient`, `createBranch`, `toggleBranch`, `saveClientLogo`, `deleteClient`, `createClientInline` — all 7 used `requireActor()` with no role restriction.  
Fix applied: `await requireActor()` → `await requireActor(['super', 'supervisor'])` (all 7 calls)

---

### `src/app/(app)/recursos/tecnicos/actions.ts`
Status: ~~🚨 Gap~~ → ✅ Fixed  
Issue: `createTechnician`, `updateTechnician`, `deleteDocument`, `deleteTechnician` used `requireActor()` with no role restriction. A `tecnico` could update any technician record in their tenant.  
Fix applied: `await requireActor()` → `await requireActor(['super', 'supervisor'])` (all 4 calls)

---

### `src/app/(app)/recursos/activos/actions.ts`
Status: ~~🚨 Gap~~ → ✅ Fixed  
Issue: `createAsset`, `updateAsset`, `deleteAsset` used `requireActor()` with no role restriction.  
Fix applied: `await requireActor()` → `await requireActor(['super', 'supervisor'])` (all 3 calls)

---

### `src/app/(app)/recursos/cuadrillas/actions.ts`
Status: ~~🚨 Gap~~ → ✅ Fixed  
Issue: `createCrew`, `updateCrew`, `deleteCrew` used `requireActor()` with no role restriction.  
Fix applied: `await requireActor()` → `await requireActor(['super', 'supervisor'])` (all 3 calls)

---

### `src/app/(app)/recursos/vehiculos/actions.ts`
Status: ~~🚨 Gap~~ → ✅ Fixed  
Issue: `createVehicle`, `updateVehicle`, `deleteVehicle` used `requireActor()` with no role restriction.  
Fix applied: `await requireActor()` → `await requireActor(['super', 'supervisor'])` (all 3 calls)

---

### `src/app/(app)/tickets/actions.ts`
Status: ~~🚨 Gap~~ → ✅ Fixed  
Issue: `createTicket`, `updateTicketStatus`, `updateTicketFields`, `addTicketComment` used `requireActor()` with no role restriction. (`bulkAssignResolvedTickets` and `deleteTicket` were already protected via `assertRole(actor, ['super', 'supervisor'])`.)  
Fix applied: `await requireActor()` → `await requireActor(['super', 'supervisor'])` (all 6 calls; the existing `assertRole` on bulk/delete are now defense-in-depth)

---

### `src/app/mi-panel/actions.ts`
Status: ✅ Protected  
Uses `auth()` directly with manual role checks per function:
- `createSignatureRequest`: requires `super | supervisor`
- `signDocument`: requires `tecnico`
- `rejectDocument`: requires `tecnico`

---

### `src/app/portal/[slug]/tickets/actions.ts`
Status: ✅ Protected  
- `createPortalTicket`: allows `super | supervisor | client`
- `updatePortalTicket`, `addPortalTicketItem`, `addPortalComment`: require `client` role + own `clientId` scoping

---

### `src/lib/rrhh/actions.ts`
Status: ✅ Protected  
All 6 functions (`createLeaveRequest`, `updateLeaveStatus`, `deleteLeaveRequest`, `upsertPayroll`, `updatePayrollStatus`, `emitPayroll`) use `requireActor(['super', 'supervisor'])`.

---

### `src/app/(app)/gastos/actions.ts`
Status: ✅ Protected (inline policy guards)  
- `createExpense`: open to `tecnico` (submits own expense via `actor.technicianId`) and staff (picks a technician). Role-specific branching inside.
- `updateExpenseStatus`: `canApproveExpense(actor)` check (super/supervisor only)
- `deleteExpense`: `assertTechnicianOwns` for tecnico, `assertRole(['super'])` for deletion by staff

---

### `src/app/(app)/perfil/actions.ts`
Status: ⚠️ Partial  
Issue: `updateProfile` and `changePassword` use `requireActor()` with no role restriction. A `tecnico` with a valid session could call these to update their own profile data.  
Not fixed: Self-modification of own profile/password is not a cross-tenant or privilege escalation risk. `tecnico` has no UI path to this action (app layout blocks them). Add restriction if profile editing is explicitly prohibited for technicians.

---

## Priority 2 — API Routes

### `src/app/api/client-documents/route.ts`
Status: ✅ Protected  
POST, PATCH, GET, DELETE all check `['super', 'supervisor'].includes(session.user.role)`.

---

### `src/app/api/technicians/[id]/documents/route.ts`
Status: ✅ Protected  
POST and DELETE both call `auth()` + `canAccessTenant()` check. Tenant isolation enforced.

---

### `src/app/api/push/subscribe/route.ts`
Status: ✅ Protected (intentionally open to all roles)  
POST and DELETE require `session?.user?.id`. Any authenticated user can manage their own push subscription — correct by design.

---

## Priority 3 — Pages

### `src/app/(app)/rrhh/page.tsx`
Status: ✅ Protected  
`requireActor(['super', 'supervisor'])` — will redirect to `/dashboard` for any other role.

---

### `src/app/(app)/rrhh/liquidaciones/page.tsx`
Status: ✅ Protected  
`requireActor(['super', 'supervisor'])`.

---

### `src/app/(app)/recursos/clientes/[id]/page.tsx`
Status: ✅ Protected  
`requireActor()` under `(app)` layout — `tecnico` and `client` are blocked by the layout before reaching this page.

---

### `src/app/(app)/gastos/page.tsx`
Status: ✅ Protected  
`requireActor()` under `(app)` layout. UI differentiates by role (`canApprove`, `canDelete`, `isStaff`).

---

## Priority 4 — Tecnico Access

### `src/app/mi-panel/page.tsx`
Status: ⚠️ Partial  
`requireActor()` (no role filter) followed by manual `if (actor.role !== 'tecnico') redirect('/dashboard')`. This works but means `super` without a viewas session is redirected to `/dashboard` and cannot access mi-panel directly. If you want `super` to test mi-panel without viewas, change to `requireActor(['tecnico', 'super'])` and remove the manual redirect.  
Fix (optional): Change to `requireActor(['tecnico', 'super'])`.

### `src/app/mi-panel/actions.ts`
Status: ✅ Protected  
Role checks per function (see Priority 1 section above).

---

## Summary

| File | Status | Applied Fix |
|------|--------|-------------|
| flujo/actions.ts | ✅ Fixed | `requireActor(['super', 'supervisor'])` × 8 |
| cronograma/actions.ts | ✅ Fixed | `requireActor(['super', 'supervisor'])` × 3 |
| recursos/clientes/actions.ts | ✅ Fixed | `requireActor(['super', 'supervisor'])` × 7 |
| recursos/tecnicos/actions.ts | ✅ Fixed | `requireActor(['super', 'supervisor'])` × 4 |
| recursos/activos/actions.ts | ✅ Fixed | `requireActor(['super', 'supervisor'])` × 3 |
| recursos/cuadrillas/actions.ts | ✅ Fixed | `requireActor(['super', 'supervisor'])` × 3 |
| recursos/vehiculos/actions.ts | ✅ Fixed | `requireActor(['super', 'supervisor'])` × 3 |
| tickets/actions.ts | ✅ Fixed | `requireActor(['super', 'supervisor'])` × 6 |
| gastos/actions.ts | ✅ Already protected | Inline policy guards |
| mi-panel/actions.ts | ✅ Already protected | Per-function role checks |
| rrhh/actions.ts | ✅ Already protected | `requireActor(['super', 'supervisor'])` |
| portal/tickets/actions.ts | ✅ Already protected | Per-function role checks |
| api/client-documents | ✅ Already protected | Role check in handler |
| api/technicians/documents | ✅ Already protected | auth() + canAccessTenant |
| api/push/subscribe | ✅ Already protected | auth() (all roles intentional) |
| rrhh/page.tsx | ✅ Protected | `requireActor(['super', 'supervisor'])` |
| rrhh/liquidaciones/page.tsx | ✅ Protected | `requireActor(['super', 'supervisor'])` |
| clientes/[id]/page.tsx | ✅ Protected | (app) layout gate |
| gastos/page.tsx | ✅ Protected | (app) layout gate |
| mi-panel/page.tsx | ⚠️ Partial | Manual role check works; super blocked without viewas |
| perfil/actions.ts | ⚠️ Partial | Self-modification only; no cross-tenant risk |
