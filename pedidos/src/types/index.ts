export interface Profile {
  id: string
  email: string
  name: string
  role: 'admin' | 'operator'
  created_at: string
}

export interface CatalogoItem {
  codigo: string
  descripcion: string
  proveedor: string
  costo: number
  updated_at: string
}

export interface PedidoItem {
  id: string
  codigo: string
  descripcion: string
  proveedor: string
  costo: number
  cantidad: number
  observacion: string
  es_manual: boolean
  created_by: string | null
  created_by_name: string
  created_at: string
  updated_at: string
}

export interface HistorialItem {
  id: string
  codigo: string
  descripcion: string
  proveedor: string
  costo: number
  cantidad: number
  observacion: string
  es_manual: boolean
  anotado_por: string
  anotado_at: string | null
  pedido_por: string | null
  pedido_por_name: string
  fecha_pedido: string
}
