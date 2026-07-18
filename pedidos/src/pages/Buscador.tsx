import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtMoney, fmtDate } from '../lib/format'
import type { CatalogoItem, PedidoItem, HistorialItem } from '../types'
import { Search, Plus, AlertTriangle, CheckCircle2, X } from 'lucide-react'

interface ModalState {
  mode: 'catalogo' | 'manual'
  codigo: string
  descripcion: string
  proveedor: string
  costo: string
  cantidad: string
  observacion: string
  existing: PedidoItem | null
  recent: HistorialItem | null
  checked: boolean
}

const cleanTerm = (s: string) => s.replace(/[,()%]/g, ' ').trim()

export function Buscador() {
  const { profile } = useAuth()
  const [q, setQ] = useState('')
  const [provFilter, setProvFilter] = useState('')
  const [results, setResults] = useState<CatalogoItem[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [pending, setPending] = useState<Map<string, PedidoItem>>(new Map())
  const [proveedores, setProveedores] = useState<string[]>([])
  const [modal, setModal] = useState<ModalState | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadPending = useCallback(async () => {
    const { data } = await supabase.from('pedido_items').select('*')
    const map = new Map<string, PedidoItem>()
    for (const it of (data ?? []) as PedidoItem[]) {
      if (it.codigo) map.set(it.codigo, it)
    }
    setPending(map)
  }, [])

  useEffect(() => {
    loadPending()
    supabase.from('pedido_proveedores').select('proveedor').order('proveedor').then(({ data }) => {
      setProveedores((data ?? []).map(d => d.proveedor as string))
    })
  }, [loadPending])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const term = q.trim()
    if (term.length < 2 && !provFilter) {
      setResults([])
      setSearched(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const words = cleanTerm(term).split(/\s+/).filter(Boolean)
      let query = supabase.from('pedido_catalogo').select('*').limit(100).order('codigo')
      if (provFilter) query = query.eq('proveedor', provFilter)
      if (words.length > 0) {
        const descAnd = words.map(w => `descripcion.ilike.*${w}*`).join(',')
        const codigoFilter = `codigo.ilike.*${cleanTerm(term).replace(/\s+/g, '')}*`
        query = query.or(`${codigoFilter},and(${descAnd})`)
      }
      const { data } = await query
      setResults((data ?? []) as CatalogoItem[])
      setSearching(false)
      setSearched(true)
    }, 300)
  }, [q, provFilter])

  async function checkRecent(codigo: string): Promise<HistorialItem | null> {
    if (!codigo) return null
    const since = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('pedido_historial')
      .select('*')
      .eq('codigo', codigo)
      .gte('fecha_pedido', since)
      .order('fecha_pedido', { ascending: false })
      .limit(1)
    return (data?.[0] as HistorialItem) ?? null
  }

  async function openCatalogo(item: CatalogoItem) {
    const existing = pending.get(item.codigo) ?? null
    const recent = await checkRecent(item.codigo)
    setModal({
      mode: 'catalogo',
      codigo: item.codigo,
      descripcion: item.descripcion,
      proveedor: item.proveedor,
      costo: String(item.costo),
      cantidad: existing ? String(existing.cantidad) : '1',
      observacion: existing ? existing.observacion : '',
      existing,
      recent,
      checked: true,
    })
  }

  function openManual() {
    setModal({
      mode: 'manual',
      codigo: '',
      descripcion: '',
      proveedor: '',
      costo: '',
      cantidad: '1',
      observacion: '',
      existing: null,
      recent: null,
      checked: false,
    })
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function saveModal() {
    if (!modal || !profile) return
    const codigo = modal.codigo.trim().toUpperCase()
    const descripcion = modal.descripcion.trim()
    const proveedor = modal.proveedor.trim()
    const cantidad = parseFloat(modal.cantidad.replace(',', '.'))
    const costo = parseFloat(modal.costo.replace(',', '.')) || 0
    if (!descripcion) { alert('Falta la descripción'); return }
    if (!proveedor) { alert('Falta el proveedor'); return }
    if (!cantidad || cantidad <= 0) { alert('Cantidad inválida'); return }

    // Para ítems manuales con código: chequear duplicado/pedido reciente antes de guardar
    if (modal.mode === 'manual' && codigo && !modal.checked) {
      const existing = pending.get(codigo) ?? null
      const recent = await checkRecent(codigo)
      if (existing || recent) {
        setModal({
          ...modal,
          existing,
          recent,
          cantidad: existing ? String(existing.cantidad) : modal.cantidad,
          checked: true,
        })
        return
      }
    }

    setSaving(true)
    if (modal.existing) {
      const { error } = await supabase
        .from('pedido_items')
        .update({ cantidad, costo, observacion: modal.observacion.trim(), updated_at: new Date().toISOString() })
        .eq('id', modal.existing.id)
      if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return }
      showToast(`Cantidad actualizada: ${descripcion.slice(0, 40)} × ${cantidad}`)
    } else {
      const { error } = await supabase.from('pedido_items').insert({
        codigo,
        descripcion,
        proveedor,
        costo,
        cantidad,
        observacion: modal.observacion.trim(),
        es_manual: modal.mode === 'manual',
        created_by: profile.id,
        created_by_name: profile.name,
      })
      if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return }
      showToast(`Anotado: ${descripcion.slice(0, 40)} × ${cantidad}`)
    }
    setSaving(false)
    setModal(null)
    loadPending()
  }

  const inputCls = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800'

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">Buscador</h1>
        <button onClick={openManual}
          className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800">
          <Plus size={16} /> Ítem manual
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap sm:flex-nowrap">
        <div className="relative flex-1 min-w-52">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por código o descripción..."
            className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
        <select
          value={provFilter}
          onChange={e => setProvFilter(e.target.value)}
          className={`border rounded-lg px-3 py-3 text-sm max-w-64 focus:outline-none focus:ring-2 focus:ring-gray-800 ${
            provFilter ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {searching && <div className="text-sm text-gray-400 py-2">Buscando...</div>}

      {!searching && searched && results.length === 0 && (
        <div className="text-center text-gray-500 py-10 bg-white border border-gray-200 rounded-lg">
          No se encontraron códigos.
          <button onClick={openManual} className="text-gray-900 font-medium underline ml-1">Cargar ítem manual</button>
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Descripción</th>
                <th className="px-3 py-2 font-medium">Proveedor</th>
                <th className="px-3 py-2 font-medium text-right">Costo</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map(item => {
                const anotado = pending.get(item.codigo)
                return (
                  <tr key={item.codigo} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{item.codigo}</td>
                    <td className="px-3 py-2">{item.descripcion}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{item.proveedor}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(item.costo)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {anotado ? (
                        <button onClick={() => openCatalogo(item)}
                          className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium hover:bg-green-200">
                          <CheckCircle2 size={13} /> Anotado × {anotado.cantidad}
                        </button>
                      ) : (
                        <button onClick={() => openCatalogo(item)}
                          className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded font-medium hover:bg-gray-800">
                          Anotar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {results.length === 100 && (
            <div className="text-xs text-gray-400 px-3 py-2 border-t border-gray-100">
              Se muestran los primeros 100 resultados. Refiná la búsqueda para ver más.
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4"
          onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">
                {modal.mode === 'manual' ? 'Ítem manual' : modal.existing ? 'Modificar anotación' : 'Anotar ítem'}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {modal.existing && (
              <div className="flex gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded mb-3">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  Este ítem <b>ya está anotado</b> por {modal.existing.created_by_name || 'alguien'} con cantidad{' '}
                  <b>{modal.existing.cantidad}</b>. Al guardar se modifica la anotación existente.
                </span>
              </div>
            )}

            {modal.recent && (
              <div className="flex gap-2 bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded mb-3">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  Este código <b>ya fue pedido el {fmtDate(modal.recent.fecha_pedido)}</b> (cantidad {modal.recent.cantidad}).
                </span>
              </div>
            )}

            {modal.mode === 'catalogo' ? (
              <div className="bg-gray-50 rounded p-3 mb-3 text-sm">
                <div className="font-mono text-xs text-gray-500">{modal.codigo}</div>
                <div className="font-medium text-gray-900">{modal.descripcion}</div>
                <div className="text-gray-500 text-xs mt-1">{modal.proveedor}</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Código (opcional)</label>
                  <input value={modal.codigo}
                    onChange={e => setModal({ ...modal, codigo: e.target.value, checked: false, existing: null, recent: null })}
                    className={inputCls + ' font-mono'} placeholder="Sin código" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Proveedor *</label>
                  <input value={modal.proveedor} list="proveedores-list"
                    onChange={e => setModal({ ...modal, proveedor: e.target.value })}
                    className={inputCls} />
                  <datalist id="proveedores-list">
                    {proveedores.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Descripción *</label>
                  <input value={modal.descripcion}
                    onChange={e => setModal({ ...modal, descripcion: e.target.value })}
                    className={inputCls} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cantidad *</label>
                <input type="number" min="0" step="any" value={modal.cantidad}
                  onChange={e => setModal({ ...modal, cantidad: e.target.value })}
                  className={inputCls} autoFocus={modal.mode === 'catalogo'} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Costo unitario</label>
                <input type="text" inputMode="decimal" value={modal.costo}
                  onChange={e => setModal({ ...modal, costo: e.target.value })}
                  className={inputCls} />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Observación</label>
              <input value={modal.observacion}
                onChange={e => setModal({ ...modal, observacion: e.target.value })}
                className={inputCls} placeholder="Opcional" />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                Cancelar
              </button>
              <button onClick={saveModal} disabled={saving}
                className="bg-gray-900 text-white px-5 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {saving ? 'Guardando...' : modal.existing ? 'Actualizar anotación' : 'Anotar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
