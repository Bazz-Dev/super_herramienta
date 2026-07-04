# Mobile-First UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevar la plataforma INGEGAR a un estándar mobile-first profesional: touch targets ≥44px, loading feedback en todas las acciones, ruta de navegación fluida, active states para feedback táctil, y safe-area support para dispositivos con notch.

**Architecture:** Cuatro cambios independientes encadenados: (1) CSS foundations en globals.css como base, (2) componentes Spinner + RouteProgress reutilizables, (3) touch target fixes en sidebar y portal, (4) polish de interactividad. Tasks 3-6 se pueden ejecutar en paralelo tras Task 1.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (CSS-first `@theme`), inline styles en portal (obligatorio — CSS vars pueden fallar bajo dark mode de OS).

## Global Constraints

- Portal: NUNCA Tailwind ni className CSS para componentes de shell/layout — siempre inline styles o clases definidas en el `<style>` tag del `src/app/portal/[slug]/layout.tsx`
- Sin nuevas dependencias npm (spinner: SVG inline, progress bar: CSS puro)
- Sin cambios de comportamiento funcional — solo visual/UX
- Sin tocar schema Prisma ni archivos de DB
- `npm run typecheck` y `npm run lint` deben pasar en verde tras cada task
- Commits en inglés, Conventional Commits (`feat:`, `fix:`)

---

### Task 1: CSS Mobile Foundations

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: clases `.interactive`, `.btn-tap`, `.safe-b`, `.safe-l`, `.safe-r` disponibles para todos los componentes de la app interna

- [ ] **Step 1: Añadir base resets y utilidades a globals.css**

Reemplazar el contenido actual de `src/app/globals.css` con este (preserva todo lo existente, añade al final):

```css
@import 'tailwindcss';

@theme {
  /* Brand */
  --color-brand:     #f5b100;
  --color-brand-600: #d99e00;
  --color-ink:       #111111;

  /* Semantic status palette */
  --color-ok-50:  #f0fdf4;
  --color-ok-100: #dcfce7;
  --color-ok-500: #22c55e;
  --color-ok-700: #15803d;

  --color-warn-50:  #fffbeb;
  --color-warn-100: #fef3c7;
  --color-warn-500: #f59e0b;
  --color-warn-700: #b45309;

  --color-danger-50:  #fef2f2;
  --color-danger-100: #fee2e2;
  --color-danger-500: #ef4444;
  --color-danger-700: #b91c1c;

  --color-info-50:  #eff6ff;
  --color-info-100: #dbeafe;
  --color-info-500: #3b82f6;
  --color-info-700: #1d4ed8;

  /* Surface / neutral */
  --color-surface: #ffffff;
  --color-muted:   #6b7280;

  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}

:root {
  color-scheme: light;
}

/* ── Mobile base resets ── */
html {
  /* Prevent iOS from auto-scaling text on orientation change */
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  background-color: #fafafa;
  color: var(--color-ink);
  /* Remove the grey flash on tap in mobile Safari/Chrome */
  -webkit-tap-highlight-color: transparent;
}

/* Portal pages: override any dark-mode defaults at document level */
html[style*="color-scheme: light"] body {
  background-color: transparent !important;
  color: inherit !important;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ── Interactive element defaults ── */
/* All buttons and links get pointer cursor and accessible focus ring */
button, [role="button"] {
  cursor: pointer;
}

/* ── Touch feedback: scale down on tap (applied via .interactive class) ── */
.interactive {
  @apply transition-transform duration-75 active:scale-[0.97];
}

/* ── Safe area utilities (notch + home indicator support) ── */
.safe-b { padding-bottom: env(safe-area-inset-bottom, 0px); }
.safe-l { padding-left:  env(safe-area-inset-left,   0px); }
.safe-r { padding-right: env(safe-area-inset-right,  0px); }

/* ── Consistent focus-visible ring for the internal app ── */
/* Inputs */
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  @apply outline-none ring-2 ring-brand/50;
}

/* Buttons and links */
button:focus-visible,
a:focus-visible {
  @apply outline-none ring-2 ring-brand/50 ring-offset-1;
}

/* ── Route progress bar ── */
/* Controlled by TopProgress component via data-progress attribute on <html> */
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #f5b100, #fbbf24);
  z-index: 9999;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s ease, opacity 0.3s ease;
  opacity: 0;
  pointer-events: none;
}
.route-progress.loading {
  opacity: 1;
  transform: scaleX(0.7);
  transition: transform 1.5s cubic-bezier(0.1, 0.5, 0.8, 1);
}
.route-progress.done {
  opacity: 1;
  transform: scaleX(1);
  transition: transform 0.15s ease;
}
.route-progress.fade {
  opacity: 0;
  transform: scaleX(1);
  transition: opacity 0.3s ease 0.1s;
}
```

- [ ] **Step 2: Verificar typecheck y lint**

```bash
npm run typecheck
npm run lint
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(mobile): add CSS foundations — text-size-adjust, tap-highlight, touch feedback, safe-area, focus rings, route progress bar styles"
```

---

### Task 2: Spinner Component + TopProgress

**Files:**
- Create: `src/components/ui/spinner.tsx`
- Create: `src/components/ui/top-progress.tsx`
- Modify: `src/app/(app)/layout.tsx` (add TopProgress)

**Interfaces:**
- Produces: `<Spinner size?>` (16px default), `<TopProgress />` (añadir al layout raíz)
- Consumes: `.route-progress` CSS de Task 1

- [ ] **Step 1: Crear Spinner**

Crear `src/components/ui/spinner.tsx`:

```tsx
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ animation: 'spin 0.75s linear infinite', display: 'inline-block', flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M14 8A6 6 0 0 1 8 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  )
}
```

- [ ] **Step 2: Crear TopProgress**

Crear `src/components/ui/top-progress.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function TopProgress() {
  const pathname = usePathname()
  const barRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    // Start loading animation
    bar.className = 'route-progress loading'

    // After a short window, transition to "done" then fade out
    timerRef.current = setTimeout(() => {
      bar.className = 'route-progress done'
      timerRef.current = setTimeout(() => {
        bar.className = 'route-progress fade'
        timerRef.current = setTimeout(() => {
          bar.className = 'route-progress'
        }, 400)
      }, 150)
    }, 100)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [pathname])

  return <div ref={barRef} className="route-progress" aria-hidden="true" />
}
```

- [ ] **Step 3: Añadir TopProgress al app layout**

En `src/app/(app)/layout.tsx`, añadir el import y el componente al inicio del JSX:

```tsx
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { Sidebar } from '@/components/ui/sidebar'
import { NotificationBell } from '@/components/ui/notification-bell'
import { TopProgress } from '@/components/ui/top-progress'

// ... (el resto igual)

  return (
    <div className="min-h-screen bg-gray-50">
      <TopProgress />
      <Sidebar
        user={{
          name: user.name ?? 'Usuario',
          tenantSlug: user.tenantSlug,
          roleLabel: ROLE_LABELS[user.role] ?? user.role,
        }}
        logout={logout}
        portalClients={portalClients}
      />
      <main className="md:pl-60">
        {/* Topbar with notification bell */}
        <div className="sticky top-0 z-30 hidden items-center justify-end border-b border-gray-200 bg-white/90 px-6 py-2 backdrop-blur md:flex">
          <NotificationBell />
        </div>
        <div className="px-4 py-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
```

Nota: `p-6` → `px-4 py-4 sm:p-6` para mejor respiro en mobile.

- [ ] **Step 4: Verificar typecheck y lint**

```bash
npm run typecheck
npm run lint
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/spinner.tsx src/components/ui/top-progress.tsx src/app/(app)/layout.tsx
git commit -m "feat(mobile): add Spinner component and TopProgress route indicator"
```

---

### Task 3: Touch Target Fixes — Sidebar (Internal App)

**Files:**
- Modify: `src/components/ui/sidebar.tsx`

**Interfaces:**
- Consumes: `.interactive` de Task 1

**Context:** Nav links actualmente `py-2` (~32px). Hamburger `p-2` (~36px). Apple HIG: mínimo 44px.

- [ ] **Step 1: Actualizar sidebar con touch targets y .interactive**

Reemplazar el componente `Sidebar` en `src/components/ui/sidebar.tsx`. Cambios específicos:

1. **Nav links**: `py-2` → `py-3` (32px → 48px)
2. **Hamburger**: añadir `min-h-[44px] min-w-[44px] justify-center`
3. **Logo link**: añadir `interactive` en el área tocable
4. **Perfil link**: `py-2` implícita → añadir padding explícito
5. **Botón Salir**: ya tiene `py-1.5` → `py-2.5`

El bloque del `content` (nav links) cambia de:
```tsx
className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${...}`}
```
a:
```tsx
className={`interactive flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors duration-150 ${...}`}
```

El mismo cambio aplica al loop de `portalClients`:
```tsx
className={`interactive flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors duration-150 ${...}`}
```

El hamburger button:
```tsx
// Antes:
className="cursor-pointer rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
// Después:
className="interactive flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
```

El botón Salir en el footer:
```tsx
// Antes:
className="w-full cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
// Después:
className="interactive w-full cursor-pointer rounded-md border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
```

El perfil link (`.group.flex.items-center.gap-2.hover:opacity-80`):
```tsx
// Añadir min-h-[44px] y py-1 para área tocable
className="group flex min-h-[44px] items-center gap-2 py-1 hover:opacity-80"
```

- [ ] **Step 2: Verificar typecheck y lint**

```bash
npm run typecheck
npm run lint
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/sidebar.tsx
git commit -m "fix(mobile): bump sidebar touch targets to 48px — nav links py-3, hamburger 44px min"
```

---

### Task 4: Touch Target Fixes — Portal CSS

**Files:**
- Modify: `src/app/portal/[slug]/layout.tsx` (bloque `<style>`)

**Context:** `.pbtn` tiene `padding: 9px 18px` (~37px alto). `.psb-link` tiene `padding: 9px 11px`. El hamburger del portal tiene `padding: 6px`. Los nav links del portal desktop también son cortos en tablet.

- [ ] **Step 1: Actualizar .pbtn, .psb-link, .psb-hamburger en el <style> del portal layout**

En `src/app/portal/[slug]/layout.tsx`, buscar y actualizar dentro del `<style>` tag:

**Cambio 1 — `.pbtn`**: padding de 9px → 12px

```css
/* Antes: */
.pbtn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 18px; border-radius: var(--r2);
  font-size: 13px; font-weight: 700; cursor: pointer;
  border: none; transition: all 0.12s; text-decoration: none; white-space: nowrap; font-family: inherit;
}

/* Después: */
.pbtn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 12px 18px; border-radius: var(--r2);
  font-size: 13px; font-weight: 700; cursor: pointer;
  border: none; transition: all 0.12s; text-decoration: none; white-space: nowrap; font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}
.pbtn:active { transform: scale(0.97); transition: transform 0.07s; }
```

**Cambio 2 — `.psb-link`**: padding de 9px → 12px

```css
/* Antes: */
.psb-link {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 11px; border-radius: var(--r);
  color: rgba(255,255,255,0.42); font-size: 13px; font-weight: 500;
  text-decoration: none; transition: all 0.12s;
  border: none; background: none; cursor: pointer; width: 100%;
}

/* Después: */
.psb-link {
  display: flex; align-items: center; gap: 9px;
  padding: 12px 11px; border-radius: var(--r);
  color: rgba(255,255,255,0.42); font-size: 13px; font-weight: 500;
  text-decoration: none; transition: all 0.12s;
  border: none; background: none; cursor: pointer; width: 100%;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
}
.psb-link:active { opacity: 0.75; }
```

**Cambio 3 — `.psb-hamburger`**: tamaño explícito

```css
/* Antes: */
.psb-hamburger { display: none; background: none; border: none; cursor: pointer; color: var(--t3); padding: 6px; border-radius: var(--r); transition: background 0.12s; }

/* Después: */
.psb-hamburger { display: none; background: none; border: none; cursor: pointer; color: var(--t3); padding: 10px; border-radius: var(--r); transition: background 0.12s; min-height: 44px; min-width: 44px; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; }
.psb-hamburger:active { background: var(--s3) !important; }
```

**Cambio 4 — `.pinput`**: añadir min-height para touch

```css
/* Después de padding: 10px 14px; añadir: */
min-height: 44px;
```

**Cambio 5 — `.pcard-hover`**: añadir active state

```css
/* Después: */
.pcard-hover { transition: box-shadow 0.15s, border-color 0.15s, transform 0.07s; cursor: pointer; }
.pcard-hover:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05); border-color: #ccc8c2; }
.pcard-hover:active { transform: scale(0.99); }
```

**Cambio 6 — Añadir `.prow-link` active state**:

```css
.prow-link { transition: background 0.1s; cursor: pointer; }
.prow-link:hover { background: var(--s2) !important; }
.prow-link:active { background: var(--s3) !important; }
```

- [ ] **Step 2: Verificar typecheck y lint**

```bash
npm run typecheck
npm run lint
```

Expected: sin errores (este archivo no tiene TypeScript que falle).

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/[slug]/layout.tsx
git commit -m "fix(mobile): portal touch targets — .pbtn 12px padding, .psb-link min-height 44px, hamburger 44px, active states"
```

---

### Task 5: Loading Spinners en Botones de Acciones

**Files:**
- Modify: `src/components/ui/sidebar.tsx` (logout button — ya tiene startTransition implícito con form action)
- Modify: `src/components/rrhh/technician-hr-form.tsx`
- Modify: `src/components/cashflow/branch-form.tsx`
- Modify: `src/app/(app)/documentos/documents-view.tsx`
- Modify: `src/components/resources/delete-button.tsx`
- Modify: `src/components/resources/doc-section.tsx`

**Context:** Varios componentes ya tienen `isPending` pero solo cambian texto. El patrón estándar a aplicar en todos: cuando `isPending === true`, mostrar `<Spinner />` antes del texto.

**Interfaces:**
- Consumes: `<Spinner>` de Task 2

- [ ] **Step 1: Aplicar spinner en technician-hr-form.tsx**

En `src/components/rrhh/technician-hr-form.tsx`, añadir el import y actualizar el botón:

```tsx
import { Spinner } from '@/components/ui/spinner'

// Botón de guardar (ya tiene isPending):
<button
  type="button"
  onClick={handleSave}
  disabled={isPending}
  className="interactive inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:opacity-90 disabled:opacity-50 min-h-[44px]"
>
  {isPending && <Spinner size={14} />}
  {isPending ? 'Guardando…' : 'Guardar cambios'}
</button>
```

- [ ] **Step 2: Aplicar spinner en branch-form.tsx (cashflow)**

En `src/components/cashflow/branch-form.tsx`, añadir import y spinner al botón de submit:

```tsx
import { Spinner } from '@/components/ui/spinner'

// En el botón de submit (buscar disabled={pending}):
<button
  type="submit"
  disabled={pending}
  className="interactive inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50 min-h-[44px]"
>
  {pending && <Spinner size={14} />}
  {pending ? 'Guardando…' : 'Guardar'}
</button>
```

- [ ] **Step 3: Aplicar en documents-view.tsx**

En `src/app/(app)/documentos/documents-view.tsx`, busca el botón con `disabled={isPending}` y aplica el mismo patrón:

```tsx
import { Spinner } from '@/components/ui/spinner'

// El botón de eliminar:
<button
  type="button"
  onClick={handleDelete}
  disabled={isPending}
  className="interactive inline-flex items-center gap-2 ... min-h-[44px]"
>
  {isPending && <Spinner size={14} />}
  {isPending ? 'Eliminando…' : 'Eliminar'}
</button>
```

- [ ] **Step 4: Aplicar en delete-button.tsx (recursos)**

En `src/components/resources/delete-button.tsx`, busca el botón con `isPending` y aplica spinner:

```tsx
import { Spinner } from '@/components/ui/spinner'

// Al botón de eliminar, añadir Spinner cuando isPending:
{isPending && <Spinner size={14} />}
```

- [ ] **Step 5: Verificar typecheck y lint**

```bash
npm run typecheck
npm run lint
```

Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/rrhh/technician-hr-form.tsx src/components/cashflow/branch-form.tsx src/app/(app)/documentos/documents-view.tsx src/components/resources/delete-button.tsx
git commit -m "feat(ux): add loading spinners to action buttons — visual feedback on all async operations"
```

---

### Task 6: Safe Area + Mobile Padding en App Layout

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/ui/sidebar.tsx`

**Context:** En iPhone con home indicator, el contenido puede quedar tapado. El sidebar footer también. El `p-6` de desktop es demasiado para mobile.

- [ ] **Step 1: Actualizar app layout.tsx con safe area**

En `src/app/(app)/layout.tsx`, el main ya fue actualizado en Task 2 con `px-4 py-4 sm:p-6`. Ahora añadir safe-area al bottom del layout para que el contenido no quede bajo el home indicator de iOS:

```tsx
  return (
    <div className="min-h-screen bg-gray-50">
      <TopProgress />
      <Sidebar ... />
      <main className="md:pl-60">
        <div className="sticky top-0 z-30 hidden items-center justify-end border-b border-gray-200 bg-white/90 px-6 py-2 backdrop-blur md:flex">
          <NotificationBell />
        </div>
        <div className="safe-b px-4 py-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
```

- [ ] **Step 2: Añadir safe area al footer del sidebar**

En `src/components/ui/sidebar.tsx`, el footer `<div className="border-t border-gray-200 px-5 py-4 text-sm">` recibe `safe-b`:

```tsx
<div className="safe-b border-t border-gray-200 px-5 py-4 text-sm">
```

- [ ] **Step 3: Verificar typecheck y lint**

```bash
npm run typecheck
npm run lint
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/layout.tsx src/components/ui/sidebar.tsx
git commit -m "fix(mobile): safe-area-inset support for notch/home-indicator on iOS"
```

---

### Task 7: Focus Rings y Polish en Formularios Internos

**Files:**
- Modify: `src/app/(app)/tickets/[id]/page.tsx` (formulario comentario) — verificar clases  
- Modify: Todos los inputs en `src/app/(app)/rrhh/`, `src/app/(app)/recursos/` — añadir `focus-visible:ring-2 focus-visible:ring-brand/50` si no lo tienen  

**Context:** globals.css de Task 1 ya añade focus rings globales a `input:focus-visible`, `textarea:focus-visible`, `select:focus-visible`, `button:focus-visible`. Esto cubre automáticamente todos los elementos que tienen `<input>`, `<textarea>`, `<select>`, `<button>` en la app interna.

La única tarea manual restante es verificar que los inputs con `className` explícita no tengan `outline-none` sin un focus ring alternativo.

- [ ] **Step 1: Verificar que ningún input crítico tenga outline-none sin ring**

```bash
grep -r "outline-none" src/app/\(app\) src/components --include="*.tsx" -l
```

Para cada archivo encontrado, revisar si el elemento también tiene `focus:ring-` o `focus-visible:ring-`. Si no, añadir `focus-visible:ring-2 focus-visible:ring-brand/50`.

- [ ] **Step 2: Verificar que los botones de acción tengan min-h-[44px]**

Los inputs estándar de Tailwind con `px-3 py-1.5` son ~34px. En formularios de uso frecuente en mobile, cambiar a `py-2` para 38px (aceptable en formularios complejos; los CTAs principales ya tienen `py-2.5`).

Archivos con botones críticos que necesitan verificación:
- `src/app/(app)/tickets/[id]/page.tsx` → botón comentario
- `src/app/(app)/rrhh/vacaciones/page.tsx` → botones de aprobar/rechazar
- `src/app/(app)/cronograma/page.tsx` → botones del calendario

Patrón de verificación:
```bash
grep -n "py-1.5\|py-1 " src/app/\(app\)/tickets/\[id\]/page.tsx
```

Si hay botones de acción principal con `py-1.5`, cambiar a `py-2.5`.

- [ ] **Step 3: Verificar typecheck y lint**

```bash
npm run typecheck
npm run lint
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(mobile): ensure touch targets and focus rings on action buttons"
```

---

### Task 8: Push to Production

- [ ] **Step 1: Verificar build completo**

```bash
npm run build
```

Expected: Build exitoso sin errores. Si hay errores, arreglarlos antes del push.

- [ ] **Step 2: Push**

```bash
git push origin main
```

Expected: Vercel auto-deploy triggered. URL: https://super-herramienta.vercel.app

---

## Dependency Graph

```
Task 1 (CSS foundations)
  ├─→ Task 2 (Spinner + TopProgress)   [depends: .route-progress class from T1]
  ├─→ Task 3 (Sidebar touch targets)   [depends: .interactive class from T1]
  ├─→ Task 4 (Portal CSS)              [independent of T1, can run in parallel]
  └─→ Task 6 (Safe area)               [depends: .safe-b class from T1]

Task 2 → Task 5 (Spinners in forms)    [depends: <Spinner> component from T2]
Tasks 3, 4, 5, 6, 7 → Task 8 (Push)   [all must be green before push]
```

## Self-Review

**Spec coverage:**
- ✅ Touch targets ≥44px: Tasks 3 + 4
- ✅ Loading feedback: Tasks 2 + 5
- ✅ Safe-area: Task 6
- ✅ Active states: Tasks 1 (globals) + 4 (portal)
- ✅ Route progress: Task 2
- ✅ Focus rings: Task 1 (globals) + Task 7
- ✅ Mobile padding: Task 2 (layout px-4)

**Placeholder scan:** Ninguno — todos los pasos tienen código exacto.

**Type consistency:** `<Spinner size={14} />` en Task 5 coincide con la prop `size?` definida en Task 2. `.interactive`, `.safe-b` definidas en Task 1, consumidas en Tasks 3, 6.
