# DaveGardenPlanner — Dokumentace projektu

## Přehled

Webová aplikace pro vizuální plánování zahrady. Umožňuje uživateli vytvořit 2D půdorys pozemku, umísťovat stavby, rostliny a další objekty s přesnými rozměry v metrech.

**URL:** `https://<github-username>.github.io/DaveGardenPlanner/`

---

## Tech stack

| Technologie       | Účel                                    |
|-------------------|-----------------------------------------|
| Vue 3 + Vite      | Framework + build tool                  |
| vue-konva (Konva) | Canvas kreslení, drag & drop, transform |
| Pinia             | State management                        |
| Tailwind CSS v3   | Styling                                 |
| vite-plugin-pwa   | Service worker, auto-update notifikace  |
| uuid              | Generování unikátních ID objektů        |
| GitHub Actions    | CI/CD → GitHub Pages                    |

---

## Architektura

```
src/
├── App.vue                          # Root: layout (toolbar + 3 sloupce)
├── main.js                          # Vue + Pinia + vue-konva init
├── style.css                        # Tailwind imports
│
├── constants/
│   └── objectTypes.js               # Definice všech typů objektů (barva, tvar, rozměry)
│
├── stores/
│   ├── gardenStore.js               # Hlavní state: plot, objects, undo/redo, autosave
│   └── uiStore.js                   # UI state: vybraný objekt, dialogy
│
├── composables/
│   └── useStorage.js                # Export/import JSON souboru
│
└── components/
    ├── toolbar/AppToolbar.vue       # Horní lišta: název, pozemek, undo/redo, save/load
    ├── panels/
    │   ├── ObjectLibrary.vue        # Levý panel: seznam objektů k přidání
    │   └── PropertyEditor.vue      # Pravý panel: editace vybraného objektu
    ├── canvas/
    │   ├── GardenCanvas.vue         # Konva stage: grid, panning, zoom, klávesnice
    │   └── GardenObject.vue         # Jeden objekt na canvas (Rect + Text + Transformer)
    └── UpdateBanner.vue             # PWA notifikace nové verze
```

---

## Datový model (JSON soubor)

```json
{
  "version": "1.0.0",
  "savedAt": "2026-07-12T10:00:00.000Z",
  "plot": {
    "name": "Moje zahrada",
    "width": 20,
    "height": 15
  },
  "objects": [
    {
      "id": "uuid-v4",
      "type": "house",
      "x": 2.0,
      "y": 2.0,
      "width": 10.0,
      "height": 8.0,
      "rotation": 0,
      "label": "Dům",
      "color": "#A0785A",
      "notes": ""
    }
  ]
}
```

Souřadnice a rozměry jsou vždy v **metrech**. Přepočet na pixely: `1 m = 50 px` (konstanta `PPM` v `GardenCanvas.vue`).

---

## Ukládání dat

| Mechanismus        | Kdy                                      |
|--------------------|------------------------------------------|
| localStorage       | Automaticky po každé změně (autosave)    |
| JSON soubor (DL)   | Tlačítko "💾 Uložit" — stáhne soubor    |
| JSON soubor (UP)   | Tlačítko "📂 Načíst" — nahraje soubor   |

Klíč v localStorage: `dave-garden-planner-v1`

---

## Versioning

Verze aplikace je v `package.json` → pole `version` (sémantické verzování: MAJOR.MINOR.PATCH).

- **MAJOR** — zásadní změna architektury nebo datového modelu
- **MINOR** — nové funkce (nový typ objektu, nový panel...)
- **PATCH** — opravy bugů, drobné úpravy

Jak zvýšit verzi před deployem:
```bash
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

Verze se zobrazuje v toolbaru a je zapsána do každého uloženého JSON souboru.

---

## Auto-update (PWA)

Aplikace je Progressive Web App s service workerem (`vite-plugin-pwa`).

- Po deploymentu nové verze na GitHub Pages SW detekuje změnu
- Uživateli se zobrazí banner "Nová verze je k dispozici"
- Klikem na "Aktualizovat" se stránka obnoví s novou verzí
- SW navíc kontroluje aktualizace každou hodinu

---

## Typy objektů

### Stavby
`house`, `shed`, `garage`, `fence`, `path`, `pergola`, `terrace`

### Rostliny
`tree`, `shrub`, `bed`, `herb`, `vegetable`, `flower`

### Ostatní
`pond`, `compost`, `greenhouse`, `sandbox`

Každý typ má: `id`, `label`, `color`, `category`, `defaultW`, `defaultH`, `shape` (`rect`/`circle`/`ellipse`), `icon`

---

## Klávesové zkratky

| Zkratka        | Akce                     |
|----------------|--------------------------|
| Ctrl+Z         | Zpět (undo)              |
| Ctrl+Y         | Vpřed (redo)             |
| Delete/Backspace | Smazat vybraný objekt  |
| Mouse wheel    | Zoom in/out              |
| Drag (canvas)  | Posun pohledu (pan)      |

---

## Deployment — první nastavení

1. Vytvořit GitHub repo: `DaveGardenPlanner`
2. Nahrát kód: `git push origin main`
3. V GitHub repo: **Settings → Pages → Source: GitHub Actions**
4. Workflow se spustí automaticky při každém push na `main`

---

## Plán implementace (etapy)

### ✅ Etapa 1 — Základ (aktuální stav)
- Projekt scaffolding (Vite + Vue 3 + Pinia + Tailwind)
- Canvas s gridem, zoom, pan
- Pozemek s nastavitelnými rozměry
- Všechny typy objektů (17 typů)
- Drag & drop, resize, rotace přes Transformer
- Editace vlastností v pravém panelu
- Undo/redo (50 kroků)
- Autosave do localStorage
- Export/import JSON souboru
- PWA service worker + update notifikace
- CI/CD na GitHub Pages

### Etapa 2 — Plánované funkce
- Google Drive integrace (načíst/uložit z Drive)
- Snap-to-grid (přichytávání na mřížku)
- Kopírování/vkládání objektů (Ctrl+C, Ctrl+V)
- Skupinový výběr (lasso nebo Shift+click)
- Průhlednost (opacity) objektu
- Měřítko na canvas (1m = vyznačená vzdálenost)
- Export jako PNG/SVG obrázek
- Více plánů (tabs)

### Etapa 3 — Pokročilé funkce
- Databáze rostlin (latinské názvy, požadavky)
- Companion planting (vhodné kombinace)
- Sezonní pohled (jaro/léto/podzim/zima)
- Mobilní optimalizace (dotykové gesta)

---

## Poslední aktualizace

| Datum      | Verze | Popis                                      |
|------------|-------|--------------------------------------------|
| 2026-07-12 | 1.0.0 | Etapa 1 — kompletní základní implementace  |
