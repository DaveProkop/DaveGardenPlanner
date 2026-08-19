// Google Disk: standardní OAuth flow přes Google Identity Services (GIS) +
// Google Picker pro výběr souboru. Obě knihovny se načítají dynamicky (žádná
// npm závislost) až ve chvíli, kdy je uživatel poprvé použije.
//
// Rozsah oprávnění je omezený na drive.file (viz config/google.js) — appka
// tak vidí jen soubory, které sama vytvoří nebo které uživatel vybere přes
// Picker, ne celý jeho Disk.
import { GOOGLE_CLIENT_ID, GOOGLE_API_KEY, GOOGLE_DRIVE_SCOPE, isGoogleConfigured } from '@/config/google'

const GSI_SRC  = 'https://accounts.google.com/gsi/client'
const GAPI_SRC = 'https://apis.google.com/js/api.js'

let gsiPromise  = null
let gapiPromise = null
let tokenClient = null
let accessToken = null
let tokenExpiresAt = 0

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.defer = true
    s.onload  = () => resolve()
    s.onerror = () => reject(new Error(`Nepodařilo se načíst ${src}`))
    document.head.appendChild(s)
  })
}

function ensureGsi() {
  if (!gsiPromise) gsiPromise = loadScript(GSI_SRC)
  return gsiPromise
}

function ensureGapiPicker() {
  if (!gapiPromise) {
    gapiPromise = loadScript(GAPI_SRC).then(() => new Promise((resolve, reject) => {
      window.gapi.load('picker', { callback: resolve, onerror: reject })
    }))
  }
  return gapiPromise
}

function requestToken(interactive) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPE,
        callback: () => {}, // nastaveno níže per-request
      })
    }
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error))
      accessToken = resp.access_token
      tokenExpiresAt = Date.now() + (resp.expires_in ?? 3000) * 1000
      resolve(accessToken)
    }
    tokenClient.error_callback = (err) => reject(new Error(err?.message || 'Přihlášení k Google Disku selhalo nebo bylo zrušeno.'))
    tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' })
  })
}

// interactive:false = zkusit získat token bez viditelného UI (funguje jen
// pokud už uživatel v této session souhlas jednou udělil); jinak zobrazí
// Google přihlašovací/souhlasové okno — MUSÍ být voláno jako reakce na klik.
export async function getAccessToken({ interactive = true } = {}) {
  if (!isGoogleConfigured()) {
    throw new Error('Google Disk není nakonfigurovaný (chybí Client ID / API klíč) — viz PROJECT.md.')
  }
  await ensureGsi()
  if (accessToken && Date.now() < tokenExpiresAt - 30_000) return accessToken
  return requestToken(interactive)
}

// Otevře Google Picker, uživatel vybere soubor. Vrací null při zrušení.
export async function pickFile() {
  const token = await getAccessToken({ interactive: true })
  await ensureGapiPicker()
  return new Promise((resolve, reject) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setMimeTypes('application/json,text/plain')
      .setIncludeFolders(true)
    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setCallback((data) => {
        const Action = window.google.picker.Action
        if (data.action === Action.PICKED) {
          const doc = data.docs[0]
          resolve({ fileId: doc.id, name: doc.name })
        } else if (data.action === Action.CANCEL) {
          resolve(null)
        }
      })
      .build()
    picker.setVisible(true)
  }).catch((err) => { throw err instanceof Error ? err : new Error('Otevření Google Disku selhalo.') })
}

export async function downloadFile(fileId, { interactive = true } = {}) {
  const token = await getAccessToken({ interactive })
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Nepodařilo se stáhnout soubor z Google Disku (${res.status}).`)
  return res.text()
}

export async function updateFile(fileId, text) {
  const token = await getAccessToken({ interactive: true })
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: text,
  })
  if (!res.ok) throw new Error(`Nepodařilo se uložit na Google Disk (${res.status}).`)
  return res.json()
}

export async function createFile(name, text) {
  const token = await getAccessToken({ interactive: true })
  const boundary = 'garden-planner-boundary'
  const metadata = { name, mimeType: 'application/json' }
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n` +
    `--${boundary}--`
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!res.ok) throw new Error(`Nepodařilo se vytvořit soubor na Google Disku (${res.status}).`)
  return res.json() // { id, name, ... }
}

export { isGoogleConfigured }
