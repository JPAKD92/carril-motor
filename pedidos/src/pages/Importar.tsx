import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { fmtMoney, fmtDateTime } from '../lib/format'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react'

interface ParsedRow {
  codigo: string
  descripcion: string
  proveedor: string
  costo: number
}

function parseNumber(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0
  let s = String(v ?? '').trim().replace(/\s/g, '').replace('$', '')
  if (!s) return 0
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  const n = parseFloat(s)
  return isFinite(n) ? n : 0
}

export function Importar() {
  const [catalogCount, setCatalogCount] = useState<number | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState('')
  const [replaceAll, setReplaceAll] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState('')

  async function loadStats() {
    const { count } = await supabase.from('pedido_catalogo').select('*', { count: 'exact', head: true })
    setCatalogCount(count ?? 0)
    const { data } = await supabase.from('pedido_catalogo').select('updated_at').order('updated_at', { ascending: false }).limit(1)
    setLastUpdate(data?.[0]?.updated_at ?? null)
  }

  useEffect(() => { loadStats() }, [])

  async function handleFile(file: File) {
    setParseError(''); setParsed([]); setDone(''); setFileName(file.name)
    try {
      const wb = XLSX.read(await file.arrayBuffer())
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      if (raw.length === 0) { setParseError('El archivo está vacío.'); return }

      const keys = Object.keys(raw[0])
      const norm = (k: string) => k.toLowerCase().trim()
      const find = (...names: string[]) => keys.find(k => names.includes(norm(k)))
      const kCod = find('idcodigo', 'codigo', 'código', 'cod')
      const kDesc = find('nlargo', 'descripcion', 'descripción', 'desc')
      const kProv = find('pronom', 'proveedor', 'prov')
      const kCosto = find('costo')

      const missing: string[] = []
      if (!kCod) missing.push('idcodigo')
      if (!kDesc) missing.push('nlargo')
      if (!kProv) missing.push('pronom')
      if (!kCosto) missing.push('costo')
      if (missing.length) {
        setParseError(`No encontré las columnas: ${missing.join(', ')}. Columnas del archivo: ${keys.join(', ')}`)
        return
      }

      const map = new Map<string, ParsedRow>()
      for (const r of raw) {
        const codigo = String(r[kCod!] ?? '').trim().toUpperCase()
        if (!codigo) continue
        map.set(codigo, {
          codigo,
          descripcion: String(r[kDesc!] ?? '').trim(),
          proveedor: String(r[kProv!] ?? '').trim(),
          costo: parseNumber(r[kCosto!]),
        })
      }
      if (map.size === 0) { setParseError('No hay filas con código válido.'); return }
      setParsed([...map.values()])
    } catch (e) {
      setParseError('No pude leer el archivo: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function doImport() {
    if (parsed.length === 0) return
    if (replaceAll && !confirm(`Vas a BORRAR todo el catálogo actual (${catalogCount} códigos) y reemplazarlo por los ${parsed.length} del archivo. ¿Continuar?`)) return
    setImporting(true); setProgress(0); setDone('')

    if (replaceAll) {
      const { error } = await supabase.from('pedido_catalogo').delete().neq('codigo', '')
      if (error) { setParseError('Error al vaciar el catálogo: ' + error.message); setImporting(false); return }
    }

    const now = new Date().toISOString()
    const BATCH = 1000
    for (let i = 0; i < parsed.length; i += BATCH) {
      const batch = parsed.slice(i, i + BATCH).map(r => ({ ...r, updated_at: now }))
      const { error } = await supabase.from('pedido_catalogo').upsert(batch, { onConflict: 'codigo' })
      if (error) {
        setParseError(`Error en la fila ${i + 1}: ${error.message}. Se importaron ${i} filas.`)
        setImporting(false)
        loadStats()
        return
      }
      setProgress(Math.min(i + BATCH, parsed.length))
    }
    setImporting(false)
    setDone(`Se importaron ${parsed.length} códigos correctamente.`)
    setParsed([]); setFileName('')
    loadStats()
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Importar catálogo</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex items-center gap-6 text-sm">
        <div>
          <div className="text-xs text-gray-500">Códigos en catálogo</div>
          <div className="text-lg font-bold text-gray-900">{catalogCount === null ? '...' : catalogCount.toLocaleString('es-AR')}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Última actualización</div>
          <div className="text-sm font-medium text-gray-900">{lastUpdate ? fmtDateTime(lastUpdate) : '—'}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-sm text-gray-600 mb-3">
          Subí el Excel exportado de tu base con las columnas <b>idcodigo, nlargo, pronom, costo</b> (también acepta
          codigo/descripcion/proveedor). Los códigos existentes se actualizan (descripción, proveedor y costo) y los
          nuevos se agregan.
        </p>

        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:border-gray-500 text-gray-600 text-sm mb-3">
          <FileSpreadsheet size={20} />
          {fileName || 'Hacé clic para elegir el archivo (.xlsx, .xls, .csv)'}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
        </label>

        {parseError && (
          <div className="flex gap-2 bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded mb-3">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {parseError}
          </div>
        )}

        {done && (
          <div className="flex gap-2 bg-green-50 border border-green-200 text-green-800 text-sm p-3 rounded mb-3">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> {done}
          </div>
        )}

        {parsed.length > 0 && (
          <>
            <div className="text-sm text-gray-700 mb-2">
              <b>{parsed.length.toLocaleString('es-AR')}</b> códigos listos para importar. Muestra:
            </div>
            <div className="border border-gray-200 rounded overflow-x-auto mb-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                    <th className="px-2 py-1.5 font-medium">Código</th>
                    <th className="px-2 py-1.5 font-medium">Descripción</th>
                    <th className="px-2 py-1.5 font-medium">Proveedor</th>
                    <th className="px-2 py-1.5 font-medium text-right">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsed.slice(0, 5).map(r => (
                    <tr key={r.codigo}>
                      <td className="px-2 py-1.5 font-mono">{r.codigo}</td>
                      <td className="px-2 py-1.5">{r.descripcion.slice(0, 70)}</td>
                      <td className="px-2 py-1.5">{r.proveedor}</td>
                      <td className="px-2 py-1.5 text-right">{fmtMoney(r.costo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
              <input type="checkbox" checked={replaceAll} onChange={e => setReplaceAll(e.target.checked)} />
              Reemplazar todo el catálogo (borra los códigos que no estén en el archivo)
            </label>

            <button onClick={doImport} disabled={importing}
              className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              <Upload size={16} />
              {importing
                ? `Importando... ${progress.toLocaleString('es-AR')} / ${parsed.length.toLocaleString('es-AR')}`
                : `Importar ${parsed.length.toLocaleString('es-AR')} códigos`}
            </button>
            {importing && (
              <div className="mt-3 h-2 bg-gray-200 rounded overflow-hidden">
                <div className="h-full bg-gray-900 transition-all" style={{ width: `${(progress / parsed.length) * 100}%` }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
