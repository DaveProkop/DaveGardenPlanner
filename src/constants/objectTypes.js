// Pořadí kategorií odpovídá typickému postupu při plánování zahrady:
// nejdřív terén (trávník), pak stavby, zpevněné plochy, vodní plochy a nakonec rostliny.
export const CATEGORIES = {
  TERRAIN:    { id: 'terrain',    label: 'Terén' },
  STRUCTURES: { id: 'structures', label: 'Stavby' },
  HARDSCAPE:  { id: 'hardscape',  label: 'Zpevněné plochy' },
  WATER:      { id: 'water',      label: 'Vodní plochy' },
  PLANTS:     { id: 'plants',     label: 'Rostliny' },
  OTHER:      { id: 'other',      label: 'Ostatní' },
}

// `shape` = výchozí nástroj kreslení pro tento typ ('rect' | 'circle' | 'polygon').
// `textureKey` = klíč generátoru textury z utils/textures.js.
export const OBJECT_TYPES = {
  // Terén
  lawn:      { id: 'lawn',      label: 'Trávník',    color: '#7CB342', category: 'terrain',    defaultW: 10, defaultH: 8,   shape: 'polygon', icon: '🌾', textureKey: 'grass' },
  // Stavby
  house:     { id: 'house',     label: 'Dům',        color: '#A0785A', category: 'structures', defaultW: 10, defaultH: 8,   shape: 'polygon', icon: '🏠', textureKey: 'brick' },
  shed:      { id: 'shed',      label: 'Chata/kůlna',color: '#B8906A', category: 'structures', defaultW: 4,  defaultH: 3,   shape: 'polygon', icon: '🏚️', textureKey: 'wood' },
  garage:    { id: 'garage',    label: 'Garáž',      color: '#9B8872', category: 'structures', defaultW: 5,  defaultH: 5,   shape: 'polygon', icon: '🏗️', textureKey: 'stone' },
  fence:     { id: 'fence',     label: 'Plot',       color: '#8B6914', category: 'structures', defaultW: 10, defaultH: 0.3, shape: 'rect',    icon: '🚧', textureKey: 'wood' },
  pergola:   { id: 'pergola',   label: 'Pergola/altán', color: '#DEB887', category: 'structures', defaultW: 4, defaultH: 3, shape: 'polygon', icon: '⛺', textureKey: 'wood' },
  // Zpevněné plochy
  path:      { id: 'path',      label: 'Cesta',      color: '#C8B89A', category: 'hardscape',  defaultW: 6,  defaultH: 1.5, shape: 'rect',    icon: '🛤️', textureKey: 'stone' },
  terrace:   { id: 'terrace',   label: 'Terasa',     color: '#D2B48C', category: 'hardscape',  defaultW: 6,  defaultH: 4,   shape: 'rect',    icon: '🪨', textureKey: 'stone' },
  parking:   { id: 'parking',   label: 'Parkoviště', color: '#8C8C8C', category: 'hardscape',  defaultW: 5,  defaultH: 3,   shape: 'rect',    icon: '🅿️', textureKey: 'stone' },
  // Vodní plochy
  pond:      { id: 'pond',      label: 'Jezírko',    color: '#4A90D9', category: 'water',      defaultW: 3,  defaultH: 2,   shape: 'circle',  icon: '💧', textureKey: 'water' },
  pool:      { id: 'pool',      label: 'Bazén',      color: '#5DADE2', category: 'water',      defaultW: 6,  defaultH: 3,   shape: 'rect',    icon: '🏊', textureKey: 'water' },
  // Rostliny
  tree:      { id: 'tree',      label: 'Strom',      color: '#228B22', category: 'plants',     defaultW: 4,  defaultH: 4,   shape: 'circle',  icon: '🌳', textureKey: 'foliage' },
  shrub:     { id: 'shrub',     label: 'Keř',        color: '#556B2F', category: 'plants',     defaultW: 1.5,defaultH: 1.5, shape: 'circle',  icon: '🌿', textureKey: 'foliage' },
  bed:       { id: 'bed',       label: 'Záhon',      color: '#8FBC8F', category: 'plants',     defaultW: 3,  defaultH: 1.2, shape: 'rect',    icon: '🌱', textureKey: 'foliage' },
  herb:      { id: 'herb',      label: 'Bylinky',    color: '#6B8E23', category: 'plants',     defaultW: 1,  defaultH: 1,   shape: 'rect',    icon: '🌿', textureKey: 'foliage' },
  vegetable: { id: 'vegetable', label: 'Zelenina',   color: '#3CB371', category: 'plants',     defaultW: 2,  defaultH: 1.2, shape: 'rect',    icon: '🥕', textureKey: 'foliage' },
  flower:    { id: 'flower',    label: 'Květiny',    color: '#FF69B4', category: 'plants',     defaultW: 1,  defaultH: 1,   shape: 'circle',  icon: '🌸', textureKey: 'foliage' },
  // Ostatní
  compost:   { id: 'compost',   label: 'Kompostér',  color: '#8B4513', category: 'other',      defaultW: 1.5,defaultH: 1.5, shape: 'rect',    icon: '♻️', textureKey: 'wood' },
  greenhouse:{ id: 'greenhouse',label: 'Skleník',    color: '#B0E0E6', category: 'other',      defaultW: 4,  defaultH: 3,   shape: 'rect',    icon: '🏡', textureKey: 'glass' },
  sandbox:   { id: 'sandbox',   label: 'Pískoviště', color: '#F4A460', category: 'other',      defaultW: 2,  defaultH: 2,   shape: 'rect',    icon: '🏖️', textureKey: 'sand' },
}

export const OBJECTS_BY_CATEGORY = Object.values(OBJECT_TYPES).reduce((acc, type) => {
  if (!acc[type.category]) acc[type.category] = []
  acc[type.category].push(type)
  return acc
}, {})
