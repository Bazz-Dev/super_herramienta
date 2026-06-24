# ClientOps Module — Design Spec

**Goal:** Integrate the Just Burger maintenance ticketing system into the INGEGAR platform as a reusable client portal module, eliminating double data entry and centralizing all operational history in Turso.

**Architecture:** Single Next.js app, two surfaces — `/tickets` for INGEGAR staff (amber/Inter branding), `/portal/[slug]` for clients (client-specific CSS tokens). Shared Turso DB with two-layer scoping: `tenantId` (INGEGAR) + `clientId` (JB, etc.). Google Drive via Service Account for file storage per ticket.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + Turso, Auth.js v5 (`client` role), Google Drive API v3 (Service Account), Tailwind CSS v4 tokens per portal.

---

## Global Constraints

- UI en español, código en inglés
- `client` role users only see their own `clientId` data — enforced at query level
- `isInternal: true` history entries never returned to client-facing routes
- `internalNotes` field never serialized to client API responses
- Drive folder created automatically on ticket creation — URL stored in `driveFolderUrl`
- Ticket codes preserved exactly from GAS (e.g. `260512-JB-EM1-MACHALI`)
- INGEGAR internal views: amber brand (`bg-brand`, `text-ink`, Inter)
- Client portal views: CSS tokens from `Client.portalTheme` JSON
- No double data entry: closing a ticket pre-fills the Job in cashflow

---

## Data Model

### New Prisma models

```prisma
model Ticket {
  id            String    @id @default(cuid())
  ticketCode    String    @unique
  title         String
  description   String?
  urgency       TicketUrgency @default(no_urgente)
  category      String?
  status        TicketStatus  @default(nuevo)
  otNumber      String?
  estimatedDate DateTime?
  closedDate    DateTime?
  workSummary   String?
  clientComment String?
  internalNotes String?   // NEVER sent to client
  driveFolderUrl String?
  parentTicketId String?
  showToClient  Boolean   @default(true)
  tenantId      String
  clientId      String
  branchId      String?
  createdById   String
  assignedToId  String?
  jobId         String?   @unique  // link to cashflow Job on close
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  client        Client    @relation(fields: [clientId], references: [id], onDelete: Restrict)
  branch        Branch?   @relation(fields: [branchId], references: [id])
  createdBy     User      @relation("TicketCreatedBy", fields: [createdById], references: [id])
  assignedTo    User?     @relation("TicketAssignedTo", fields: [assignedToId], references: [id])
  job           Job?      @relation(fields: [jobId], references: [id])
  history       TicketHistory[]
  items         TicketItem[]
  documents     TicketDocument[]
  collaborators TicketCollaborator[]

  @@index([tenantId])
  @@index([clientId])
  @@index([status])
  @@map("tickets")
}

enum TicketUrgency {
  emergencia
  urgencia
  no_urgente
  preventivo
}

enum TicketStatus {
  nuevo
  en_revision
  en_ejecucion
  esperando_aprobacion
  resuelto
  cancelado
  fusionado
}

model TicketHistory {
  id         String   @id @default(cuid())
  ticketId   String
  userId     String?
  fromStatus String?
  toStatus   String?
  note       String?
  isInternal Boolean  @default(false)
  createdAt  DateTime @default(now())

  ticket     Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  user       User?    @relation(fields: [userId], references: [id])

  @@index([ticketId])
  @@map("ticket_history")
}

model TicketItem {
  id          String     @id @default(cuid())
  ticketId    String
  title       String
  description String?
  status      ItemStatus @default(pendiente)
  order       Int        @default(0)
  createdAt   DateTime   @default(now())

  ticket      Ticket     @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId])
  @@map("ticket_items")
}

enum ItemStatus {
  pendiente
  en_proceso
  resuelto
}

model TicketDocument {
  id         String   @id @default(cuid())
  ticketId   String
  uploadedById String?
  name       String
  fileUrl    String   // Drive link
  mimeType   String?
  uploadedAt DateTime @default(now())

  ticket     Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  uploadedBy User?    @relation(fields: [uploadedById], references: [id])

  @@index([ticketId])
  @@map("ticket_documents")
}

model TicketCollaborator {
  id           String @id @default(cuid())
  ticketId     String
  technicianId String

  ticket       Ticket     @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  technician   Technician @relation(fields: [technicianId], references: [id])

  @@unique([ticketId, technicianId])
  @@map("ticket_collaborators")
}
```

### Client model additions
- `portalTheme String?` — JSON: `{ primary, secondary, bg, card, text }`
- `driveFolderId String?` — root Drive folder ID for this client
- `portalSlug String? @unique` — URL slug (e.g. `justburger`)
- `tickets Ticket[]` — back-relation

### Branch model addition
- `city String?` — ciudad de la sucursal

### Job model addition
- `ticket Ticket?` — back-relation (optional 1:1 link)

---

## Route Structure

### Internal (INGEGAR CSS)
```
/tickets                    — kanban: Nuevo | En Revisión | En Ejecución | Resuelto
/tickets/[id]               — detail: full controls, internal notes, assign, close
```

### Client Portal (client CSS tokens)
```
/portal/[slug]              — login page (client branding)
/portal/[slug]/tickets      — ticket list
/portal/[slug]/tickets/new  — create ticket
/portal/[slug]/tickets/[id] — detail: public history + docs only
```

---

## Navigation (sidebar)

New section "Clientes" added below Flujo de Caja:
```
— Tickets          /tickets     (TicketIcon)
— Portal Clientes  link group showing active client portals
```

---

## Security Rules

| Role | Can see | Cannot see |
|------|---------|------------|
| super/supervisor | All tickets, all clients, internal notes | — |
| client (JB) | Only tickets where clientId = session.clientId | internalNotes, other clients |

`clientPortalScope(session)` helper returns `{ clientId: session.clientId }` for where clauses.

---

## Automation (zero extra work for team)

| Trigger | Automatic action |
|---------|-----------------|
| Ticket created | Drive folder created → `driveFolderUrl` saved |
| Technician assigned | Status → `en_revision` |
| First history entry as advance | Status → `en_ejecucion` |
| Ticket closed | PDF IT generated → saved to Drive folder |
| OT assigned on close | Job pre-populated in cashflow |

---

## Phases

**Phase 1 — Internal tickets** (this session): Schema + migration + nav menu + `/tickets` kanban + `/tickets/[id]`

**Phase 2 — Client portal**: `/portal/[slug]` layout + login + JB branding tokens + ticket CRUD for client

**Phase 3 — Drive integration**: Google Service Account, auto-folder creation, doc upload to Drive

**Phase 4 — Cashflow link**: Close ticket → create Job pre-filled

---

## JB Branding Tokens

```json
{
  "primary": "#E52432",
  "secondary": "#FFC107",
  "bg": "#1a1a2e",
  "card": "#16213e",
  "text": "#e0e0e0",
  "accent": "#0f3460"
}
```

---

## Migration: GAS → Turso

Script: `scripts/import-justburger.ts`

Maps `Fuente_Datos_Trabajos_JustBurger.xlsx` columns directly to Ticket model. `ticketCode` preserved exact. Branches created if not exist. `driveFolderUrl` copied from `Carpeta_Drive` column — Drive folders untouched.
