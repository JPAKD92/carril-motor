// Color estable por proveedor: el mismo nombre siempre da el mismo color.
const PALETTE = [
  { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  { dot: 'bg-lime-600', text: 'text-lime-700', bg: 'bg-lime-50', border: 'border-lime-200' },
  { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { dot: 'bg-teal-500', text: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  { dot: 'bg-sky-500', text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
  { dot: 'bg-blue-600', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  { dot: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  { dot: 'bg-violet-500', text: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  { dot: 'bg-fuchsia-500', text: 'text-fuchsia-700', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200' },
  { dot: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
]

function hashIdx(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % PALETTE.length
}

export function provColor(name: string) {
  return PALETTE[hashIdx(name)]
}

// Para el panel: si dos proveedores visibles chocan en el mismo color,
// el segundo toma el siguiente color libre así todas las tarjetas se distinguen.
export function assignProvColors(names: string[]) {
  const used = new Set<number>()
  const map = new Map<string, (typeof PALETTE)[number]>()
  for (const name of names) {
    let idx = hashIdx(name)
    if (used.size < PALETTE.length) {
      while (used.has(idx)) idx = (idx + 1) % PALETTE.length
    }
    used.add(idx)
    map.set(name, PALETTE[idx])
  }
  return map
}
