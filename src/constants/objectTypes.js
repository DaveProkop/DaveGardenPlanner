export const CATEGORIES = {
  STRUCTURES: { id: 'structures', label: 'Stavby' },
  PLANTS: { id: 'plants', label: 'Rostliny' },
  OTHER: { id: 'other', label: 'Ostatní' },
}

export const OBJECT_TYPES = {
  // Stavby
  house:     { id: 'house',     label: 'Dům',        color: '#A0785A', category: 'structures', defaultW: 10, defaultH: 8,   shape: 'rect',   icon: '🏠' },
  shed:      { id: 'shed',      label: 'Chata/kůlna', color: '#B8906A', category: 'structures', defaultW: 4,  defaultH: 3,   shape: 'rect',   icon: '🏚️' },
  garage:    { id: 'garage',    label: 'Garáž',      color: '#9B8872', category: 'structures', defaultW: 5,  defaultH: 5,   shape: 'rect',   icon: '🏗️' },
  fence:     { id: 'fence',     label: 'Plot',       color: '#8B6914', category: 'structures', defaultW: 10, defaultH: 0.3, shape: 'rect',   icon: '🚧' },
  path:      { id: 'path',      label: 'Cesta',      color: '#C8B89A', category: 'structures', defaultW: 6,  defaultH: 1.5, shape: 'rect',   icon: '🛤️' },
  pergola:   { id: 'pergola',   label: 'Pergola',    color: '#DEB887', category: 'structures', defaultW: 4,  defaultH: 3,   shape: 'rect',   icon: '⛺' },
  terrace:   { id: 'terrace',   label: 'Terasa',     color: '#D2B48C', category: 'structures', defaultW: 6,  defaultH: 4,   shape: 'rect',   icon: '🪨' },
  // Rostliny
  tree:      { id: 'tree',      label: 'Strom',      color: '#228B22', category: 'plants',     defaultW: 4,  defaultH: 4,   shape: 'circle', icon: '🌳' },
  shrub:     { id: 'shrub',     label: 'Keř',        color: '#556B2F', category: 'plants',     defaultW: 1.5,defaultH: 1.5, shape: 'circle', icon: '🌿' },
  bed:       { id: 'bed',       label: 'Záhon',      color: '#8FBC8F', category: 'plants',     defaultW: 3,  defaultH: 1.2, shape: 'rect',   icon: '🌱' },
  herb:      { id: 'herb',      label: 'Bylinky',    color: '#6B8E23', category: 'plants',     defaultW: 1,  defaultH: 1,   shape: 'rect',   icon: '🌿' },
  vegetable: { id: 'vegetable', label: 'Zelenina',   color: '#3CB371', category: 'plants',     defaultW: 2,  defaultH: 1.2, shape: 'rect',   icon: '🥕' },
  flower:    { id: 'flower',    label: 'Květiny',    color: '#FF69B4', category: 'plants',     defaultW: 1,  defaultH: 1,   shape: 'circle', icon: '🌸' },
  // Ostatní
  pond:      { id: 'pond',      label: 'Jezírko',    color: '#4A90D9', category: 'other',      defaultW: 3,  defaultH: 2,   shape: 'ellipse',icon: '💧' },
  compost:   { id: 'compost',   label: 'Kompostér',  color: '#8B4513', category: 'other',      defaultW: 1.5,defaultH: 1.5, shape: 'rect',   icon: '♻️' },
  greenhouse:{ id: 'greenhouse',label: 'Skleník',    color: '#B0E0E6', category: 'other',      defaultW: 4,  defaultH: 3,   shape: 'rect',   icon: '🏡' },
  sandbox:   { id: 'sandbox',   label: 'Pískoviště', color: '#F4A460', category: 'other',      defaultW: 2,  defaultH: 2,   shape: 'rect',   icon: '🏖️' },
}

export const OBJECTS_BY_CATEGORY = Object.values(OBJECT_TYPES).reduce((acc, type) => {
  if (!acc[type.category]) acc[type.category] = []
  acc[type.category].push(type)
  return acc
}, {})
