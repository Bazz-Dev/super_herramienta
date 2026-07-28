# Validación — no declarar "listo" sin haberlo corrido

## Antes de dar por terminado cualquier cambio

1. `npm run typecheck`
2. `npm run lint`
3. Tests relevantes (`npm run test:unit`, `npm run test:e2e` si el cambio toca flujos cubiertos)
4. `npm run build` (build real de producción, no solo dev server)
5. Levantar el app y navegar las páginas modificadas con el navegador — leer el código y asumir que
   "se ve bien" no es validación. Revisar consola del navegador por errores/warnings de hidratación.

No declarar algo limpio/correcto/validado sin haber ejecutado el comando correspondiente en esta
misma sesión. Un cambio que "debería funcionar" no es un cambio verificado.

## Comandos

```bash
npm run dev          # servidor de desarrollo
npm run build        # prisma generate + next build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test:unit    # node --import tsx --test (node 24 — imports .ts requieren extensión explícita)
npm run test:e2e     # Playwright, levanta dev server automáticamente
```

## Suite de tests — qué cubre cada nivel

Catálogo completo (qué archivo cubre qué, taxonomía de estados, matriz de condiciones de borde) vive
en `docs/ARQUITECTURA.md` — no duplicar esa lista acá.

## Verificación visual real, no solo lectura de código

Para cambios de UI: usar Playwright (o el navegador directo) contra un servidor local corriendo con
datos reales (`dev.db` o un snapshot), no limitarse a leer el JSX y asumir el resultado. Tomar
screenshots cuando el cambio sea de layout/densidad/jerarquía visual — permite comparar antes/después
en vez de describir de memoria.

## Producción como referencia de errores reales

Antes de asumir que un bug reportado por el dueño es un caso aislado o de percepción, buscar evidencia
en los logs reales de runtime de Vercel (`get_runtime_errors` del plugin de Vercel, o el dashboard) —
un error que aparece igual en producción con usuarios reales confirma la causa raíz en vez de dejarla
como hipótesis.
