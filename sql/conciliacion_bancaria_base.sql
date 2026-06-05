BEGIN;

-- Base revisable para Conciliacion bancaria.
-- No conecta pantalla, no importa estados de cuenta, no genera pagos,
-- no toca fondos, cheques, CxP/CxC ni contabilidad formal.
-- documentos_tramites sigue siendo el sistema documental para PDF, Excel,
-- fotos y soportes; estas tablas guardan metadata bancaria estructurada.
-- Las tablas nacen con RLS activo, pero las policies se haran en una rama posterior.
-- Sin policies, la aplicacion todavia no debe depender de estas tablas para produccion.
--
-- Nota sobre integraciones:
-- * fondo_id queda sin FK por ahora porque fondos_empresa.id se usa como bigint
--   en el proyecto y esta base usa UUID internos de conciliacion.
-- * archivo_documento_id queda sin FK por ahora; revisar documentos_tramites antes
--   de endurecer tipos y relaciones.
-- * asiento_contable_id queda sin FK por ahora; revisar asientos_contables antes
--   de conectar ajustes contables.
-- * conciliacion_vinculos usa modulo_origen + entidad_origen_id/texto para no
--   forzar FKs prematuras a cheques, movimientos, pagos, CxP/CxC, fondos o contabilidad.

CREATE TABLE IF NOT EXISTS public.conciliacion_cuentas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  fondo_id uuid,
  banco text NOT NULL,
  nombre_cuenta text NOT NULL,
  numero_cuenta text,
  tipo_cuenta text,
  moneda text NOT NULL DEFAULT 'GTQ',
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  fecha_saldo_inicial date,
  activo boolean NOT NULL DEFAULT true,
  estado text NOT NULL DEFAULT 'Activa',
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT conciliacion_cuentas_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT conciliacion_cuentas_saldo_inicial_no_negativo
    CHECK (saldo_inicial >= 0),
  CONSTRAINT conciliacion_cuentas_estado_valido
    CHECK (estado IN ('Activa', 'Inactiva', 'Suspendida', 'Archivada'))
);

CREATE TABLE IF NOT EXISTS public.conciliacion_estados_cuenta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  cuenta_bancaria_id uuid NOT NULL REFERENCES public.conciliacion_cuentas_bancarias(id),
  periodo_anio integer NOT NULL,
  periodo_mes integer NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  saldo_final numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'GTQ',
  estado text NOT NULL DEFAULT 'Borrador',
  archivo_documento_id uuid,
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  cerrado_por uuid REFERENCES public.perfiles(id),
  cerrado_at timestamptz,
  CONSTRAINT conciliacion_estados_mes_valido
    CHECK (periodo_mes BETWEEN 1 AND 12),
  CONSTRAINT conciliacion_estados_fechas_validas
    CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT conciliacion_estados_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT conciliacion_estados_saldos_no_negativos
    CHECK (saldo_inicial >= 0 AND saldo_final >= 0),
  CONSTRAINT conciliacion_estados_estado_valido
    CHECK (estado IN ('Borrador', 'En revision', 'Conciliado', 'Cerrado', 'Anulado'))
);

CREATE TABLE IF NOT EXISTS public.conciliacion_movimientos_banco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  estado_cuenta_id uuid NOT NULL REFERENCES public.conciliacion_estados_cuenta(id),
  cuenta_bancaria_id uuid NOT NULL REFERENCES public.conciliacion_cuentas_bancarias(id),
  fecha_movimiento date NOT NULL,
  descripcion text,
  referencia text,
  tipo_movimiento text NOT NULL,
  debito numeric(14,2) NOT NULL DEFAULT 0,
  credito numeric(14,2) NOT NULL DEFAULT 0,
  saldo_banco numeric(14,2),
  moneda text NOT NULL DEFAULT 'GTQ',
  estado text NOT NULL DEFAULT 'Pendiente',
  conciliado boolean NOT NULL DEFAULT false,
  conciliado_at timestamptz,
  conciliado_por uuid REFERENCES public.perfiles(id),
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT conciliacion_movimientos_tipo_valido
    CHECK (tipo_movimiento IN (
      'DEBITO',
      'CREDITO',
      'CHEQUE',
      'DEPOSITO',
      'TRANSFERENCIA',
      'COMISION',
      'INTERES',
      'AJUSTE',
      'OTRO'
    )),
  CONSTRAINT conciliacion_movimientos_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT conciliacion_movimientos_montos_validos
    CHECK (
      debito >= 0
      AND credito >= 0
      AND (saldo_banco IS NULL OR saldo_banco >= 0)
      AND (
        (debito > 0 AND credito = 0)
        OR (credito > 0 AND debito = 0)
      )
    ),
  CONSTRAINT conciliacion_movimientos_estado_valido
    CHECK (estado IN ('Pendiente', 'Conciliado', 'Observado', 'Duplicado', 'Anulado'))
);

CREATE TABLE IF NOT EXISTS public.conciliacion_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  movimiento_banco_id uuid NOT NULL REFERENCES public.conciliacion_movimientos_banco(id),
  modulo_origen text NOT NULL,
  entidad_origen_id uuid,
  entidad_origen_texto text,
  tipo_vinculo text NOT NULL,
  monto_vinculado numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'GTQ',
  estado text NOT NULL DEFAULT 'Vinculado',
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT conciliacion_vinculos_tipo_valido
    CHECK (tipo_vinculo IN (
      'CHEQUE',
      'PAGO_CXP',
      'COBRO_CXC',
      'MOVIMIENTO_FINANZAS',
      'AJUSTE',
      'OTRO'
    )),
  CONSTRAINT conciliacion_vinculos_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT conciliacion_vinculos_monto_no_negativo
    CHECK (monto_vinculado >= 0),
  CONSTRAINT conciliacion_vinculos_estado_valido
    CHECK (estado IN ('Vinculado', 'Observado', 'Revertido', 'Anulado'))
);

CREATE TABLE IF NOT EXISTS public.conciliacion_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  cuenta_bancaria_id uuid NOT NULL REFERENCES public.conciliacion_cuentas_bancarias(id),
  estado_cuenta_id uuid REFERENCES public.conciliacion_estados_cuenta(id),
  movimiento_banco_id uuid REFERENCES public.conciliacion_movimientos_banco(id),
  tipo_ajuste text NOT NULL,
  descripcion text NOT NULL,
  monto numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'GTQ',
  estado text NOT NULL DEFAULT 'Pendiente',
  requiere_contabilidad boolean NOT NULL DEFAULT true,
  asiento_contable_id uuid,
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT conciliacion_ajustes_tipo_valido
    CHECK (tipo_ajuste IN (
      'COMISION_BANCARIA',
      'NOTA_DEBITO',
      'NOTA_CREDITO',
      'DIFERENCIA',
      'ERROR_BANCO',
      'ERROR_INTERNO',
      'AJUSTE_CONTABLE',
      'OTRO'
    )),
  CONSTRAINT conciliacion_ajustes_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT conciliacion_ajustes_monto_no_negativo
    CHECK (monto >= 0),
  CONSTRAINT conciliacion_ajustes_estado_valido
    CHECK (estado IN ('Pendiente', 'En revision', 'Aprobado', 'Contabilizado', 'Anulado'))
);

CREATE INDEX IF NOT EXISTS idx_conciliacion_cuentas_empresa_activo
  ON public.conciliacion_cuentas_bancarias (empresa_id, activo);

CREATE INDEX IF NOT EXISTS idx_conciliacion_cuentas_empresa_banco_cuenta
  ON public.conciliacion_cuentas_bancarias (empresa_id, banco, numero_cuenta);

CREATE INDEX IF NOT EXISTS idx_conciliacion_estados_empresa_cuenta_periodo
  ON public.conciliacion_estados_cuenta (empresa_id, cuenta_bancaria_id, periodo_anio, periodo_mes);

CREATE INDEX IF NOT EXISTS idx_conciliacion_estados_empresa_estado
  ON public.conciliacion_estados_cuenta (empresa_id, estado);

CREATE INDEX IF NOT EXISTS idx_conciliacion_movimientos_empresa_cuenta_fecha
  ON public.conciliacion_movimientos_banco (empresa_id, cuenta_bancaria_id, fecha_movimiento);

CREATE INDEX IF NOT EXISTS idx_conciliacion_movimientos_empresa_estado_conciliado
  ON public.conciliacion_movimientos_banco (empresa_id, estado, conciliado);

CREATE INDEX IF NOT EXISTS idx_conciliacion_movimientos_empresa_referencia
  ON public.conciliacion_movimientos_banco (empresa_id, referencia);

CREATE INDEX IF NOT EXISTS idx_conciliacion_vinculos_empresa_movimiento
  ON public.conciliacion_vinculos (empresa_id, movimiento_banco_id);

CREATE INDEX IF NOT EXISTS idx_conciliacion_vinculos_empresa_origen
  ON public.conciliacion_vinculos (empresa_id, modulo_origen, entidad_origen_id);

CREATE INDEX IF NOT EXISTS idx_conciliacion_ajustes_empresa_estado
  ON public.conciliacion_ajustes (empresa_id, estado);

CREATE INDEX IF NOT EXISTS idx_conciliacion_ajustes_empresa_cuenta
  ON public.conciliacion_ajustes (empresa_id, cuenta_bancaria_id);

ALTER TABLE public.conciliacion_cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacion_estados_cuenta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacion_movimientos_banco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacion_vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacion_ajustes ENABLE ROW LEVEL SECURITY;

-- Propuesta futura de RLS policies, no incluida en esta fase:
-- * SELECT por empresa permitida.
-- * INSERT/UPDATE por empresa permitida y funcion autorizada.
-- * DELETE bloqueado; usar estados/anulacion logica.
-- * Auditor solo lectura con permiso exclusivo de SELECT.
-- * Escritura para admin, jefe, supervisor, contador_revisor,
--   auxiliar_contable o funciones futuras propias de conciliacion.

-- Propuesta futura de contabilidad:
-- * Ajustes pueden generar asiento contable revisable.
-- * Comisiones bancarias pueden generar gasto bancario revisable.
-- * Diferencias quedan pendientes de revision antes de afectar contabilidad.
-- * Conciliacion cerrada no debe modificarse sin reapertura controlada.
-- * No se debe crear asiento automatico oculto.

-- Propuesta futura de documentos e importacion:
-- * Estados de cuenta PDF/Excel/fotos permanecen en documentos_tramites.
-- * Importacion de Excel/PDF queda pendiente para una rama posterior.
-- * Reglas de conciliacion automatica quedan pendientes hasta tener base auditada.

COMMIT;
