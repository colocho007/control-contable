-- Base revisable para Activos fijos.
-- No genera depreciaciones automaticas, bajas, pagos ni asientos contables.
-- No conecta documentos_tramites, proyectos, contabilidad formal o reportes.
-- Este archivo no debe ejecutarse hasta revisar y definir las policies RLS.

CREATE TABLE IF NOT EXISTS public.activos_fijos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  codigo text,
  nombre text NOT NULL,
  descripcion text,
  categoria text NOT NULL,
  estado text NOT NULL DEFAULT 'Activo',
  fecha_adquisicion date,
  proveedor text,
  documento_referencia text,
  costo_adquisicion numeric(14,2) NOT NULL DEFAULT 0,
  valor_residual numeric(14,2) NOT NULL DEFAULT 0,
  vida_util_meses integer,
  fecha_inicio_depreciacion date,
  metodo_depreciacion text NOT NULL DEFAULT 'Linea recta',
  depreciacion_acumulada numeric(14,2) NOT NULL DEFAULT 0,
  valor_en_libros numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'GTQ',
  ubicacion text,
  responsable_id uuid REFERENCES public.perfiles(id),
  proyecto_id uuid,
  activo boolean NOT NULL DEFAULT true,
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT activos_fijos_id_empresa_unico
    UNIQUE (id, empresa_id),
  CONSTRAINT activos_fijos_nombre_valido
    CHECK (length(trim(nombre)) > 0),
  CONSTRAINT activos_fijos_categoria_valida
    CHECK (
      categoria IN (
        'Mobiliario',
        'Equipo',
        'Vehiculo',
        'Maquinaria',
        'Inmueble',
        'Equipo de computo',
        'Herramienta',
        'Otro'
      )
    ),
  CONSTRAINT activos_fijos_estado_valido
    CHECK (
      estado IN (
        'Activo',
        'En mantenimiento',
        'Dado de baja',
        'Vendido',
        'Extraviado',
        'Donado'
      )
    ),
  CONSTRAINT activos_fijos_metodo_depreciacion_valido
    CHECK (metodo_depreciacion IN ('Linea recta', 'Sin depreciacion', 'Otro')),
  CONSTRAINT activos_fijos_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT activos_fijos_montos_no_negativos
    CHECK (
      costo_adquisicion >= 0
      AND valor_residual >= 0
      AND depreciacion_acumulada >= 0
      AND valor_en_libros >= 0
    ),
  CONSTRAINT activos_fijos_valor_residual_valido
    CHECK (valor_residual <= costo_adquisicion),
  CONSTRAINT activos_fijos_vida_util_valida
    CHECK (vida_util_meses IS NULL OR vida_util_meses > 0)
);

CREATE TABLE IF NOT EXISTS public.activos_fijos_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  activo_fijo_id uuid NOT NULL,
  tipo_movimiento text NOT NULL,
  fecha_movimiento date NOT NULL DEFAULT current_date,
  descripcion text NOT NULL,
  monto numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'GTQ',
  estado text NOT NULL DEFAULT 'Registrado',
  documento_tramite_id uuid,
  proyecto_id uuid,
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT activos_fijos_movimientos_tipo_valido
    CHECK (
      tipo_movimiento IN (
        'Alta',
        'Mejora',
        'Mantenimiento',
        'Depreciacion',
        'Baja',
        'Venta',
        'Traslado',
        'Ajuste',
        'Otro'
      )
    ),
  CONSTRAINT activos_fijos_movimientos_descripcion_valida
    CHECK (length(trim(descripcion)) > 0),
  CONSTRAINT activos_fijos_movimientos_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT activos_fijos_movimientos_monto_no_negativo
    CHECK (monto >= 0),
  CONSTRAINT activos_fijos_movimientos_estado_valido
    CHECK (estado IN ('Registrado', 'Anulado')),
  CONSTRAINT activos_fijos_movimientos_activo_empresa_valido
    FOREIGN KEY (activo_fijo_id, empresa_id)
    REFERENCES public.activos_fijos(id, empresa_id)
);

CREATE TABLE IF NOT EXISTS public.activos_fijos_depreciaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  activo_fijo_id uuid NOT NULL,
  anio integer NOT NULL,
  mes integer NOT NULL,
  fecha_depreciacion date NOT NULL,
  monto_depreciacion numeric(14,2) NOT NULL DEFAULT 0,
  depreciacion_acumulada numeric(14,2) NOT NULL DEFAULT 0,
  valor_en_libros numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'GTQ',
  estado text NOT NULL DEFAULT 'Calculada',
  asiento_contable_id uuid,
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT activos_fijos_depreciaciones_anio_valido
    CHECK (anio BETWEEN 1900 AND 2200),
  CONSTRAINT activos_fijos_depreciaciones_mes_valido
    CHECK (mes BETWEEN 1 AND 12),
  CONSTRAINT activos_fijos_depreciaciones_montos_no_negativos
    CHECK (
      monto_depreciacion >= 0
      AND depreciacion_acumulada >= 0
      AND valor_en_libros >= 0
    ),
  CONSTRAINT activos_fijos_depreciaciones_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT activos_fijos_depreciaciones_estado_valido
    CHECK (estado IN ('Calculada', 'Revisada', 'Contabilizada', 'Anulada')),
  CONSTRAINT activos_fijos_depreciaciones_activo_empresa_valido
    FOREIGN KEY (activo_fijo_id, empresa_id)
    REFERENCES public.activos_fijos(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_activos_fijos_empresa_activo_estado
  ON public.activos_fijos (empresa_id, activo, estado);

CREATE UNIQUE INDEX IF NOT EXISTS uq_activos_fijos_empresa_codigo_activo
  ON public.activos_fijos (empresa_id, codigo)
  WHERE codigo IS NOT NULL AND activo = true;

CREATE INDEX IF NOT EXISTS idx_activos_fijos_empresa_categoria_estado
  ON public.activos_fijos (empresa_id, categoria, estado);

CREATE INDEX IF NOT EXISTS idx_activos_fijos_movimientos_empresa_activo_fecha
  ON public.activos_fijos_movimientos (empresa_id, activo_fijo_id, fecha_movimiento);

CREATE INDEX IF NOT EXISTS idx_activos_fijos_depreciaciones_empresa_activo_periodo
  ON public.activos_fijos_depreciaciones (empresa_id, activo_fijo_id, anio, mes);

CREATE UNIQUE INDEX IF NOT EXISTS uq_activos_fijos_depreciaciones_periodo_activo
  ON public.activos_fijos_depreciaciones (empresa_id, activo_fijo_id, anio, mes)
  WHERE estado <> 'Anulada';

ALTER TABLE public.activos_fijos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activos_fijos_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activos_fijos_depreciaciones ENABLE ROW LEVEL SECURITY;

-- Policies futuras:
-- * Consulta limitada a empresas permitidas.
-- * Altas y actualizaciones limitadas a empresa permitida y funcion autorizada.
-- * Eliminacion bloqueada; las bajas deben modelarse mediante estado/activo.
-- * Auditor solo lectura limitado a consulta.
