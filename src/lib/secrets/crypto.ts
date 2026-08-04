import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGO = 'aes-256-gcm'

// Falla fuerte si falta la key — nunca cae a un fallback silencioso que
// dejaría secretos "cifrados" con una clave conocida/hardcodeada. Definir
// SECRETS_ENCRYPTION_KEY en .env (local) / Vercel (prod), nunca en el repo.
function getKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('SECRETS_ENCRYPTION_KEY no está configurada — no se puede cifrar/descifrar sin ella.')
  }
  // Deriva 32 bytes reales sin importar el largo del valor de entorno — nunca
  // se usa el string crudo como key de AES directamente.
  return scryptSync(raw, 'ingegar-secrets-vault', 32)
}

/** iv.authTag.ciphertext, cada segmento base64 — formato propio, no reutilizable fuera de este módulo. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv, authTag, encrypted].map((b) => b.toString('base64')).join('.')
}

export function decryptSecret(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Formato de secreto cifrado inválido.')
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}
