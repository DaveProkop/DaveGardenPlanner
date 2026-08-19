// Google Disk (Drive) integrace — OAuth Client ID a API klíč se NEcommitují do
// repa (viz .env.example). Nejsou to tajné hodnoty (jsou vidět ve zdrojovém
// kódu prohlížeče), ale musí být v Google Cloud Console omezené na tuto
// doménu, jinak by je mohl zneužít kdokoliv jiný. Návod na vytvoření viz
// PROJECT.md, sekce "Google Disk — nastavení".
export const GOOGLE_CLIENT_ID   = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
export const GOOGLE_API_KEY     = import.meta.env.VITE_GOOGLE_API_KEY || ''

// drive.file = aplikace vidí jen soubory, které sama vytvoří nebo které
// uživatel výslovně vybere přes Picker — nejužší možný rozsah oprávnění.
export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export function isGoogleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_API_KEY)
}
