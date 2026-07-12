import { useGardenStore } from '@/stores/gardenStore'

export function useStorage() {
  const gardenStore = useGardenStore()

  function exportJSON() {
    const data = gardenStore.toData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const name = (gardenStore.plot.name || 'zahrada').replace(/[^a-z0-9áčďéěíňóřšťúůýž ]/gi, '')
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`
    a.href = url
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function importJSON() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json,application/json'
      input.onchange = (e) => {
        const file = e.target.files?.[0]
        if (!file) return reject(new Error('Žádný soubor'))
        const reader = new FileReader()
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result)
            gardenStore.loadFromData(data)
            resolve()
          } catch (err) {
            reject(new Error('Neplatný soubor: ' + err.message))
          }
        }
        reader.onerror = () => reject(new Error('Chyba čtení souboru'))
        reader.readAsText(file)
      }
      input.click()
    })
  }

  return { exportJSON, importJSON }
}
