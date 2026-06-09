# INGEGAR Design System — Cotizaciones

## Fuente de verdad
Ver `design-reference/cotizacion-referencia.html` — ese documento
es el estándar visual. Cualquier cotización generada por esta plataforma
debe ser indistinguible de ese archivo.

## Tokens

### Colores
--color-primary: #f5b100        /* amarillo INGEGAR */
--color-black: #111111          /* negro base */
--color-bg-section: #1a1a1a     /* fondos oscuros */
--color-text: #333333
--color-border: #e5e5e5
--color-table-alt: #f9f9f9

### Tipografía
font-family: 'Inter', sans-serif
Logo: "INGEGAR." (con punto, bold, #111111)
Tagline: 400 weight, #666666

### Layout cotización
- ⚠️ ACTUALIZADO (jun-2026): el cotizador usa **A4 paginado** (no 390px). El valor 390px de abajo queda obsoleto por decisión del usuario (PDF de ancho normal, bien distribuido, con pie de página repetido).
- Viewport render histórico: 390px width (mobile-first, Playwright) — OBSOLETO
- Sin márgenes externos
- Padding interno secciones: 24px
- Tablas: nunca se cortan entre páginas (page-break-inside: avoid)

### Estructura de páginas (orden fijo)
1. Portada: logo + tagline + 4 chips informativos + stripe amarilla
2. Índice o resumen ejecutivo
3. Alcance de trabajo / itemizado
4. Tabla de precios (fila total: fondo negro, texto amarillo)
5. Exclusiones numeradas
6. Condiciones comerciales + validez
7. Firma doble (INGEGAR + cliente)

### Componentes clave
- Header de sección: banda negra #111111, texto blanco, acento amarillo izquierdo (4px border-left: #f5b100)
- Tabla de precios: filas alternas blanco/#f9f9f9, header negro/blanco, total negro/amarillo
- Chips portada: fondo #111111, texto #f5b100, border-radius 4px
- Footer: fondo #111111, logo blanco, datos de contacto

### PDF generation
- Engine: SIMILAR Playwright/Chromium headless
- Width: 390px
- print_background: true
- Márgenes: 0
- Imágenes: filter: brightness() directamente en <img> (nunca opacity stacking)

### Lo que NUNCA hacer
- backdrop-filter (no funciona en WeasyPrint ni Playwright print)
- opacity stacking en elementos absolutos con background-image
- Tablas que crucen página
- Lenguaje IA o comercial genérico en el contenido
- Colores fuera de los tokens definidos
