# Mobile-First UX — Design Spec

**Aprobado por:** Sergio Herrera  
**Fecha:** 2026-07-04  
**Alcance:** Toda la plataforma INGEGAR (app interna + portales cliente)  
**Meta:** Elevar la experiencia de 2/10 a 10/10 en mobile. Cero cambios en lógica funcional.

---

## Problema central (del audit)

| Síntoma | Medición actual | Target |
|---------|----------------|--------|
| Touch targets | 26–32 px | ≥44 px (Apple HIG) |
| Loading feedback | 0 acciones con estado | 100% |
| Portal grid | hardcoded `1fr 280px` | stack en <768px |
| Safe-area | sin `env()` | Notch + home indicator |
| Active states | inexistentes en mobile | `scale-[0.97]` al tap |
| Focus rings | inconsistentes | `focus-visible:ring-2` |

---

## Arquitectura de la solución

### 1 — CSS Foundations (`src/app/globals.css`)

**Responsabilidad:** Única fuente de verdad para tokens de mobile.

```css
/* Touch targets */
.touch-target { min-height: 44px; min-width: 44px; }
.touch-target-lg { min-height: 48px; }

/* Safe area */
.safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
.safe-left   { padding-left:  env(safe-area-inset-left,   0px); }

/* Base mobile resets */
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { -webkit-tap-highlight-color: transparent; }

/* Tap feedback */
.tap-active { @apply active:scale-[0.97] active:brightness-95 transition-transform duration-75; }
```

**Interfaz:** Clases reutilizables. No depende de nada.  
**Consumidores:** Sub-proyectos 2, 3, 4.

---

### 2 — Loading Feedback System

**Archivos nuevos:**
- `src/hooks/use-action.ts` — wraps `useTransition`, expone `{ run, isPending }`
- `src/components/ui/submit-btn.tsx` — `<SubmitButton>` usa `useFormStatus()` internamente; spinner SVG inline; siempre ≥44px height
- `src/components/ui/top-progress.tsx` — barra de progreso CSS animada en el layout; se activa en cambios de `usePathname()`

**Patrón de uso:**
```ts
// Antes:
startTransition(async () => { await updateTicketStatus(id, s) })

// Después:
const { run, isPending } = useAction(updateTicketStatus)
run(id, s)
```

**Regla:** Todos los `<button type="submit">` en la app se reemplazan por `<SubmitButton>`. Todos los `startTransition` manuales migran a `useAction`.

---

### 3 — Navigation Mobile

**Archivos a tocar:**
- `src/components/ui/sidebar.tsx` — botón hamburguesa ≥44px, links nav ≥44px, focus trap con `useEffect`+`ref`
- `src/app/(app)/layout.tsx` — `pb-safe` en el contenedor principal
- `src/components/tickets/portal-shell.tsx` — `.pw-dash` stack con CSS media query, `.pbtn` altura ≥48px, separación entre botones ≥8px

**Accesibilidad en drawer:**
```tsx
// aria-modal + focus trap + Escape para cerrar
<div role="dialog" aria-modal="true" ref={drawerRef}>
  // focus trap: Tab/Shift+Tab quedan atrapados dentro
```

---

### 4 — Interactive Polish

**Patrón global:**
- Todos los `<button>`, `<a>`, `<label>` interactivos → `cursor-pointer`
- Cards clicables → `hover:shadow-md transition-shadow`
- `focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none` en inputs y botones
- En el portal: `active:opacity-80` en botones via inline style `transition: opacity 0.1s`

---

## Orden de ejecución

```
[1] globals.css foundations  (bloqueante — yo)
      ↓ ready
[2A] Loading system          [2B] Navigation mobile      [2C] Interactive polish
     (subagente paralelo)        (subagente paralelo)        (subagente paralelo)
```

## Criterios de aceptación

- [ ] `npm run typecheck` pasa sin errores
- [ ] `npm run lint` pasa sin errores
- [ ] Todo elemento táctil ≥44px medido en DevTools
- [ ] Cualquier acción de servidor: botón se deshabilita + spinner visible <100ms
- [ ] Sin scroll horizontal en mobile (360px viewport)
- [ ] Portal grid apila verticalmente en <768px
- [ ] Drawer cierra con Escape y atrapa foco

## Restricciones

- **Portal**: inline styles obligatorios (CSS vars no garantizados bajo dark mode de OS)
- **Sin nuevas dependencias** — spinner con SVG inline, progress bar con CSS puro
- **Sin cambios de comportamiento** — solo visual/UX
- **Turso producción**: no tocar ningún schema Prisma en este trabajo
