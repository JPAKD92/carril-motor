import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtMoney, fmtDate } from '../lib/format'
import { provColor } from '../lib/provColor'
import type { HistorialItem } from '../types'
import { Undo2, Trash2 } from 'lucide-react'

const daysAgo = (n: number) => {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export function Historial() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState<HistorialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [prov, setProv] = useState('')
  const [desde, setDesde] = useState(daysAgo(60))
  const [hasta, setHasta] = useState('')
  const [q, setQ] = useState('')
  const [proveedores, setProveedores] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('pedido_historial').select('*').order('fecha_pedido', { ascending: false }).limit(2000)
    if (desde) query = query.gte('fecha_pedido', new Date(desde + 'T00:00:00').toISOString())
    if (hasta) query = query.lte('fecha_pedido', new Date(hasta + 'T23:59:59').toISOString())
    if (prov) query = query.eq('proveedor', prov)
    const term = q.trim().replace(/[,()%]/g, ' ').trim()
    if (term) query = query.or(`codigo.ilike.*${term}*,descripcion.ilike.*${term}*`)
    const { data } = await query
    setRows((data ?? []) as HistorialItem[])
    setLoading(false)
  }, [desde, hasta, prov, q])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    supabase.from('pedido_historial').select('proveedor').then(({ data }) => {
      const set = new Set((data ?? []).map(d => d.proveedor as string).filter(Boolean))
      setProveedores([...set].sort())
    })
  }, [rows.length])

  const total = useMemo(() => rows.reduce((s, r) => s + r.costo * r.cantidad, 0), [rows])

  const grouped = useMemo(() => {
    const map = new Map<string, HistorialItem[]>()
    for (const r of rows) {
      const key = fmtDate(r.fecha_pedido)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return [...map.entries()]
  }, [rows])

  async function volverAPendientes(r: HistorialItem) {
    if (!confirm(`¿Volver "${r.descripcion.slice(0, 60)}" a pendientes?\nSe quita del historial y vuelve a aparecer como anotado.`)) return
    const { error } = await supabase.from('pedido_items').insert({
      codigo: r.codigo,
      descripcion: r.descripcion,
      proveedor: r.proveedor,
      costo: r.costo,
      cantidad: r.cantidad,
      observacion: r.observacion,
      es_manual: r.es_manual,
      created_by: r.pedido_por,
      created_by_name: r.anotado_por,
    })
    if (error) { alert('Error: ' + error.message); return }
    const { error: delError } = await supabase.from('pedido_historial').delete().eq('id', r.id)
    if (delError) alert('Se creó el pendiente pero no se pudo quitar del historial: ' + delError.message)
    load()
  }

  async function borrar(r: HistorialItem) {
    if (!confirm(`¿Borrar del historial "${r.descripcion.slice(0, 60)}" (cantidad ${r.cantidad}, pedido el ${fmtDate(r.fecha_pedido)})?\n\nEsto es definitivo: deja de contar para el aviso de "pedido hace menos de 15 días".`)) return
    const { error } = await supabase.from('pedido_historial').delete().eq('id', r.id)
    if (error) { alert('Error al borrar: ' + error.message); return }
    load()
  }

  const inputCls = 'border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-800'

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">Historial de pedidos</h1>
        <div className="text-sm text-gray-600">
          {rows.length} ítem(s) — Total: <b className="text-gray-900">{fmtMoney(total)}</b>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Proveedor</label>
          <select value={prov} onChange={e => setProv(e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={inputCls} />
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs text-gray-500 mb-1">Buscar</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Código o descripción" className={inputCls + ' w-full'} />
        </div>
      </div>

      {loading && <div className="text-center text-gray-500 py-8">Cargando...</div>}

      {!loading && rows.length === 0 && (
        <div className="text-center text-gray-500 py-16 bg-white border border-gray-200 rounded-lg">
          No hay pedidos en el período seleccionado.
        </div>
      )}

      {!loading && grouped.map(([date, its]) => {
        const subtotal = its.reduce((s, r) => s + r.costo * r.cantidad, 0)
        return (
          <div key={date} className="bg-white border border-gray-200 rounded-lg mb-4 overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <span className="font-semibold text-sm text-gray-900">Pedido del {date}</span>
              <span className="text-sm text-gray-600">{its.length} ítem(s) — <b className="text-gray-900">{fmtMoney(subtotal)}</b></span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium">Proveedor</th>
                  <th className="px-3 py-2 font-medium text-center">Cant.</th>
                  <th className="px-3 py-2 font-medium text-right">Costo</th>
                  <th className="px-3 py-2 font-medium text-right">CxQ</th>
                  <th className="px-3 py-2 font-medium">Pidió</th>
                  {isAdmin && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {its.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {r.codigo || <span className="text-gray-400 italic">manual</span>}
                    </td>
                    <td className="px-3 py-2">
                      {r.descripcion}
                      {r.observacion && <div className="text-xs text-amber-700 mt-0.5">Obs: {r.observacion}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 font-medium ${provColor(r.proveedor).text}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${provColor(r.proveedor).dot}`} />
                        {r.proveedor}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">{r.cantidad}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(r.costo)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{fmtMoney(r.costo * r.cantidad)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{r.pedido_por_name}</td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={() => volverAPendientes(r)} className="text-gray-400 hover:text-gray-900 mr-2" title="Volver a pendientes">
                          <Undo2 size={15} />
                        </button>
                        <button onClick={() => borrar(r)} className="text-gray-400 hover:text-red-600" title="Borrar del historial">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
