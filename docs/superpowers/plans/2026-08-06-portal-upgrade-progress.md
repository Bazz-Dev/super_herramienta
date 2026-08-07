# Portal Upgrade — Progress Ledger

Plan source: user's own P0–P5 brief (not a written spec doc — pasted directly in chat 2026-08-06).
Working in place on `main`, no worktree, no branch (same convention as the correlativo plan).
Baseline before this work: `main` @ `2b7a210` (271/271 unit tests green, clean tsc/lint).

This file is the recovery record if context is lost — trust this + `git log` over recollection.

## Phase 0 — Baseline diagnosis: DONE

Diagnosis delivered in chat (2026-08-06). Key findings:
- "Error generando PDF" root cause (portal informes): `portal-informe-btn.tsx`/`portal-informe-list.tsx` POSTed `{ data: JSON.parse(dataJson) }` to `/api/reports/generate`, which expects a FLAT `ReportData` body — every single portal informe download/preview was hitting a 422 unconditionally. Verified empirically via a standalone zod-schema script before touching code.
- Separate, more serious gap found in the same investigation: `/api/reports/generate` AND `/api/quotes/generate` had zero ownership/tenant check — any authenticated `client`-role session could POST an arbitrary `ReportData`/`QuoteData` body and get it rendered, regardless of whether they own it. `/api/portal/informes` and `/api/portal/propuestas` (the GET metadata routes) already had the correct ownership pattern — the generate routes never mirrored it.
- Inactive branch: hidden client-side (`active:true` filter on the new-ticket page query) but never re-checked server-side in `createPortalTicket`.
- `getClientTicket()` doesn't filter by `branchId` in its own query (relies on caller-side redirect-after-fetch) — same bug class as the already-documented G45 incident. Real today only because the one caller checks; a trap for new P1/P1B code.
- `deleteBranch` exists in a second, separate module (`src/app/(app)/flujo/actions.ts:86`) not yet inspected for a historical-dependency guard (unlike `deleteClient`, which has one).
- No server-side idempotency guard on `createPortalTicket` (double-submit).
- Full findings + reusable-component inventory + risk list are in the chat transcript (2026-08-06); not duplicated here to avoid a second source of truth mid-flight — re-derive from `git log` commit bodies below if this ledger and the transcript ever disagree, git wins.

## P0 — Blockers, security, data integrity: IN PROGRESS

### P0.1 — `/api/reports/generate` + `/api/quotes/generate` ownership check + PDF root cause: DONE, live-verified

Files changed (not yet committed as of this ledger write):
- `src/app/api/reports/generate/route.ts` — `role === 'client'` now requires `{ documentId }`, re-derives+re-verifies `ClientDocument` server-side (`type: 'informe', clientId`) instead of trusting the POST body. Staff (`super`/`supervisor`) branch unchanged — still sends live/draft `ReportData` directly.
- `src/app/api/quotes/generate/route.ts` — identical treatment, `type: 'propuesta'`.
- `src/components/tickets/portal-informe-btn.tsx`, `portal-informe-list.tsx` — now POST `{ documentId: docId }` instead of `{ data: JSON.parse(dataJson) }` (the actual root-cause bug — this shape never matched `reportDataSchema`).
- `src/components/tickets/portal-propuesta-list.tsx` — now POSTs `{ documentId: docId }` instead of the raw `dataJson` string (this one wasn't hitting the visible bug — quotes' schema happened to match — but had the identical ownership gap, fixed for consistency, "avoid duplicated business logic").
- `src/lib/reports/pdf.ts` (`inlineUrl`) + `src/lib/quotes/pdf.ts` (`inlineUrl`) — silent `catch { return url }` on a broken/missing R2 image now logs via `console.error` before falling back (still degrades gracefully, one broken photo doesn't kill the PDF — now at least it's diagnosable).

**Live-verified** (headless credentials-flow script against local dev server, real `dev.db`, `carolina@justburger.cl` — password reset locally to `LocalTest@2026` since the documented default in `docs/users.md` doesn't match local `dev.db`, same known pre-existing mismatch as the correlativo plan's Task 8/12 — this is a good thing to have working locally now, left as-is):
1. Own valid informe → `200`, real 609KB `%PDF` — confirms root-cause fix.
2. Cross-client informe (Decathlon doc, logged in as Just Burger) → `404 "Informe no encontrado."` — confirms ownership check.
3. Legacy informe with incomplete `dataJson` (`{photos:[]}` only, missing required `reportId`/`date`/`client`) → `422`, not a `500` crash. **Note**: this is a pre-existing DATA quality issue in specific historical records (already flagged in the previous plan's Task 5 ledger note), not a bug in this fix. The internal `/informe` editor has its own established fallback for this (`{ ...sampleReport, ...raw }`) but that's an editing-convenience fallback with REAL placeholder content (a real sample report body) — silently applying it to a client-facing PDF *download* would show fabricated content as if real, which is worse than a clear error. Did NOT apply that fallback here; flagged as a backlog item instead (see P0 backlog below) to give the client-facing error message more specific wording for this exact case.
4. Forged raw `ReportData`/`QuoteData` body with no `documentId` (old attack shape) → `400 "Falta documentId."` — confirms the old open surface is closed.
5. Staff (`super`) live-editor draft `ReportData`, unchanged shape → `200`, real PDF — confirms zero regression on the internal editor's existing flow.
6. Same cross-client + forged-body checks repeated against `/api/quotes/generate` with a real Autoplanet propuesta while logged in as Just Burger → `404`/`400` as expected.

Verification commands run this session: `npx tsc --noEmit` (clean), `npx eslint <touched files>` (clean), `node --import tsx --test tests/unit/pdf.test.ts tests/unit/report.test.ts` (16/16 pass, no regressions).

**Not yet done for this sub-item**: commit. Holding the commit until more of P0 lands, per "targeted tests during implementation, full suite only at major gates" — will commit once the next 2–3 P0 fixes are in, run the full suite once, then commit as one coherent P0 slice (or split if a natural boundary appears). Re-evaluate if this grows too large uncommitted.

**Backlog (not fixed now, tracked)**:
- B1: Client-facing error message for a structurally-incomplete informe (`reportDataSchema` fails on a real DB row, not attacker-forged) should say something more specific than the generic "Error generando PDF" — e.g. surface the 422 distinctly so the UI can show "Este informe no tiene contenido completo, contacta a INGEGAR" instead of implying a transient failure worth retrying. Small, deferred to avoid scope creep on the ownership fix itself.
- B2: How many real (Turso prod) `ClientDocument` rows of type `informe`/`propuesta` currently have incomplete `dataJson` and would 422 under the new strict check is UNKNOWN — only checked locally. Worth a read-only count against Turso prod before considering this fully closed (see P0 gate checklist).

### P0.2 — Inactive-branch server-side enforcement: DONE

`src/app/portal/[slug]/tickets/actions.ts`: branch lookup now filters `active: true`; if `branchId` was given but doesn't resolve (inactive, nonexistent, or wrong client — all three cases, not just inactive), the whole ticket creation is now rejected instead of silently proceeding with a `'SUCURSAL'` fallback name while still recording the invalid `branchId`. Verified via a direct deactivate → query (confirms `null`) → reactivate round-trip against a real Just Burger branch (`Lo Barnechea`) — no lasting side effect left on the DB.

### P0.3 — `deleteBranch` historical-dependency guard: DONE, real gap confirmed and closed

`src/app/(app)/flujo/actions.ts` `deleteBranch()` only counted `Job` (which has `onDelete: Restrict` at the DB level anyway — the count was defense-in-depth against a raw Prisma 500, per its own G35 comment). **Confirmed via the actual migration SQL** (`prisma/migrations/20260624120000_.../migration.sql:40`) that `Ticket.branchId`'s real FK is `ON DELETE SET NULL` — deleting a branch with real ticket history would have silently orphaned every one of those tickets' branch reference (no error, no block) instead of preserving it, directly violating the brief's "branch with history cannot be deleted." Added the same count-and-block pattern for `Ticket` (counts ALL tickets ever linked, including soft-deleted — still real history). Verified the exact query against a real branch with 1 real ticket (`Isidora`) — confirmed it would block.

### P0.4 — Double-submit guard on `createPortalTicket`: DONE

No schema/contract change (no new hidden field) — a 5-second-window near-duplicate check (same `clientId`+`branchId`+`createdById`+`title`+`description`) returns the just-created ticket instead of making a second one. Verified against a real freshly-created-then-immediately-queried test ticket (cleaned up after).

### P0.5 — `getClientTicket()` branch-scoping hardening: DONE

Added optional `branchId` param, same shape as `getClientTickets()`. Purely additive — the one existing caller (`portal/[slug]/tickets/[id]/page.tsx`) is untouched (still does its own after-fetch redirect, unchanged UX). Exists so P1/P1B's new consumers of this function can't forget the branch check the project already got bitten by once (G45).

**Commit for P0.1–P0.5: `a9c4f48`** — `npx tsc --noEmit`, `npm run lint`, `npm run test:unit` (271/271), `npm run build` all clean at this checkpoint. Also smoke-tested the real portal ticket-detail page (`getClientTicket`'s signature changed) end-to-end via the headless session — `200`, no regression.

### P0.6 — Full P0 gate: DONE

All 5 test scenarios from the brief live-verified against local `dev.db`:
1. Valid PDF → `200`, real `%PDF` bytes (own informe).
2. Missing/corrupt PDF → legacy informe with incomplete `dataJson` → `422`, not a `500` crash.
3. Historical report → a real ~3-month-old informe (`260519-JB-PR-78`) → `200`, real PDF.
4. Unauthorized user → cross-client informe request → `404`.
5. Storage/access failure → created a throwaway informe with a photo pointing at a nonexistent R2 key, requested it → `200` (graceful degrade, PDF still generated), **and confirmed the new logging actually fired**: `[reports/pdf] No se pudo bajar la imagen de R2 (key=...): NoSuchKey: The specified key does not exist.` in the dev server log. Throwaway document deleted after.

**P0 GATE: PASSED.** Proceeding to P1.

### Not done, explicitly deferred (documented, not blocking)

- Real Vercel runtime-log check for `/api/reports/generate`/`/api/quotes/generate` failure patterns (per `testing.md`'s rule to confirm root cause against real prod evidence) — Vercel MCP token expired, tried again, still expired. Needs the owner to re-authorize the Vercel plugin; not re-attempted a third time to avoid spinning on it. The local root-cause finding (the `{data:...}` wrapping bug) is deterministic and 100%-reproducing by construction — it doesn't actually need prod log confirmation to be certain, unlike a heisenbug would. This deferral is about the *separate* question of whether prod has additional intermittent Chromium cold-start failures on top of the fixed bug — worth checking once the token is live again, not urgent.
- Backlog B1 (specific client-facing error message for structurally-incomplete informes) / B2 (count of real Turso-prod rows that would 422 under the new strict check) remain open, not blocking.

## P1 — Ticket as document hub + P1B informes library: IN PROGRESS

Target section order per brief: Information → Status → Description → Conversation → Media → OT → Technical Reports → Other Documents. Read the full 589-line ticket-detail page (`src/app/portal/[slug]/tickets/[id]/page.tsx`) before touching anything — confirmed Information/Status/Description/Conversation/Media were already in the right relative order; only OT (missing entirely), Technical Reports (download-only, no preview), and Other Documents (plain `<a target=_blank>`, no preview) needed work.

### P1.1 — Shared preview component + OT/Technical-Reports/Other-Documents: DONE

Commit `01f64db`. New `src/components/tickets/portal-document-preview.tsx` — portal-styled equivalent of the internal app's `FilePreviewButton` (same HEAD-check-before-preview + blob-based-download logic) but inline-styled — **deliberately not a reuse of `FilePreviewButton` itself**, since that component is 100% Tailwind `className` and `frontend.md` bans that in the portal without exception (already-documented CSS-var unreliability under portal dark mode, `feedback_portal_css`). Split into `PortalDocumentPreviewModal` (controlled, `open`/`onClose`) + `PortalDocumentPreview` (owns its own trigger+state) because informes need the controlled form — the PDF is generated on-demand via `/api/reports/generate`, not a fixed input URL known upfront.

- New "Orden de trabajo" section: `otNumber`, `assignedTo.name`, `closedDate` (when set), Preview+Download. Deliberately did NOT invent an "OT date"/"OT status" schema field — neither exists, and inventing one violates "no destructive migrations". The ticket's own status badge (already in the hero) is the real proxy for "status" here.
- `PortalInformeBtn` gained a "Ver" preview action next to "Descargar", both sharing one `resolveUrl()` (uploaded-file informe → direct `viewUrl`; generated → `/api/reports/generate` with `{ documentId }`, same P0 ownership fix).
- Other Documents: plain links replaced with `PortalDocumentPreview` — PDF/image preview in-app, everything else still downloads securely.

Verified: `tsc`/`lint`/`test:unit` (271/271) clean. Live smoke-tested via the headless session against 2 real tickets (one with a real OT file, one with real non-media documents) — both `200`, sections render correctly/conditionally.

### P1.2 — PhotoGallery enhancements: DONE

Commit `23c1a72`. `mediaItems` (images+videos) replaces `imgItems` (images-only) as the lightbox-navigable set — a video tile used to fall through to `window.open(rawUrl)`; now plays inline via `<video controls autoPlay>`. Click-to-zoom on photos (resets on navigation). Thumbnail strip gained `loading="lazy"` — it was unconditionally rendering every thumbnail regardless of count, a real gap against the brief's explicit "avoid loading large collections unnecessarily into memory" + the P1 gate's own named "30+ photos" test case. Download (lightbox + thumbnails) switched from `<a href download>` (silently ignored by browsers on a cross-origin presigned R2 URL without `Content-Disposition:attachment` — same bug class as `FilePreviewButton`) to blob-fetch-then-download, with a `window.open` fallback on fetch failure. No interface change — both callers (portal ticket detail, internal `ticket-controls.tsx`) untouched. Verified: `tsc`/`lint`/`test:unit` (271/271) clean; live smoke-tested both callers against a real ticket with photos.

### Remaining P1B work (not started)

- `/portal/[slug]/informes` is currently a bare list + individual download only (confirmed in Phase 0 diagnosis) — needs branch filter, date range, quick periods, search by report/ticket/OT, clear filters, result count, checkbox selection ("select visible", explicit scope — never silently select hidden results), bulk ZIP download. Will reuse the `proposals-table.tsx` selection-pattern (Set-based, membership-check select-all, conditional bulk-action bar) and adapt `filter-bar.tsx`/`date-range-filter.tsx`'s URL-param logic to inline styles (can't reuse those components directly either, same Tailwind-in-portal issue).
- "Never regenerate an existing PDF just for preview/download" (P1B requirement): **not implemented** — there is no PDF cache anywhere in this codebase today (every preview/download always calls `generateReportPdf`/`generateQuotePdf` fresh). Building a real cache (store generated bytes in R2 keyed by doc+content-version, invalidate on edit) is a genuine architecture addition, not a "smallest safe change" — deliberately deferring this to a documented backlog item rather than rushing it in, same reasoning as backlog B1/B2. Flag for the owner: worth its own scoped pass once P1B's UI lands, not blocking it.
- P1 GATE not yet run: live walkthrough of individual/multiple reports, OT, media, ZIP, missing file, 30+ photos, combined filters, permissions.

## P2–P5: NOT STARTED

Task list entries (harness TaskList #124-#130) track phase-level status; this file is the detailed recovery record within P0. Will add a "## P1 —" section here once P0's gate is actually passed and P1 begins, following the same format.

## Local environment notes for whoever resumes this

- Dev server: local SQLite (`DATABASE_URL=file:./prisma/dev.db`), started via `npm run dev` in background. Known instability class this session (recurs across this whole multi-day engagement): Next.js dev server occasionally returns "An unexpected response was received from the server" / crashes on a Server Action call — fix is always the same, `taskkill //F //PID <pid>` on whatever holds port 3000, restart `npm run dev`, poll `/login` for 200.
- `carolina@justburger.cl` (Just Burger client-admin) password locally reset to `LocalTest@2026` for testing — documented default in `docs/users.md` (`JustBurger@2026`) still does not match local `dev.db`, same pre-existing unresolved mismatch flagged since the correlativo plan's Task 8.
- Client-side login-form testing via browser automation is unreliable in this environment for this app specifically — the visible username/password fields don't respond to a plain `.fill()`/synthetic-event approach reliably (React state desync observed, cause not fully root-caused, not worth further time). The reliable path used here: a headless Node script driving NextAuth's own `/api/auth/csrf` → `/api/auth/callback/credentials` → session-cookie flow directly, bypassing the browser UI entirely. Reuse this pattern for any future client-role live verification in this engagement instead of re-fighting the browser form.
- Also: this app's server-side `/api/auth/signout` does NOT reliably clear the JWT cookie (already documented in the project's own `CLAUDE.md` — client-side `signOut` from `next-auth/react` is required). Irrelevant to the headless-script approach above (which never needs to sign out — every `login()` call gets a fresh cookie jar), but relevant if anyone drives this via a real browser again.
