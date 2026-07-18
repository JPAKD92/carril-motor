export const fmtMoney = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
  ' ' +
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
