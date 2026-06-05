-- Base revisable para Proyectos / centros de costo.
-- No conecta ni modifica cheques, fondos, planilla, CxP/CxC, impuestos,
-- conciliacion bancaria, contabilidad formal o reportes.
-- Este archivo no debe ejecutarse hasta revisar y definir las policies RLS.

CREATE TABLE IF NOT EXISTS public.proyectos_centros_costo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  codigo text,
  nombre text NOT NULL,
  descripcion text,
  tipo text NOT NULL DEFAULT 'Proyecto',
  estado text NOT NULL DEFAULT 'Activo',
  responsable_id uuid REFERENCES public.perfiles(id),
  fecha_inicio date,
  fecha_fin_estimada date,
  fecha_fin_real date,
  presupuesto numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'GTQ',
  activo boolean NOT NULL DEFAULT true,
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT proyectos_centros_costo_id_empresa_unico
    UNIQUE (id, empresa_id),
  CONSTRAINT proyectos_centros_costo_nombre_valido
    CHECK (length(trim(nombre)) > 0),
  CONSTRAINT proyectos_centros_costo_tipo_valido
    CHECK (tipo IN ('Proyecto', 'Centro de costo', 'Obra', 'Departamento', 'Unidad', 'Otro')),
  CONSTRAINT proyectos_centros_costo_estado_valido
    CHECK (estado IN ('Activo', 'En pausa', 'Cerrado', 'Cancelado')),
  CONSTRAINT proyectos_centros_costo_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT proyectos_centros_costo_presupuesto_no_negativo
    CHECK (presupuesto >= 0),
  CONSTRAINT proyectos_centros_costo_fecha_fin_estimada_valida
    CHECK (
      fecha_inicio IS NULL
      OR fecha_fin_estimada IS NULL
      OR fecha_fin_estimada >= fecha_inicio
    ),
  CONSTRAINT proyectos_centros_costo_fecha_fin_real_valida
    CHECK (
      fecha_inicio IS NULL
      OR fecha_fin_real IS NULL
      OR fecha_fin_real >= fecha_inicio
    )
);

CREATE TABLE IF NOT EXISTS public.proyectos_presupuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  proyecto_id uuid NOT NULL,
  categoria text NOT NULL,
  descripcion text,
  monto_presupuestado numeric(14,2) NOT NULL DEFAULT 0,
  monto_comprometido numeric(14,2) NOT NULL DEFAULT 0,
  monto_ejecutado numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'GTQ',
  estado text NOT NULL DEFAULT 'Activo',
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT proyectos_presupuestos_categoria_valida
    CHECK (length(trim(categoria)) > 0),
  CONSTRAINT proyectos_presupuestos_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT proyectos_presupuestos_estado_valido
    CHECK (estado IN ('Activo', 'En pausa', 'Cerrado', 'Cancelado')),
  CONSTRAINT proyectos_presupuestos_montos_no_negativos
    CHECK (
      monto_presupuestado >= 0
      AND monto_comprometido >= 0
      AND monto_ejecutado >= 0
    ),
  CONSTRAINT proyectos_presupuestos_proyecto_empresa_valido
    FOREIGN KEY (proyecto_id, empresa_id)
    REFERENCES public.proyectos_centros_costo(id, empresa_id)
);

CREATE TABLE IF NOT EXISTS public.proyectos_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  proyecto_id uuid NOT NULL,
  modulo_origen text,
  entidad_origen_id uuid,
  entidad_origen_texto text,
  tipo_movimiento text NOT NULL,
  descripcion text NOT NULL,
  monto numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'GTQ',
  fecha_movimiento date NOT NULL DEFAULT current_date,
  estado text NOT NULL DEFAULT 'Registrado',
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT proyectos_movimientos_tipo_valido
    CHECK (length(trim(tipo_movimiento)) > 0),
  CONSTRAINT proyectos_movimientos_descripcion_valida
    CHECK (length(trim(descripcion)) > 0),
  CONSTRAINT proyectos_movimientos_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT proyectos_movimientos_monto_no_negativo
    CHECK (monto >= 0),
  CONSTRAINT proyectos_movimientos_estado_valido
    CHECK (estado IN ('Registrado', 'Anulado')),
  CONSTRAINT proyectos_movimientos_proyecto_empresa_valido
    FOREIGN KEY (proyecto_id, empresa_id)
    REFERENCES public.proyectos_centros_costo(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_proyectos_centros_costo_empresa_activo_estado
  ON public.proyectos_centros_costo (empresa_id, activo, estado);

CREATE UNIQUE INDEX IF NOT EXISTS uq_proyectos_centros_costo_empresa_codigo_activo
  ON public.proyectos_centros_costo (empresa_id, codigo)
  WHERE codigo IS NOT NULL AND activo = true;

CREATE INDEX IF NOT EXISTS idx_proyectos_presupuestos_empresa_proyecto_estado
  ON public.proyectos_presupuestos (empresa_id, proyecto_id, estado);

CREATE INDEX IF NOT EXISTS idx_proyectos_movimientos_empresa_proyecto_fecha
  ON public.proyectos_movimientos (empresa_id, proyecto_id, fecha_movimiento);

CREATE INDEX IF NOT EXISTS idx_proyectos_movimientos_empresa_origen
  ON public.proyectos_movimientos (empresa_id, modulo_origen, entidad_origen_id);

ALTER TABLE public.proyectos_centros_costo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos_presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos_movimientos ENABLE ROW LEVEL SECURITY;

-- Policies futuras:
-- * Consulta limitada a empresas permitidas.
-- * Altas y actualizaciones limitadas a empresa permitida y funcion autorizada.
-- * Eliminacion bloqueada; las bajas deben modelarse mediante estado/activo.
-- * Auditor solo lectura limitado a consulta.
