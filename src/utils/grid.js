// Zaokrouhlí hodnotu na nejbližší násobek kroku (step v libovolné jednotce —
// metry pro kreslicí body, px pro tažení po Konva stage).
export function snapValue(value, step) {
  if (!step) return value
  return Math.round(value / step) * step
}

// Přichytí absolutní (obrazovkovou) pozici taženého Konva uzlu k mřížce,
// se zohledněním aktuálního posunu/přiblížení stage. `ppm` = pixelů na metr
// při zoomu 1, `gridSize` = rozestup mřížky v metrech.
export function snapStagePos(pos, stage, ppm, gridSize) {
  const unit = gridSize * ppm * stage.scaleX()
  return {
    x: stage.x() + snapValue(pos.x - stage.x(), unit),
    y: stage.y() + snapValue(pos.y - stage.y(), unit),
  }
}
