BEGIN;

-- Base revisable para Impuestos / IVA / ISR / retenciones.
-- No ejecuta calculos fiscales, no genera pagos, no genera CxP/CxC
-- y no crea asientos contables automaticos.
-- No conecta SAT/FEL ni calendario operativo en esta fase.
-- documentos_tramites sigue siendo el sistema documental para PDF, fotos
-- y soportes; estas tablas guardan metadata fiscal estructurada.
-- Las tablas nuevas nacen con RLS activo, pero las policies se haran
-- en una rama posterior. Sin policies, la aplicacion todavia no debe
-- depender de estas tablas para produccion.
--
-- public.impuestos_configuracion ya existe en Supabase y la consumen
-- Contabilidad V2, Clientes y Proveedores. Este script no la recrea,
-- no cambia tipos existentes y no convierte proveedor_id/cliente_id,
-- que actualmente son text.

ALTER TABLE public.impuestos_configuracion
  ADD COLUMN IF NOT EXISTS aplica_retencion boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.impuestos_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  anio integer NOT NULL,
  mes integer NOT NULL,
  tipo_periodo text NOT NULL DEFAULT 'Mensual',
  estado text NOT NULL DEFAULT 'Abierto',
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  fecha_vencimiento date,
  observaciones text,
  cerrado_por uuid REFERENCES public.perfiles(id),
  cerrado_at timestamptz,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT impuestos_periodos_mes_valido
    CHECK (mes BETWEEN 1 AND 12),
  CONSTRAINT impuestos_periodos_fechas_validas
    CHECK (
      fecha_fin >= fecha_inicio
      AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha_inicio)
    ),
  CONSTRAINT impuestos_periodos_estado_valido
    CHECK (estado IN ('Abierto', 'En revision', 'Declarado', 'Cerrado', 'Anulado'))
);

CREATE TABLE IF NOT EXISTS public.impuestos_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  tipo_documento text NOT NULL,
  modulo_origen text,
  entidad_origen_id uuid,
  documento_tramite_id uuid,
  proveedor_id text,
  cliente_id text,
  nit_emisor text,
  nit_receptor text,
  serie text,
  numero text,
  fecha_documento date NOT NULL,
  fecha_recepcion date,
  moneda text NOT NULL DEFAULT 'GTQ',
  tipo_cambio numeric(14,6),
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  iva numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  credito_fiscal numeric(14,2) NOT NULL DEFAULT 0,
  debito_fiscal numeric(14,2) NOT NULL DEFAULT 0,
  retencion_iva numeric(14,2) NOT NULL DEFAULT 0,
  retencion_isr numeric(14,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Registrado',
  sensible boolean NOT NULL DEFAULT false,
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT impuestos_documentos_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT impuestos_documentos_tipo_valido
    CHECK (
      tipo_documento IN (
        'FACTURA_COMPRA',
        'FACTURA_VENTA',
        'NOTA_CREDITO',
        'NOTA_DEBITO',
        'RECIBO',
        'RETENCION',
        'OTRO'
      )
    ),
  CONSTRAINT impuestos_documentos_estado_valido
    CHECK (estado IN ('Borrador', 'Registrado', 'Revisado', 'Declarado', 'Anulado')),
  CONSTRAINT impuestos_documentos_montos_no_negativos
    CHECK (
      subtotal >= 0
      AND iva >= 0
      AND total >= 0
      AND credito_fiscal >= 0
      AND debito_fiscal >= 0
      AND retencion_iva >= 0
      AND retencion_isr >= 0
      AND (tipo_cambio IS NULL OR tipo_cambio > 0)
    )
);

CREATE TABLE IF NOT EXISTS public.impuestos_resumen_periodo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  periodo_id uuid NOT NULL REFERENCES public.impuestos_periodos(id),
  moneda text NOT NULL DEFAULT 'GTQ',
  total_compras numeric(14,2) NOT NULL DEFAULT 0,
  total_ventas numeric(14,2) NOT NULL DEFAULT 0,
  credito_fiscal numeric(14,2) NOT NULL DEFAULT 0,
  debito_fiscal numeric(14,2) NOT NULL DEFAULT 0,
  iva_por_pagar numeric(14,2) NOT NULL DEFAULT 0,
  iva_a_favor numeric(14,2) NOT NULL DEFAULT 0,
  retenciones_iva numeric(14,2) NOT NULL DEFAULT 0,
  retenciones_isr numeric(14,2) NOT NULL DEFAULT 0,
  isr_estimado numeric(14,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Borrador',
  revisado_por uuid REFERENCES public.perfiles(id),
  revisado_at timestamptz,
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT impuestos_resumen_periodo_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT impuestos_resumen_periodo_estado_valido
    CHECK (estado IN ('Borrador', 'En revision', 'Revisado', 'Declarado', 'Anulado')),
  CONSTRAINT impuestos_resumen_periodo_montos_no_negativos
    CHECK (
      total_compras >= 0
      AND total_ventas >= 0
      AND credito_fiscal >= 0
      AND debito_fiscal >= 0
      AND iva_por_pagar >= 0
      AND iva_a_favor >= 0
      AND retenciones_iva >= 0
      AND retenciones_isr >= 0
      AND isr_estimado >= 0
    )
);

CREATE TABLE IF NOT EXISTS public.impuestos_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  periodo_id uuid REFERENCES public.impuestos_periodos(id),
  titulo text NOT NULL,
  tipo_obligacion text NOT NULL,
  fecha_vencimiento date NOT NULL,
  estado text NOT NULL DEFAULT 'Pendiente',
  monto_estimado numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'GTQ',
  responsable_id uuid REFERENCES public.perfiles(id),
  visible_calendario boolean NOT NULL DEFAULT true,
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT impuestos_calendario_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT impuestos_calendario_estado_valido
    CHECK (estado IN ('Pendiente', 'En proceso', 'Cumplido', 'Vencido', 'Anulado')),
  CONSTRAINT impuestos_calendario_tipo_valido
    CHECK (tipo_obligacion IN ('IVA', 'ISR', 'RETENCION', 'SAT', 'OTRO')),
  CONSTRAINT impuestos_calendario_monto_no_negativo
    CHECK (monto_estimado >= 0)
);

CREATE INDEX IF NOT EXISTS idx_impuestos_configuracion_empresa_tipo_activo
  ON public.impuestos_configuracion (empresa_id, tipo, activo);

CREATE INDEX IF NOT EXISTS idx_impuestos_configuracion_impuesto_id
  ON public.impuestos_configuracion (impuesto_id);

CREATE INDEX IF NOT EXISTS idx_impuestos_configuracion_proveedor_id
  ON public.impuestos_configuracion (proveedor_id);

CREATE INDEX IF NOT EXISTS idx_impuestos_configuracion_cliente_id
  ON public.impuestos_configuracion (cliente_id);

CREATE INDEX IF NOT EXISTS idx_impuestos_documentos_empresa_fecha
  ON public.impuestos_documentos (empresa_id, fecha_documento);

CREATE INDEX IF NOT EXISTS idx_impuestos_documentos_empresa_estado
  ON public.impuestos_documentos (empresa_id, estado);

CREATE INDEX IF NOT EXISTS idx_impuestos_documentos_empresa_nit_emisor
  ON public.impuestos_documentos (empresa_id, nit_emisor);

CREATE INDEX IF NOT EXISTS idx_impuestos_documentos_empresa_nit_receptor
  ON public.impuestos_documentos (empresa_id, nit_receptor);

CREATE INDEX IF NOT EXISTS idx_impuestos_documentos_empresa_serie_numero
  ON public.impuestos_documentos (empresa_id, serie, numero);

CREATE UNIQUE INDEX IF NOT EXISTS idx_impuestos_periodos_empresa_periodo
  ON public.impuestos_periodos (empresa_id, anio, mes, tipo_periodo);

CREATE INDEX IF NOT EXISTS idx_impuestos_periodos_empresa_estado
  ON public.impuestos_periodos (empresa_id, estado);

CREATE UNIQUE INDEX IF NOT EXISTS idx_impuestos_resumen_periodo_empresa_periodo
  ON public.impuestos_resumen_periodo (empresa_id, periodo_id);

CREATE INDEX IF NOT EXISTS idx_impuestos_calendario_empresa_vencimiento_estado
  ON public.impuestos_calendario (empresa_id, fecha_vencimiento, estado);

ALTER TABLE public.impuestos_configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impuestos_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impuestos_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impuestos_resumen_periodo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impuestos_calendario ENABLE ROW LEVEL SECURITY;

-- FKs futuras a revisar antes de endurecer:
-- * proveedor_id contra public.proveedores(id).
-- * cliente_id contra public.clientes(id).
-- * documento_tramite_id contra public.documentos_tramites(id).
-- Se dejan sin constraint en esta fase porque no hay definicion SQL local
-- suficiente para confirmar tipos reales en todos los ambientes.

-- Propuesta futura de RLS policies, no incluida en esta fase:
-- * SELECT por empresa permitida.
-- * INSERT/UPDATE por empresa permitida y funcion autorizada.
-- * Eliminacion fisica bloqueada; usar estados/anulacion logica.
-- * Auditor solo lectura con permiso exclusivo de SELECT.
-- * Escritura para admin, jefe, supervisor, contador_revisor,
--   auxiliar_contable o funciones futuras propias de impuestos.

-- Propuesta futura de contabilidad:
-- * Documentos fiscales podran generar distribucion contable revisable.
-- * IVA credito/debito se conciliara con contabilidad formal.
-- * Declaraciones podran generar CxP revisable.
-- * No se debe crear asiento automatico oculto.

-- Propuesta futura de documentos y SAT/FEL:
-- * Adjuntos y soportes fisicos permanecen en documentos_tramites.
-- * Integracion SAT/FEL queda pendiente para una rama posterior.
-- * calendario_operativo no se conecta hasta tener helper claro.

COMMIT;
