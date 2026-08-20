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
│   └── objectTypes.js               # Definice typů objektů (barva, kategorie, doporučený nástroj, textureKey) + PLOT_DISTANCE_TYPES
│
├── stores/
│   ├── gardenStore.js               # Hlavní state: shapes, plot (hranice pozemku), undo/redo, autosave
│   ├── uiStore.js                   # UI state: vybraný objekt, aktivní nástroj/barva/textura/typ (preset), drawTarget, dragDelta
│   └── fileSourceStore.js           # Naposledy otevřený/uložený soubor (lokální disk / Google Disk), orchestruje open/save
│
├── config/
│   └── google.js                    # Client ID / API klíč pro Google Disk (z env proměnných, viz sekce "Google Disk — nastavení")
│
├── composables/
│   └── usePlotDistance.js           # Sdílený výpočet vzdálenosti tvaru od hranice pozemku (živě i během tažení) — PropertyEditor i GardenCanvas
│
├── utils/
│   ├── shapes.js                    # ellipsePoints() — aproximace kruhu/elipsy mnohoúhelníkem; bboxOf() — bounding box bodů
│   ├── plot.js                      # distanceToPlotEdge()/nearestEdge() — vzdálenost objektu od hran pozemku (bounding-box)
│   ├── scale.js                     # pickFittingStep()/pickNiceStep() — "hezký" krok v metrech pro měřítko i pravítka
│   ├── textures.js                  # getTexture(color, key) — procedurální dlaždice (Konva fillPatternImage), cachované
│   ├── grid.js                      # snapValue()/snapStagePos() — přichytávání k mřížce (kreslení i tažení)
│   ├── idbHandle.js                 # IndexedDB uložení posledního FileSystemFileHandle napříč reloady stránky
│   ├── localFileAccess.js           # File System Access API (otevřít/zapsat/oprávnění) + fallback na <input type=file>
│   └── googleDrive.js               # Google Identity Services (OAuth) + Picker + Drive REST (open/update/create)
│
└── components/
    ├── toolbar/AppToolbar.vue       # Horní lišta: mřížka/přichytávání/hustota, undo/redo, kopírovat/vložit, aktivní nástroj, autosave indikátor, Otevřít/Uložit
    ├── ResumeSourceBanner.vue       # Banner "Pokračovat v naposledy otevřeném souboru?" nad canvasem
    ├── panels/
    │   ├── ToolPanel.vue            # Levý panel: nástroje, hranice pozemku (nastavit/překreslit/smazat), typy objektů podle kategorií, barva
    │   └── PropertyEditor.vue       # Pravý panel: editace vybraného tvaru (název, poznámky, typ, barva, textura, rozměry/stáří/poloha, vzdálenost od pozemku, geometrie); bez výběru = seskupený seznam objektů na plánu
    ├── canvas/
    │   ├── GardenCanvas.vue         # Konva stage: mřížka (viditelná oblast), hranice pozemku, panning, zoom+měřítko, pravítka nahoře/vlevo, kreslení všech nástrojů, klávesnice (vč. Ctrl+C/V, šipky = jemný posun)
    │   ├── GardenObject.vue         # Jeden tvar na canvas — v-line polygon (texturou/barvou), nebo v-text pro kind:'text'
    │   ├── RulerBar.vue             # Vykreslení jednoho pravítka (ticks+popisky) z předpočítaných pozic — matematika žije v GardenCanvas.vue
    │   ├── VertexHandles.vue        # Úchyty pro tažení jednotlivých vrcholů (obecné polygony/obdélníky)
    │   ├── EllipseHandles.vue       # 4 úchyty na krajích poloos — protažení šířky/výšky, tvar zůstává vždy elipsa/kruh
    │   └── TextHandles.vue          # Úchyt pro živé zvětšení/zmenšení textu (fontSize)
    └── UpdateBanner.vue             # PWA notifikace nové verze
```

---

## Datový model (JSON soubor)

Od v1.1.0 jsou objekty freeform polygony (ne typované obdélníky s `width`/`height`/`rotation`). Od v1.4.0 přibyly `typeId`/`age` na jednotlivých tvarech a nepovinná hranice pozemku `plot` na nejvyšší úrovni:

```json
{
  "version": "1.4.0",
  "savedAt": "2026-08-19T10:00:00.000Z",
  "shapes": [
    {
      "id": "uuid-v4",
      "name": "Strom",
      "color": "#228B22",
      "texture": "foliage",
      "typeId": "tree",
      "age": 7,
      "notes": "",
      "points": [8, 6, 8.9, 6.35, 9.24, 7.24, 8.9, 8.12, 8, 8.47, 7.09, 8.12, 6.75, 7.24, 7.09, 6.35]
    }
  ],
  "plot": { "points": [0, 0, 20, 0, 20, 15, 0, 15] }
}
```

`points` je plochý seznam `[x1,y1,x2,y2,...]` v **metrech**, vždy uzavřený polygon (kruh/elipsa nakreslená nástrojem Kruh/Elipsa je aproximovaná 8úhelníkem — `ellipsePoints()` v `utils/shapes.js`, záměrně málo vrcholů, ať jde tvar snadno ručně upravit tažením). Přepočet na pixely: `1 m = 50 px` (konstanta `PPM` v `GardenCanvas.vue`). Rozměry a poloha v pravém panelu (Šířka/Výška, Poloha X/Y) se počítají z bounding boxu bodů (`bboxOf()` v `utils/shapes.js`) — Rozměry celý tvar přeškálují (`commitSize()`), Poloha ho posune (`commitPosition()` → `gardenStore.moveShape()`, stejná funkce jako u tažení/šipek).

`texture` je klíč do `utils/textures.js` (`grass`/`brick`/`wood`/`stone`/`water`/`foliage`/`sand`/`glass`) nebo `null` pro tvary nakreslené bez vybraného typu objektu (ty mají jen plochou barvu). Texturu vykresluje `GardenObject.vue` jako `fillPatternImage` — dlaždice se generuje z aktuální barvy tvaru, takže respektuje i vlastní barvu z color pickeru.

**`kind`** rozlišuje speciální chování tvaru: `null` = obecný polygon/obdélník (plné úpravy vrcholů), `'ellipse'` = kruh/elipsa nakreslená nástrojem Kruh/Elipsa (8 bodů, upravuje se jen přes 4 úchyty na krajích poloos — viz `EllipseHandles.vue` — tvar tak zůstává vždy skutečnou elipsou), `'text'` = volný text (viz níže). U `kind:'text'` mají `points` jen **jeden bod** `[x,y]` (ukotvení, ne polygon) a přibývá pole **`fontSize`** (velikost v metrech); `name` je zároveň zobrazovaný text na plátně. **Jméno objektu se u ostatních tvarů (ne text) na plátně nezobrazuje** — je jen pro identifikaci v pravém panelu.

**`typeId`** (od v1.4.0) je klíč z `OBJECT_TYPES`, ze kterého byl tvar nakreslen (`uiStore.activePresetId` v okamžiku kreslení), nebo `null`/chybí u volně nakreslených tvarů bez zvoleného typu. Dá se kdykoliv dodatečně nastavit přes výběr "Typ objektu" v `PropertyEditor.vue` — jediný způsob, jak tvarům nakresleným před v1.4.0 (žádné `typeId` v uloženém souboru) zpřístupnit pole Stáří a vzdálenost od hranice pozemku. **`age`** (roky, číslo nebo `null`) se zobrazuje jen pro `typeId === 'tree'` nebo `'shrub'`.

---

## Ukládání dat

| Mechanismus              | Kdy                                                                 |
|---------------------------|---------------------------------------------------------------------|
| localStorage               | Automaticky po každé změně (autosave) — nezávisí na tom, odkud byl plán otevřen |
| Lokální soubor (zápis zpět) | Tlačítko "💾 Uložit", pokud byl plán otevřen "💻 Z počítače" (Chrome/Edge) |
| Google Disk (zápis zpět)   | Tlačítko "💾 Uložit", pokud byl plán otevřen "☁️ Z Google Disku"     |
| JSON soubor (stažení)     | "📂 Otevřít" bez zapamatovaného zdroje / "⋯ → Stáhnout kopii"        |
| Google Disk (nový soubor) | "⋯ → Uložit na Disk jako nový soubor"                                |

Klíč v localStorage: `dave-garden-planner-v2` (od v1.1.0 — nový klíč kvůli změně datového modelu na polygony; staré `-v1` uložené plány se nenačtou automaticky)

`gardenStore.lastSavedAt` drží čas posledního úspěšného zápisu do localStorage (nastavuje se v `_autoSave()`). `AppToolbar.vue` z toho ukazuje trvalý štítek "Automatické ukládání" s tečkou, která na ~700 ms zezelená při každém uložení — vědomě BEZ odpočtu vteřin v textu (dřívější verze "Uloženo před X s" byla vyhodnocena jako rušivá). Toto je nezávislá bezpečnostní síť, funguje vždy, bez ohledu na to, jestli je plán navázaný na soubor.

---

## Otevírání souborů — lokální disk a Google Disk (v1.3.0)

Kromě automatického ukládání do localStorage (výše) lze plán otevřít a ukládat zpět do skutečného souboru — na disku počítače, nebo na Google Disku. Řeší `stores/fileSourceStore.js`, který si drží, odkud je aktuální plán otevřený, a `AppToolbar.vue` mu dává dvě tlačítka:

- **"📂 Otevřít ▾"** — dropdown: "💻 Z počítače" nebo "☁️ Z Google Disku".
- **"💾 Uložit"** — "chytré": pokud je plán navázaný na lokální soubor nebo soubor na Disku, zapíše se **zpátky do něj** (žádné nové stahování do složky Stažené soubory); jinak (nový/nenavázaný plán) se chová jako dřív — stáhne nový JSON. Tlačítko "⋯" nabízí i explicitní "Stáhnout kopii" a "Uložit na Disk jako nový soubor".

**Lokální disk — File System Access API** (`utils/localFileAccess.js`, jen Chrome/Edge; `supportsFileSystemAccess` detekuje podporu): `window.showOpenFilePicker()` vrátí `FileSystemFileHandle` — na rozdíl od klasického `<input type="file">` (pořád použitý jako fallback ve Firefoxu/Safari, tam ale bez handle) ho lze znovu použít later ke čtení i zápisu (`handle.createWritable()`), a hlavně je **structured-cloneable**, takže jde uložit do IndexedDB (`utils/idbHandle.js`) a přežije zavření záložky/reload stránky. Oprávnění se ověřuje přes `handle.queryPermission()`/`requestPermission()` (`verifyPermission()`) — `queryPermission` nikdy nevyžaduje gesto uživatele (lze volat i potichu při startu appky), `requestPermission` ho vyžaduje (jen jako reakce na klik).

**Google Disk — OAuth + Picker** (`utils/googleDrive.js`): Google Identity Services (`accounts.google.com/gsi/client`) pro OAuth token (`google.accounts.oauth2.initTokenClient`, scope `drive.file` — appka vidí jen soubory, které sama vytvoří nebo které uživatel vybere přes Picker) a Google Picker (`apis.google.com/js/api.js`) pro výběr souboru z Disku. Obě knihovny se načítají dynamicky (žádná npm závislost) až při prvním použití. Čtení/zápis obsahu jde přímo přes Drive REST API (`files.get?alt=media`, `files.update` s `uploadType=media`, `files.create` s multipart uploadem) — bez `gapi.client`.

**"Pamatuj si poslední soubor"** — `fileSourceStore` ukládá do localStorage (klíč `dave-garden-planner-last-source-v1`) jen **metadata** (typ, název, případně Drive `fileId`) — nikdy ne obsah. Skutečný `FileSystemFileHandle` je v IndexedDB (`utils/idbHandle.js`), Drive vyžaduje jen `fileId` (soubor se stáhne znovu čerstvý). Při startu appky (`fileSourceStore.initResume()`, voláno z `App.vue` vedle `gardenStore.init()`):
- **lokální soubor s uděleným oprávněním** → načte se **úplně potichu**, žádný klik nutný (přesně "uživatel nemusí znovu otevírat soubor").
- **lokální soubor bez (ještě) uděleného oprávnění, nebo soubor na Google Disku** → prohlížeč vyžaduje gesto uživatele (OAuth popup / `requestPermission`), takže se místo tichého načtení zobrazí `ResumeSourceBanner.vue` nad canvasem: "Pokračovat v „název“ (tento počítač / Google Disk)?" s tlačítky Pokračovat / Ne, nový plán. **To je limit prohlížečů, ne appky** — nejde bezpečnostně obejít.
- Pokud handle/soubor mezitím zmizel nebo je poškozený, appka na to nespadne — jen zůstane u dat z localStorage autosave.

### Google Disk — nastavení (jednorázově, dělá vlastník projektu)

Google Disk integrace potřebuje vlastní OAuth Client ID + API klíč z Google Cloud Console — bez nich appka funguje normálně dál, jen tlačítka "Z Google Disku"/"Uložit na Disk jako nový soubor" jsou needitovatelná (`isGoogleConfigured()` v `config/google.js`).

1. [Google Cloud Console](https://console.cloud.google.com/) → vytvořit nový projekt (nebo použít existující).
2. **APIs & Services → Library** → povolit **Google Drive API** a **Google Picker API**.
3. **APIs & Services → OAuth consent screen** → typ "External", vyplnit název appky; v "Test users" přidat svůj Google účet (dokud appka není ověřená Googlem, funguje jen pro takto přidané testovací účty — pro osobní/rodinné použití to stačí).
4. **APIs & Services → Credentials → Create Credentials**:
   - **OAuth client ID** → typ "Web application" → do "Authorized JavaScript origins" přidat `https://daveprokop.github.io` a pro lokální vývoj `http://localhost:5173` → zkopírovat **Client ID**.
   - **API key** → zkopírovat, pak omezit ("Restrict key" → "Websites" → přidat stejné domény), aby ho nešlo zneužít odjinud.
5. Lokálně: zkopírovat `.env.example` do `.env.local` a vyplnit `VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_API_KEY`.
6. Nasazení (GitHub Pages přes Actions): v GitHub repu **Settings → Secrets and variables → Actions** přidat repository secrets `VITE_GOOGLE_CLIENT_ID` a `VITE_GOOGLE_API_KEY` — `.github/workflows/deploy.yml` je při buildu předá jako env proměnné.

Client ID ani API klíč nejsou tajné (jsou vidět ve zdrojovém kódu prohlížeče) — bezpečnost zajišťuje omezení na konkrétní domény v kroku 4, ne jejich utajení. Proto se necommitují jako hodnoty do repa, ale ani commit by sám o sobě nebyl bezpečnostní díra.

---

## Mřížka, pravítka a hustota

Aplikace nemá žádnou vynucenou definici "pozemku" s pevnými rozměry — kreslicí plocha je neomezená. Mřížka (`gridLines` v `GardenCanvas.vue`) se proto nepočítá jednou dopředu, ale z aktuálně viditelné oblasti (`viewBounds`, odvozeno z pozice/zoomu stage a rozměru okna), takže vždy pokrývá celý canvas, ať uživatel odjede/přiblíží kamkoliv. Pozice stage (`stagePos`) se sleduje reaktivně přes `@dragmove` na `v-stage` (pan myší) a při každém zoomu (kolečko i tlačítka +/−). Počátek (0,0) je při prvním načtení vycentrovaný uprostřed obrazovky.

**Pravítka (od v1.4.0)** — dva HTML pruhy pinnuté k hornímu a levému okraji viewportu (`RulerBar.vue`, mimo `<v-stage>`, stejný vzor jako spodní lišta se zoomem/měřítkem), s popisky v metrech na každé "hezké" rysce (`rulerTicksX`/`rulerTicksY` v `GardenCanvas.vue`, krok vybírá `pickNiceStep()` z `utils/scale.js` tak, aby rozestup na obrazovce zůstal čitelný — min. 50 px — při libovolném zoomu). Nahradily starší `rulerLabels` (popisky jen podél os x=0/y=0 po pevných 5 m, viditelné jen v okolí počátku) — pravítka jsou naopak vždy vidět celá, po celé šířce/výšce viewportu, jako ve Figmě/Illustratoru. Skryjí se spolu s mřížkou (`uiStore.showGrid`).

**Hustota mřížky** (`uiStore.gridSize`, výběr v `AppToolbar.vue` z `GRID_SIZES = [0.25, 0.5, 1, 2, 5]` metrů) mění rozestup čar; hlavní (tmavší) čára je vždy každá 5. vedlejší.

**Přichytávání k mřížce** (`uiStore.snapToGrid`, tlačítko "🧲 Přichytávání") lze zapnout/vypnout nezávisle na viditelnosti mřížky. Když je zapnuté, `utils/grid.js` zaokrouhluje na násobek `gridSize`:
- při kreslení (`getMeterPos()` v `GardenCanvas.vue`) — přímo v metrech přes `snapValue()`,
- při tažení celého objektu nebo úchytu (`GardenObject.vue`, `VertexHandles.vue`) — přes `snapStagePos()`, což je Konva `dragBoundFunc` počítající v absolutních (obrazovkových) souřadnicích s ohledem na aktuální pan/zoom stage.

Text a úchyty pro elipsu/font se **nepřichytávají** (volný drag) — snap dává smysl jen pro geometrii vázanou na metry.

---

## Pozemek a vzdálenosti (od v1.4.0)

Hranice pozemku je **volitelná** a kdykoliv překreslitelná/smazatelná — na rozdíl od v1.0.0 appka nikdy nevynucuje její zadání před kreslením. Slouží jednomu účelu: u stromů/keřů/záhonů interaktivně ukázat vzdálenost od nejbližší hrany pozemku.

- **Kreslení**: tlačítko "📐 Nastavit hranici pozemku" v sekci "Pozemek" (`ToolPanel.vue`, `uiStore.startPlotDrawing()`) přepne na nástroj Polygon s `uiStore.drawTarget = 'plot'` — klikání po vrcholech + Enter/dvojklik funguje identicky jako běžný polygon, jen výsledek jde do `gardenStore.setPlot(points)` místo `addShape()`. Hranice je samostatný stav `gardenStore.plot` (`{ points } | null`), **ne** položka v `shapes[]` — Ctrl+C/V, Delete klávesa a nový seznam objektů (viz níže) se jí proto nemůžou nechtěně dotknout. Ruční přepnutí nástroje nebo Esc kdykoliv rozkreslenou hranici zruší (`setTool()` vždy resetuje `drawTarget`). Úprava existující hranice = smazat + překreslit (tlačítka "✏️ Překreslit"/"🗑 Smazat"), žádné tažení vrcholů.
- **Vykreslení**: přerušovaná tmavě zelená čára + popisek "Hranice pozemku" (`plotLineConfig`/`plotLabelConfig` v `GardenCanvas.vue`), ve vlastní vrstvě nad mřížkou, pod tvary.
- **Vzdálenost**: počítá se z **bounding boxů** (ne skutečné nejbližší hrany polygonu) — `utils/plot.js` (`distanceToPlotEdge()`, `nearestEdge()`), sdíleno přes `composables/usePlotDistance.js`. Jen pro `typeId` `'tree'`/`'shrub'`/`'bed'` (`PLOT_DISTANCE_TYPES` v `constants/objectTypes.js`): číselný readout v `PropertyEditor.vue` (vzdálenost k nejbližší svislé i vodorovné hraně, se stranou — "vlevo"/"vpravo"/"nahoře"/"dole"; záporná = objekt přesahuje hranici, zvýrazněno červeně) + dvě přerušované vodicí čáry s popisky na plátně. **Živé i během tažení** (nástroj Přesun) — `GardenObject.vue` čte živou pozici taženého uzlu v `@dragmove` (jen čtení, nikdy zápis zpět do configu právě taženého uzlu, viz poučení níže) a posílá ji do `uiStore.dragDelta`, ze kterého `usePlotDistance()` dopočítá posunutý bounding box bez zásahu do `gardenStore` (ten se zapíše až na `dragend`, stejně jako dřív).

**Poloha objektu** — nové pole "Poloha (m)" X/Y v `PropertyEditor.vue` (`bboxOf(shape.points).minX/minY`, commit přes `gardenStore.moveShape()`) umožňuje přesně nastavit/posunout objekt číselně, nejen tažením. **Šipky** (při vybraném objektu, mimo textová pole) posunou o `gridSize` (se Shift ×5) — `onKeydown` v `GardenCanvas.vue` záměrně ignoruje `e.repeat`, protože `moveShape()` zapisuje plný snapshot do (50položkové) undo historie při každém volání a držení klávesy by ji OS auto-repeatem za pár vteřin zaplavilo; efekt je "jeden posun na jeden fyzický stisk", stejně jako v Figmě/Illustratoru.

**Seznam objektů** — prázdný stav pravého panelu (dřív jen placeholder "Vyber objekt") teď zobrazuje všechny `gardenStore.shapes` seskupené podle kategorie (`OBJECT_TYPES[s.typeId]?.category`), s vlastní skupinou "Vlastní tvary" pro tvary bez `typeId`. Klik na položku vybírá objekt (`uiStore.selectObject(id)` **bez** `{ focusName: true }` — nesmí krást focus, viz `focusNameTick` níže).

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

## Typy objektů a kreslení — "select-then-draw"

Kategorie v levém panelu odpovídají typickému postupu plánování zahrady:

| Kategorie          | Typy                                                              |
|---------------------|--------------------------------------------------------------------|
| Terén               | `lawn` (Trávník — kreslí se jako polygon, je to fakticky tvar pozemku/zahrady) |
| Stavby              | `house`, `shed`, `garage`, `fence`, `pergola`                     |
| Zpevněné plochy     | `path`, `terrace`, `parking`                                      |
| Vodní plochy        | `pond`, `pool`                                                     |
| Rostliny            | `tree`, `shrub`, `bed`, `herb`, `vegetable`, `flower`              |
| Ostatní             | `compost`, `greenhouse`, `sandbox`                                 |

Každý typ má: `id`, `label`, `color`, `category`, `defaultW`/`defaultH` (jen orientační hodnota v tooltipu), `shape` (doporučený nástroj — `rect`/`circle`/`polygon`), `icon`, `textureKey`. Stavby s obvykle nepravidelným půdorysem (`house`, `shed`, `garage`, `pergola`) mají `shape: 'polygon'`, takže se kreslí klikáním po vrcholech místo tažení obdélníku.

**Objekty se nepřidávají klikem hotové** — kliknutí na typ v panelu (`uiStore.selectObjectType()`) jen "nabije" aktivní barvu, texturu, výchozí název a přepne na odpovídající kreslicí nástroj (Obdélník/Kruh-Elipsa/Polygon). Uživatel pak tvar nakreslí sám tažením (obdélník, kruh/elipsa) nebo klikáním po vrcholech + Enter/dvojklik (polygon) — přesně na místo a s tvarem, jaký potřebuje. Po nakreslení objektu vybraného typu **zůstává stejný nástroj aktivní** (`uiStore.activePresetId` je nastavené), takže lze hned nakreslit další objekt stejného typu (např. víc stromů za sebou) — teprve ruční přepnutí na jiný nástroj/typ nebo Esc preset zruší (`uiStore.clearPreset()`). Bez vybraného typu (přímo přes nástroje Obdélník/Kruh/Polygon) vzniká generický tvar s plochou barvou a názvem "Objekt N".

Rozměry lze kdykoliv doladit přesně v pravém panelu (pole Šířka/Výška v metrech) nebo tažením vrcholů na canvasu.

**Kreslení přes existující tvary:** objekty jsou `draggable` jen v nástroji Výběr (`GardenObject.vue`, prop `draggable`), takže v kreslicích nástrojích lze bez obav kreslit i nad již existujícím tvarem (typicky nad trávníkem, který zabírá celou plochu) — nehrozí, že se místo nové kresby omylem přetáhne tvar pod kurzorem. Ze stejného důvodu je i výběr kliknutím (`@select`) v `GardenCanvas.vue` podmíněný `uiStore.activeTool === 'select'`, jinak by po nakreslení tvaru mohl Konva vlastní "click" syntézou (mousedown/mouseup nad stejným podkladovým tvarem) přebít výběr zpět na podkladový tvar.

---

## Klávesové zkratky

| Zkratka        | Akce                     |
|----------------|--------------------------|
| Ctrl+Z         | Zpět (undo)              |
| Ctrl+Y         | Vpřed (redo)             |
| Ctrl+C         | Kopírovat vybraný objekt |
| Ctrl+V         | Vložit zkopírovaný objekt (posunutý o 0,5 m, název + " (kopie)") |
| Delete/Backspace | Smazat vybraný objekt  |
| Šipky (←↑→↓)   | Posunout vybraný objekt o krok mřížky (Shift = ×5) |
| Mouse wheel    | Zoom in/out              |
| Drag (canvas)  | Posun pohledu (pan) — v nástroji Výběr vždy, v ostatních nástrojích jen s podrženým mezerníkem |
| Mezerník (podržet) | Dočasný posun plátna i uprostřed kreslení (obdélník/kruh/polygon) |
| Enter / 2× klik | Uzavřít rozkreslený polygon |
| Esc            | Zrušit kreslení, zpět na Výběr |

**Úprava existujícího tvaru:** tažením malých bílých koleček na vrcholech (`VertexHandles.vue`) posuneš vrchol — během tažení se od jeho živé pozice ke dvěma sousedním (skutečným) vrcholům kreslí přerušované náhledové hrany s popiskem délky, takže je vidět, jak bude hrana vypadat, ne jen osamocený bod (samotný tvar se ale nedeformuje živě, jen na dragend — viz poznámka v paměti projektu o konfliktu s Konva DnD); tažením menších přerušovaných koleček uprostřed hrany (`gardenStore.insertVertex()`) do tvaru vložíš nový vrchol přesně tam, kam ho odtáhneš (stejný náhled hran); dvojklik na vrchol jej smaže (`gardenStore.removeVertex()`, min. 3 vrcholy musí zůstat). Texturu existujícího objektu lze kdykoliv změnit v pravém panelu (sekce "Textura" pod barvou) — náhledy dlaždic se generují živě v aktuální barvě tvaru.

**Přesun celého objektu** je od teď samostatný nástroj **✥ Přesun** (`uiStore.activeTool === 'move'`), ne automatická vlastnost nástroje Výběr — `GardenObject.vue` je `draggable` jen v tomto nástroji, takže pouhé kliknutí/výběr objektu ve Výběru už ho nemůže omylem odtáhnout. Výběr kliknutím funguje v obou (Výběr i Přesun).

**Kruh/elipsa (`kind:'ellipse'`)** se needituje přes vrcholy — `EllipseHandles.vue` zobrazí jen 4 úchyty na krajích poloos (vpravo/vlevo/nahoře/dole). Vodorovný úchyt mění pouze `rx`, svislý pouze `ry` (`dragBoundFunc` zamyká druhou osu), takže tvar je matematicky vždy skutečnou elipsou/kruhem — nejde ho tažením zdeformovat do nepravidelného mnohoúhelníku. Živý náhled během tažení jde přes `previewPoints` prop na `GardenObject.vue` (stejný vzor jako `previewFontSize` u textu níže), do store se zapíše až na `dragend`.

**Volný text (nástroj Text, `kind:'text'`)** — klik na plán vytvoří text s výchozím obsahem "Text" a rovnou ho vybere s focusem v poli "Text" v pravém panelu (to pole je u textu zároveň editor jeho obsahu — u ostatních tvarů se stejné pole jmenuje "Název objektu" a na plátně se nezobrazuje). `TextHandles.vue` zobrazí jeden úchyt v odhadované pravé dolní části textu (vzdálenost od kotvy ~úměrná délce textu); tažením se mění `fontSize`, živě promítané přes `previewFontSize` prop, do store zapsané na `dragend`. Přesun textu funguje stejně jako u ostatních tvarů (nástroj Přesun), barva textu = `shape.color`.

**Kopírování/vkládání (Ctrl+C/V + tlačítka 📋/📄 v toolbaru)** — `uiStore.copyShape()` uloží hluboký klon vybraného tvaru (bez `id`) do `uiStore.clipboard`, takže vložení funguje i po smazání originálu. `gardenStore.pasteShape()` vytvoří novou kopii posunutou o 0,5 m v obou osách, s názvem `"<originál> (kopie)"`. **Vložení nezaostřuje pole Název** (na rozdíl od nově nakresleného tvaru), aby šlo opakovaně mačkat Ctrl+V bez nutnosti znovu klikat na plátno — viz `uiStore.focusNameTick` níže.

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

### ✅ Etapa 2 (částečně) — hotovo
- Snap-to-grid (přichytávání na mřížku) + volitelná hustota mřížky
- Kopírování/vkládání objektů (Ctrl+C, Ctrl+V + tlačítka v toolbaru)
- Volný text na plánu (přesun, živé zvětšení/zmenšení)
- Měřítko na canvas (1m = vyznačená vzdálenost) — hotovo už dřív
- Autosave indikátor v toolbaru
- Otevírání/ukládání z lokálního disku (File System Access API, s pamatováním posledního souboru) i z Google Disku (OAuth + Picker) — viz sekce "Otevírání souborů" výše. Google Disk vyžaduje jednorázové nastavení Client ID/API klíče vlastníkem projektu.

### Etapa 2 — zbývající plánované funkce
- Skupinový výběr (lasso nebo Shift+click)
- Průhlednost (opacity) objektu
- Export jako PNG/SVG obrázek
- Více plánů (tabs)

### ✅ Mobilní ovladatelnost — hotovo (v1.5.0)
- Boční panely jako vysouvací drawery pod 768px šířky, canvas na celou šířku
- Kreslení/výběr/tažení na dotyk (Konva pointer eventy místo mouse-only)
- Pinch-to-zoom + dvouprstý pan

### Etapa 3 — Pokročilé funkce
- Databáze rostlin (latinské názvy, požadavky)
- Companion planting (vhodné kombinace)
- Sezonní pohled (jaro/léto/podzim/zima)

---

## Poslední aktualizace

| Datum      | Verze | Popis                                      |
|------------|-------|--------------------------------------------|
| 2026-07-12 | 1.0.0 | Etapa 1 — kompletní základní implementace  |
| 2026-08-15 | 1.1.0 | Kreslení polygonem + volné pojmenování objektů (datový model přepsán na freeform `points`) |
| 2026-08-15 | —     | Oprava: panel "Objekty" v `ToolPanel.vue` obnoven (rychlé přidání typových objektů vč. rostlin — v1.1.0 ho omylem nepropojil), přidána editace přesných rozměrů (Šířka/Výška v m) v `PropertyEditor.vue`. |
| 2026-08-15 | —     | Grid toggle (▦ Mřížka v horní liště) + oprava pořadí vykreslování, které mřížku skrývalo pod podkladem pozemku. Měřítko + zoom tlačítka (−/+) dole uprostřed canvasu. |
| 2026-08-15 | —     | Větší přestavba workflow: kategorie objektů podle postupu plánování (Terén→Stavby→Zpevněné plochy→Vodní plochy→Rostliny→Ostatní), nový typ Trávník/Parkoviště/Bazén, nástroj Kruh/Elipsa, "select-then-draw" místo klik-a-hotovo, procedurální textury (`utils/textures.js`) místo plochých barev, oprava draggable/výběru při kreslení nad existujícím tvarem. |
| 2026-08-15 | —     | Odstraněna definice pozemku (`plot` state, dialog "Nastavení pozemku") — mřížka teď pokrývá celou (neomezenou) kreslicí plochu podle viditelné oblasti. Kruh/Elipsa nakreslí jen 8 vrcholů místo 24 (méně bodů k omylem posunutí). Dům/Chata-kůlna/Garáž/Pergola-altán se teď kreslí jako polygon, ne obdélník. |
| 2026-08-15 | —     | Živý popisek délky rozkreslené úsečky u nástroje Polygon. Podržený mezerník = dočasný posun plátna i uprostřed kreslení (dřív šlo posouvat jen v nástroji Výběr). Nové úchyty uprostřed hran (`gardenStore.insertVertex()`) — tažením lze do existujícího tvaru přidat další vrchol, ne jen posouvat ty stávající. |
| 2026-08-15 | —     | Oprava: `onStageDragMove` si při tažení vrcholu/objektu spletl bublající Konva event za pan stage a rozbil mřížku (viz paměť projektu). Dvojklik na vrchol jej smaže (`gardenStore.removeVertex()`, min. 3 vrcholy). Tažení vrcholu i mid-úchytu teď zobrazuje živé popisky délek obou sousedních hran. Nová sekce "Textura" v pravém panelu — texturu existujícího objektu lze kdykoliv změnit nezávisle na barvě. |
| 2026-08-15 | —     | Tažení vrcholu teď kreslí přerušovanou náhledovou hranu ke dvěma sousedním vrcholům (dřív jen osamocený bod bez náznaku hrany). Nový samostatný nástroj ✥ Přesun pro přesun celého objektu — v nástroji Výběr už objekty nejdou přesunout omylem, jen vybrat/upravit vrcholy. |
| 2026-08-15 | —     | Kruh/elipsa (`shape.kind === 'ellipse'`) už nejde rozšířit o další vrcholy (žádné mid-úchyty) — jen zvětšit/zmenšit přes pole Šířka/Výška nebo posunout stávající body. Na plátně přibyla trvalá nápověda k úpravě vybraného tvaru (dvojklik = smazat vrchol, tečkovaný úchyt = přidat vrchol) — dřív to nikde nebylo vysvětlené. Nevydáno jako nová verze — verzi je třeba zvýšit před dalším deployem. |
| 2026-08-17 | 1.2.0 | Přichytávání k mřížce (zapnout/vypnout + volitelná hustota `GRID_SIZES`) — nový `utils/grid.js`. Přidány store soubory dostaly HMR podporu (`acceptHMRUpdate`) po zjištění, že úprava store souboru za běhu dev serveru nechá viset starou instanci bez nových polí (viz paměť projektu). |
| 2026-08-17 | —     | Nový nástroj **Text** (`kind:'text'`) — volný popisek s vlastní `EllipseHandles`-podobnou logikou úchytu na zvětšení/zmenšení (`TextHandles.vue`, `fontSize`), přesouvatelný jako ostatní tvary. Jméno objektu se u ostatních tvarů přestalo zobrazovat na plátně (zůstává jen v panelu) — u textu ho nahradilo pole "Text", které JE zobrazovaný obsah. Autosave indikátor v toolbaru (`gardenStore.lastSavedAt`, tečka blikne při uložení). |
| 2026-08-17 | —     | Kopírování/vkládání (Ctrl+C/V + tlačítka). Kruh/elipsa přestala jít deformovat tažením vrcholů — `EllipseHandles.vue` nahradil `VertexHandles.vue` čtyřmi úchyty na krajích poloos, tvar tak zůstává matematicky vždy elipsou (viz sekce výše). Oprava: výběr JAKÉHOKOLIV objektu (i klikem na existující) kradl focus do pole Název/Text (`watch(selectedId)` v `PropertyEditor.vue`), takže klávesové zkratky jako Ctrl+C/V přestaly fungovat — `uiStore.selectObject()` teď zaostřuje pole jen s explicitním `{ focusName: true }`, volaným jen při vytvoření NOVÉHO tvaru, ne při obyčejném výběru. |
| 2026-08-19 | 1.3.0 | Otevírání souborů z lokálního disku (File System Access API + fallback) a z Google Disku (OAuth + Picker), s pamatováním naposledy otevřeného souboru mezi návštěvami (`fileSourceStore.js`, `ResumeSourceBanner.vue`). "Uložit" teď zapisuje zpět do navázaného souboru místo vždy stahovat novou kopii. `useStorage.js` composable smazán (nahrazen `fileSourceStore`). Google Disk vyžaduje jednorázové nastavení Client ID/API klíče vlastníkem projektu — viz "Google Disk — nastavení". |
| 2026-08-19 | 1.4.0 | **Hranice pozemku + vzdálenosti** (volitelná, kreslí se jako polygon — viz sekce "Pozemek a vzdálenosti"): nový `gardenStore.plot`, tlačítka v `ToolPanel.vue`, živé vodicí čáry na plátně i číselný readout v `PropertyEditor.vue` pro strom/keř/záhon. **`typeId`/`age`** na tvarech — appka si teď pamatuje, ze kterého presetu byl tvar nakreslen (dřív se to po nakreslení zapomnělo), s dodatečným "Typ objektu" selectem pro starší tvary. **Poloha (m) X/Y** pole + **šipky** pro jemný posun vybraného objektu (`e.repeat` záměrně ignorováno, ať nezaplaví undo historii). **Pravítka** nahoře/vlevo (`RulerBar.vue`) nahradila starou mřížkovou "rulerLabels" (popisky jen kolem počátku) — teď jsou vidět po celé šířce/výšce plátna při libovolném zoomu. **Seznam objektů** v prázdném stavu pravého panelu (seskupený podle kategorie). Poznámky přesunuty v `PropertyEditor.vue` hned pod název. |
| 2026-08-20 | 1.5.0 | **Mobilní ovladatelnost.** Appka dřív na úzké obrazovce (<768px) nešla vůbec používat — pevně řazený 3sloupcový layout (`ToolPanel` + canvas + `PropertyEditor`) nechal canvasu prakticky nulovou šířku, a kreslicí nástroje (`GardenCanvas.vue`) byly navázané jen na myší eventy (`mousedown`/`mouseup`/`mousemove`/`dblclick`), které se na dotyku vůbec nespouští. Pod `md` (768px) jsou teď oba boční panely překryvné drawery (`uiStore.mobilePanel`: `null`/`'tools'`/`'properties'`) vysouvané přes dva plovoucí úchyty na okraji canvasu (`App.vue`) — zavírají se křížkem, klikem na zástěnu, nebo automaticky (výběr nástroje zavře Nástroje, výběr objektu otevře Vlastnosti). Nad `md` beze změny, žádná regrese na desktopu. Stage bindingy přepnuty na Konva sjednocené pointer eventy (`@pointerdown`/`@pointermove`/`@pointerup`/`@pointerclick`/`@pointerdblclick` — fungují stejně pro myš i dotyk, nahradily dosavadní mouse-only bindingy i ruční dvojbind `@click`+`@tap`), takže kreslení obdélníku/kruhu/polygonu i umístění textu teď funguje i prstem. Přidán pinch-to-zoom + dvouprstý pan (`onTouchStart`/`onTouchMove`/`onTouchEnd` na stage, standardní Konva multi-touch recept přepočtený na souřadnice kontejneru přes `getBoundingClientRect()`) — na mobilu chybí kolečko myši i mezerník pro dočasný pan. Zvětšená dotyková plocha úchytů (`hitStrokeWidth` 12→16 ve `VertexHandles`/`EllipseHandles`/`TextHandles`) a horizontálně scrollovatelná horní lišta (`AppToolbar.vue`, `.no-scrollbar` v `style.css`), ať se na úzké obrazovce žádné tlačítko neztratí. |
| 2026-08-20 | 1.5.1 | **Opravy po prvním mobilním testu.** Rozbalovací nabídky "📂 Otevřít"/"⋯" v `AppToolbar.vue` byly na mobilu neviditelné — horizontální scroll lišty (`overflow-x-auto`, v1.5.0) podle CSS spec automaticky dopočítá i `overflow-y` na `auto`, což dolů vysouvající se `absolute` nabídku neviditelně ořízlo. Řešení: obě nabídky se teď teleportují (`<Teleport to="body">`) mimo scrollovaný kontejner, pozice se dopočítá z `getBoundingClientRect()` tlačítka při každém otevření. **`ResumeSourceBanner.vue`** přeformulován — dřív nebylo jasné, že to, co je vidět na plátně, je vždy poslední změna z autosave prohlížeče, a že tlačítko "Pokračovat" ve skutečnosti znovu načte a přepíše obsah ze souboru (a přesměruje tam budoucí "Uložit"); text i tlačítka ("Propojit a načíst" / "Ne, zůstat jen v prohlížeči") teď tohle říkají výslovně, layout navíc zalamuje na mobilu. **Google Disk OAuth** (`utils/googleDrive.js`) — `getAccessToken()` u interaktivních volání nejdřív potichu zkusí `prompt:''` (bez UI, funguje jen pokud už appka v tomto prohlížeči/účtu souhlas jednou dostala) a na plný souhlasový dialog spadne jen když tichý pokus selže — token byl navíc jen v paměti modulu, takže po každém refreshi stránky appka žádala o nový, i když ho technicky nepotřebovala. |
