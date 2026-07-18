-- ============================================
-- Carril Motor - Pedidos a Proveedores
-- Schema para Supabase (mismo proyecto que taller)
-- ============================================

-- Extensión para búsqueda rápida por texto parcial
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Catálogo de códigos (importado desde Excel)
CREATE TABLE IF NOT EXISTS pedido_catalogo (
  codigo text PRIMARY KEY,
  descripcion text NOT NULL DEFAULT '',
  proveedor text NOT NULL DEFAULT '',
  costo numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_codigo_trgm ON pedido_catalogo USING gin (codigo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_catalogo_desc_trgm ON pedido_catalogo USING gin (descripcion gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_catalogo_proveedor ON pedido_catalogo (proveedor);

-- Ítems anotados (pendientes de pedir)
CREATE TABLE IF NOT EXISTS pedido_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL DEFAULT '',
  descripcion text NOT NULL,
  proveedor text NOT NULL DEFAULT '',
  costo numeric NOT NULL DEFAULT 0,
  cantidad numeric NOT NULL DEFAULT 1,
  observacion text NOT NULL DEFAULT '',
  es_manual boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedido_items_codigo ON pedido_items (codigo);
CREATE INDEX IF NOT EXISTS idx_pedido_items_proveedor ON pedido_items (proveedor);

-- Historial de pedidos pasados
CREATE TABLE IF NOT EXISTS pedido_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL DEFAULT '',
  descripcion text NOT NULL,
  proveedor text NOT NULL DEFAULT '',
  costo numeric NOT NULL DEFAULT 0,
  cantidad numeric NOT NULL DEFAULT 1,
  observacion text NOT NULL DEFAULT '',
  es_manual boolean NOT NULL DEFAULT false,
  anotado_por text NOT NULL DEFAULT '',
  anotado_at timestamptz,
  pedido_por uuid REFERENCES profiles(id),
  pedido_por_name text NOT NULL DEFAULT '',
  fecha_pedido timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_codigo_fecha ON pedido_historial (codigo, fecha_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_historial_proveedor ON pedido_historial (proveedor);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON pedido_historial (fecha_pedido DESC);

-- Configuración por proveedor (monto mínimo de pedido)
CREATE TABLE IF NOT EXISTS pedido_proveedor_config (
  proveedor text PRIMARY KEY,
  minimo_activo boolean NOT NULL DEFAULT false,
  monto_minimo numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Vista de proveedores conocidos (para autocompletar)
CREATE OR REPLACE VIEW pedido_proveedores WITH (security_invoker = true) AS
  SELECT DISTINCT proveedor FROM pedido_catalogo WHERE proveedor <> ''
  UNION
  SELECT DISTINCT proveedor FROM pedido_items WHERE proveedor <> '';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE pedido_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read" ON pedido_catalogo;
CREATE POLICY "Authenticated read" ON pedido_catalogo FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin manage catalogo" ON pedido_catalogo;
CREATE POLICY "Admin manage catalogo" ON pedido_catalogo FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated read" ON pedido_items;
CREATE POLICY "Authenticated read" ON pedido_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth manage pedido_items" ON pedido_items;
CREATE POLICY "Auth manage pedido_items" ON pedido_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE pedido_proveedor_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read" ON pedido_proveedor_config;
CREATE POLICY "Authenticated read" ON pedido_proveedor_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin manage config" ON pedido_proveedor_config;
CREATE POLICY "Admin manage config" ON pedido_proveedor_config FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated read" ON pedido_historial;
CREATE POLICY "Authenticated read" ON pedido_historial FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert historial" ON pedido_historial;
CREATE POLICY "Admin insert historial" ON pedido_historial FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admin manage historial" ON pedido_historial;
CREATE POLICY "Admin manage historial" ON pedido_historial FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admin delete historial" ON pedido_historial;
CREATE POLICY "Admin delete historial" ON pedido_historial FOR DELETE TO authenticated
  USING (public.is_admin());
