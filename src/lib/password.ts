import { randomBytes } from 'node:crypto'

// Mismo generador que ya usaban scripts/create-technician-credentials.ts y
// scripts/rotate-prod-passwords.ts (duplicado idéntico en ambos) — levantado
// acá para que las nuevas acciones de creación de cuentas en la UI lo reutilicen.
export function generatePassword(): string {
  return randomBytes(12).toString('base64url')
}
