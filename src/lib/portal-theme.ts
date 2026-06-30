/** Portal theme — light palette is fixed, only primary color is tenant-configurable. */
export interface PortalTheme {
  primary: string
  bg:      string
  card:    string
  text:    string
}

export const PORTAL_LIGHT: Omit<PortalTheme, 'primary'> = {
  bg:   '#f4f3f1',
  card: '#ffffff',
  text: '#18130e',
}

/**
 * Parse portal theme from DB. Only the `primary` color is accepted from the
 * stored JSON — bg/card/text are ALWAYS the hardcoded light palette so the
 * portal can never become dark regardless of what's saved in the database.
 */
// Only accept valid CSS hex colors (#rgb, #rrggbb). Prevents XSS when the
// value is interpolated into dangerouslySetInnerHTML script tags in portal layout.
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/

function sanitizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return HEX_COLOR_RE.test(value) ? value : null
}

export function resolvePortalTheme(portalTheme: string | null): PortalTheme {
  let primary = '#d42030'
  if (portalTheme) {
    try {
      const parsed = JSON.parse(portalTheme) as Partial<PortalTheme>
      const safe = sanitizeHex(parsed.primary)
      if (safe) primary = safe
    } catch {}
  }
  return { primary, ...PORTAL_LIGHT }
}
