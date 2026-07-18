import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtMoney } from '../lib/format'
import { provColor } from '../lib/provColor'
import { Search } from 'lucide-react'

interface ProvConfig {
  minimo_activo: boolean
  monto_minimo: number
}

export function Proveedores() {
  const [nombres, setNombres] = useState<string[]>([])
  const [config, setConfig] = useState<Map<string, ProvConfig>>(new Map())
  const [montoEdit, setMontoEdit] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const [{ data: provs }, { data: cfgs }] = await Promise.all([
      supabase.from('pedido_proveedores').select('proveedor').order('proveedor'),
      supabase.from('pedido_proveedor_config').select('*'),
    ])
    setNombres((provs ?? []).map(p => p.proveedor as string))
    const map = new Map<string, ProvConfig>()
    for (const c of cfgs ?? []) map.set(c.proveedor, { minimo_activo: c.minimo_activo, monto_minimo: Number(c.monto_minimo) })
    setConfig(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save(proveedor: string, cfg: ProvConfig) {
    setError('')
    const { error } = await supabase.from('pedido_proveedor_config').upsert({
      proveedor,
      minimo_activo: cfg.minimo_activo,
      monto_minimo: cfg.monto_minimo,
      updated_at: new Date().toISOString(),
    })
    if (error) { setError('Error al guardar: ' + error.message); return }
    setConfig(prev => new Map(prev).set(proveedor, cfg))
  }

  function toggleMinimo(proveedor: string, activo: boolean) {
    const prev = config.get(proveedor) ?? { minimo_activo: false, monto_minimo: 0 }
    save(proveedor, { ...prev, minimo_activo: activo })
  }

  function saveMonto(proveedor: string, value: string) {
    setMontoEdit(p => { const n = { ...p }; delete n[proveedor]; return n })
    const monto = parseFloat(value.replace(/\./g, '').replace(',', '.'))
    const prev = config.get(proveedor) ?? { minimo_activo: true, monto_minimo: 0 }
    if (!isFinite(monto) || monto < 0 || monto === prev.monto_minimo) return
    save(proveedor, { ...prev, monto_minimo: monto })
  }

  const visibles = useMemo(() => {
    const f = filtro.trim().toLowerCase()
    return f ? nombres.filter(n => n.toLowerCase().includes(f)) : nombres
  }, [nombres, filtro])

  if (loading) return <div className="text-center text-gray-500 py-12">Cargando...</div>

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Proveedores</h1>
      <p className="text-sm text-gray-500 mb-4">
        Activá el tilde para exigir un monto mínimo de pedido: el Panel no va a dejar pasar un pedido a ese proveedor
        por menos de ese monto.
      </p>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3 text-sm">{error}</div>}

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar proveedores..."
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-800" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {visibles.map(prov => {
          const cfg = config.get(prov) ?? { minimo_activo: false, monto_minimo: 0 }
          const c = provColor(prov)
          return (
            <div key={prov} className="flex items-center px-4 py-2.5 gap-3 text-sm flex-wrap">
              <span className={`flex items-center gap-2 font-medium flex-1 min-w-48 ${c.text}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                {prov}
              </span>
              <label className="flex items-center gap-1.5 text-gray-600 whitespace-nowrap cursor-pointer">
                <input type="checkbox" checked={cfg.minimo_activo}
                  onChange={e => toggleMinimo(prov, e.target.checked)} />
                Monto mínimo
              </label>
              {cfg.minimo_activo && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">$</span>
                  <input type="text" inputMode="decimal"
                    value={montoEdit[prov] ?? (cfg.monto_minimo ? String(cfg.monto_minimo) : '')}
                    onChange={e => setMontoEdit({ ...montoEdit, [prov]: e.target.value })}
                    onBlur={e => saveMonto(prov, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    placeholder="0"
                    className="w-32 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-800" />
                </div>
              )}
              {cfg.minimo_activo && cfg.monto_minimo > 0 && !(prov in montoEdit) && (
                <span className="text-xs text-gray-400 whitespace-nowrap">{fmtMoney(cfg.monto_minimo)}</span>
              )}
            </div>
          )
        })}
        {visibles.length === 0 && (
          <div className="text-center text-gray-400 py-8 text-sm">No hay proveedores que coincidan.</div>
        )}
      </div>
    </div>
  )
}
