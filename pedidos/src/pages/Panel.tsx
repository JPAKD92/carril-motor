import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtMoney, fmtDate } from '../lib/format'
import { assignProvColors } from '../lib/provColor'
import type { PedidoItem } from '../types'
import { Trash2, Send, Package } from 'lucide-react'

export function Panel() {
  const { profile, isAdmin } = useAuth()
  const [items, setItems] = useState<PedidoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [qtyEdit, setQtyEdit] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('pedido_items').select('*').order('created_at')
    setItems((data ?? []) as PedidoItem[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const map = new Map<string, PedidoItem[]>()
    for (const it of items) {
      const key = it.proveedor || 'SIN PROVEEDOR'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(it)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [items])

  const totalGeneral = useMemo(() => items.reduce((s, i) => s + i.costo * i.cantidad, 0), [items])
  const colors = useMemo(() => assignProvColors(groups.map(([p]) => p)), [groups])

  const detail = selected ? groups.find(([p]) => p === selected)?.[1] ?? [] : []
  const checkedItems = detail.filter(i => checked.has(i.id))
  const checkedTotal = checkedItems.reduce((s, i) => s + i.costo * i.cantidad, 0)

  function selectProv(p: string) {
    if (selected === p) { setSelected(null); setChecked(new Set()) }
    else { setSelected(p); setChecked(new Set()) }
  }

  async function updateQty(item: PedidoItem, value: string) {
    const cantidad = parseFloat(value.replace(',', '.'))
    setQtyEdit(prev => { const n = { ...prev }; delete n[item.id]; return n })
    if (!cantidad || cantidad <= 0 || cantidad === item.cantidad) return
    const { error } = await supabase
      .from('pedido_items')
      .update({ cantidad, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (error) alert('Error al actualizar: ' + error.message)
    load()
  }

  async function removeItem(item: PedidoItem) {
    if (!confirm(`¿Eliminar "${item.descripcion.slice(0, 60)}" (cantidad ${item.cantidad})?`)) return
    const { error } = await supabase.from('pedido_items').delete().eq('id', item.id)
    if (error) { alert('Error al eliminar: ' + error.message); return }
    load()
  }

  async function pasarPedido() {
    if (!profile || checkedItems.length === 0) return
    const total = fmtMoney(checkedTotal)
    if (!confirm(`¿Confirmás que pasaste el pedido a ${selected}?\n\n${checkedItems.length} ítem(s) por ${total}.\n\nLos ítems pasan al historial con fecha de hoy.`)) return
    setSending(true)
    const rows = checkedItems.map(i => ({
      codigo: i.codigo,
      descripcion: i.descripcion,
      proveedor: i.proveedor,
      costo: i.costo,
      cantidad: i.cantidad,
      observacion: i.observacion,
      es_manual: i.es_manual,
      anotado_por: i.created_by_name,
      anotado_at: i.created_at,
      pedido_por: profile.id,
      pedido_por_name: profile.name,
    }))
    const { error } = await supabase.from('pedido_historial').insert(rows)
    if (error) { alert('Error al registrar el pedido: ' + error.message); setSending(false); return }
    const ids = checkedItems.map(i => i.id)
    const { error: delError } = await supabase.from('pedido_items').delete().in('id', ids)
    if (delError) alert('El pedido se registró pero no se pudieron quitar los ítems: ' + delError.message)
    setSending(false)
    setChecked(new Set())
    load()
  }

  if (loading) return <div className="text-center text-gray-500 py-12">Cargando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">Panel por proveedor</h1>
        <div className="text-sm text-gray-600">
          {items.length} ítem(s) anotados — Total: <b className="text-gray-900">{fmtMoney(totalGeneral)}</b>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="text-center text-gray-500 py-16 bg-white border border-gray-200 rounded-lg">
          <Package size={32} className="mx-auto mb-2 text-gray-300" />
          No hay nada anotado todavía.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {groups.map(([prov, its]) => {
          const total = its.reduce((s, i) => s + i.costo * i.cantidad, 0)
          const active = selected === prov
          const c = colors.get(prov)!
          return (
            <button key={prov} onClick={() => selectProv(prov)}
              className={`text-left border rounded-lg p-3 transition-colors ${
                active ? 'bg-gray-900 border-gray-900 text-white' : `${c.bg} ${c.border} hover:border-gray-500`
              }`}>
              <div className={`flex items-center gap-2 font-semibold text-sm ${active ? 'text-white' : c.text}`} title={prov}>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                <span className="truncate">{prov}</span>
              </div>
              <div className={`text-xs mt-1 ${active ? 'text-gray-300' : 'text-gray-500'}`}>
                {its.length} ítem(s)
              </div>
              <div className={`text-sm font-bold mt-1 ${active ? 'text-white' : 'text-gray-900'}`}>
                {fmtMoney(total)}
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-wrap gap-2">
            <h2 className={`flex items-center gap-2 font-bold ${(colors.get(selected) ?? assignProvColors([selected]).get(selected)!).text}`}>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${(colors.get(selected) ?? assignProvColors([selected]).get(selected)!).dot}`} />
              {selected}
            </h2>
            {isAdmin && (
              <button onClick={pasarPedido} disabled={checkedItems.length === 0 || sending}
                className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-800 disabled:opacity-40">
                <Send size={15} />
                {sending ? 'Registrando...' : `Pasé el pedido (${checkedItems.length} — ${fmtMoney(checkedTotal)})`}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  {isAdmin && (
                    <th className="px-3 py-2">
                      <input type="checkbox"
                        checked={detail.length > 0 && checkedItems.length === detail.length}
                        onChange={e => setChecked(e.target.checked ? new Set(detail.map(i => i.id)) : new Set())} />
                    </th>
                  )}
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium text-center">Cant.</th>
                  <th className="px-3 py-2 font-medium text-right">Costo</th>
                  <th className="px-3 py-2 font-medium text-right">CxQ</th>
                  <th className="px-3 py-2 font-medium">Anotó</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detail.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={checked.has(item.id)}
                          onChange={e => {
                            const n = new Set(checked)
                            if (e.target.checked) n.add(item.id); else n.delete(item.id)
                            setChecked(n)
                          }} />
                      </td>
                    )}
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {item.codigo || <span className="text-gray-400 italic">manual</span>}
                    </td>
                    <td className="px-3 py-2">
                      {item.descripcion}
                      {item.observacion && (
                        <div className="text-xs text-amber-700 mt-0.5">Obs: {item.observacion}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="number" min="0" step="any"
                        value={qtyEdit[item.id] ?? String(item.cantidad)}
                        onChange={e => setQtyEdit({ ...qtyEdit, [item.id]: e.target.value })}
                        onBlur={e => updateQty(item, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        className="w-16 border border-gray-200 rounded px-1 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-gray-800" />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(item.costo)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{fmtMoney(item.costo * item.cantidad)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {item.created_by_name}
                      <div className="text-gray-400">{fmtDate(item.created_at)}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeItem(item)} className="text-gray-400 hover:text-red-600" title="Eliminar">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
