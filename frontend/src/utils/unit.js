// A truck or trailer is identified on screen by its unit number; the plate is the fallback.
export const hasUnitNumber = (unit) => Boolean(unit?.numeroUnidad?.trim())

export const unitLabel = (unit) => unit?.numeroUnidad?.trim() || unit?.placa
