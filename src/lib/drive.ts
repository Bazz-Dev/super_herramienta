/**
 * Google Drive integration for automatic ticket folder creation.
 *
 * Uses a Google Service Account (env: GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)
 * to create folders under a per-client root folder defined in Client.driveFolderId.
 *
 * Folder naming convention: YYMMDD-[CLIENT_CODE]-[TICKET_CODE]-[BRANCH]
 * e.g. 260629-DEC-TKT-0042-LAS_CONDES
 *
 * Setup steps (one-time, per environment):
 * 1. Create a Google Cloud project → enable Drive API
 * 2. Create a Service Account → download JSON key
 * 3. Set env vars: GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY (base64 or raw)
 * 4. Share the INGEGAR client root folder with the Service Account email (Editor)
 * 5. Set Client.driveFolderId to the root folder ID for each client
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

function getServiceAccountEmail(): string | null {
  return process.env.GOOGLE_CLIENT_EMAIL ?? null
}

function getPrivateKey(): string | null {
  const raw = process.env.GOOGLE_PRIVATE_KEY
  if (!raw) return null
  // Support base64-encoded key (set GOOGLE_PRIVATE_KEY=$(base64 -w0 key.pem) in prod)
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8')
    if (decoded.includes('BEGIN')) return decoded.replace(/\\n/g, '\n')
  } catch {}
  return raw.replace(/\\n/g, '\n')
}

/** True if Drive integration is configured */
export function driveEnabled(): boolean {
  return !!(getServiceAccountEmail() && getPrivateKey())
}

async function getAccessToken(): Promise<string> {
  const email = getServiceAccountEmail()
  const key = getPrivateKey()
  if (!email || !key) throw new Error('Google Drive credentials not configured')

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const signingInput = `${enc(header)}.${enc(payload)}`

  // Sign with RS256 using Web Crypto (available in Node 18+ / Edge)
  const pemBody = key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const der = Buffer.from(pemBody, 'base64')
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(signingInput),
  )
  const jwt = `${signingInput}.${Buffer.from(sig).toString('base64url')}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Drive auth failed: ${err}`)
  }
  const data = await res.json() as { access_token: string }
  return data.access_token
}

/**
 * Creates a subfolder inside a parent Drive folder.
 * Returns { id, webViewLink } of the created folder.
 */
export async function createDriveFolder(
  name: string,
  parentFolderId: string,
): Promise<{ id: string; webViewLink: string }> {
  const token = await getAccessToken()

  const res = await fetch(`${DRIVE_API}/files?fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Drive folder creation failed: ${err}`)
  }
  return res.json() as Promise<{ id: string; webViewLink: string }>
}

/**
 * Builds the folder name for a ticket.
 * Pattern: YYMMDD-[CLIENT_CODE]-[TICKET_CODE]-[BRANCH]
 */
export function ticketFolderName(opts: {
  ticketCode: string
  clientName: string
  branchName?: string | null
  date?: Date
}): string {
  const d = opts.date ?? new Date()
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const dateStr = `${yy}${mm}${dd}`

  const clientCode = opts.clientName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3)

  const parts = [dateStr, clientCode, opts.ticketCode]
  if (opts.branchName) {
    parts.push(opts.branchName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').slice(0, 20))
  }
  return parts.join('-')
}
