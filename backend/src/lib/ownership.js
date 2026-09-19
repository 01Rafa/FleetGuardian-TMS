// Maintenance and parts belong to exactly one owner: a camion or a trailer.
// Tenancy is decided by the owner's empresaId.
export function belongsToEmpresa(record, empresaId) {
  const ownerEmpresaId = record?.camion?.empresaId ?? record?.trailer?.empresaId ?? null
  return ownerEmpresaId !== null && ownerEmpresaId === empresaId
}
