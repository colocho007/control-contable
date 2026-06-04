BEGIN;

-- Base revisable para Planilla / IGSS / IRTRA / INTECAP.
-- No ejecuta pagos, no genera CxP y no genera asientos contables todavia.
-- Las tablas nacen con RLS activo, pero las policies se haran en una rama posterior.
-- Sin policies, la aplicacion todavia no debe depender de estas tablas para produccion.
-- Los documentos de boletas, comprobantes IGSS, planillas firmadas,
-- constancias y documentos de empleado deben cubrirse con documentos_tramites.

CREATE TABLE IF NOT EXISTS public.empleados_planilla (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  codigo_empleado text,
  nombres text NOT NULL,
  apellidos text NOT NULL,
  dpi text,
  nit text,
  igss_numero text,
  fecha_ingreso date NOT NULL,
  fecha_egreso date,
  puesto text,
  departamento text,
  tipo_contrato text,
  jornada text,
  salario_base numeric(14,2) NOT NULL DEFAULT 0,
  bonificacion_incentivo numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'GTQ',
  forma_pago text,
  banco text,
  cuenta_bancaria text,
  activo boolean NOT NULL DEFAULT true,
  estado text NOT NULL DEFAULT 'Activo',
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT empleados_planilla_montos_no_negativos
    CHECK (salario_base >= 0 AND bonificacion_incentivo >= 0),
  CONSTRAINT empleados_planilla_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT empleados_planilla_estado_valido
    CHECK (estado IN ('Activo', 'Inactivo', 'Suspendido', 'Egresado'))
);

CREATE TABLE IF NOT EXISTS public.planillas_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  anio integer NOT NULL,
  mes integer NOT NULL,
  tipo_planilla text NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  fecha_pago date,
  estado text NOT NULL DEFAULT 'Borrador',
  moneda text NOT NULL DEFAULT 'GTQ',
  total_devengado numeric(14,2) NOT NULL DEFAULT 0,
  total_descuentos numeric(14,2) NOT NULL DEFAULT 0,
  total_neto numeric(14,2) NOT NULL DEFAULT 0,
  total_igss_laboral numeric(14,2) NOT NULL DEFAULT 0,
  total_igss_patronal numeric(14,2) NOT NULL DEFAULT 0,
  total_irtra numeric(14,2) NOT NULL DEFAULT 0,
  total_intecap numeric(14,2) NOT NULL DEFAULT 0,
  total_isr numeric(14,2) NOT NULL DEFAULT 0,
  observaciones text,
  cerrado_por uuid REFERENCES public.perfiles(id),
  cerrado_at timestamptz,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT planillas_periodos_mes_valido
    CHECK (mes BETWEEN 1 AND 12),
  CONSTRAINT planillas_periodos_fechas_validas
    CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT planillas_periodos_estado_valido
    CHECK (estado IN ('Borrador', 'En revision', 'Aprobada', 'Pagada', 'Anulada')),
  CONSTRAINT planillas_periodos_moneda_valida
    CHECK (moneda IN ('GTQ', 'USD')),
  CONSTRAINT planillas_periodos_totales_no_negativos
    CHECK (
      total_devengado >= 0
      AND total_descuentos >= 0
      AND total_neto >= 0
      AND total_igss_laboral >= 0
      AND total_igss_patronal >= 0
      AND total_irtra >= 0
      AND total_intecap >= 0
      AND total_isr >= 0
    )
);

CREATE TABLE IF NOT EXISTS public.planilla_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  periodo_id uuid NOT NULL REFERENCES public.planillas_periodos(id),
  empleado_id uuid NOT NULL REFERENCES public.empleados_planilla(id),
  salario_base numeric(14,2) NOT NULL DEFAULT 0,
  bonificacion_incentivo numeric(14,2) NOT NULL DEFAULT 0,
  horas_extra numeric(10,2) NOT NULL DEFAULT 0,
  monto_horas_extra numeric(14,2) NOT NULL DEFAULT 0,
  otros_ingresos numeric(14,2) NOT NULL DEFAULT 0,
  total_devengado numeric(14,2) NOT NULL DEFAULT 0,
  igss_laboral numeric(14,2) NOT NULL DEFAULT 0,
  isr_laboral numeric(14,2) NOT NULL DEFAULT 0,
  anticipos numeric(14,2) NOT NULL DEFAULT 0,
  prestamos numeric(14,2) NOT NULL DEFAULT 0,
  otros_descuentos numeric(14,2) NOT NULL DEFAULT 0,
  total_descuentos numeric(14,2) NOT NULL DEFAULT 0,
  liquido_recibir numeric(14,2) NOT NULL DEFAULT 0,
  igss_patronal numeric(14,2) NOT NULL DEFAULT 0,
  irtra numeric(14,2) NOT NULL DEFAULT 0,
  intecap numeric(14,2) NOT NULL DEFAULT 0,
  costo_patronal_total numeric(14,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Calculado',
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT planilla_detalle_montos_no_negativos
    CHECK (
      salario_base >= 0
      AND bonificacion_incentivo >= 0
      AND horas_extra >= 0
      AND monto_horas_extra >= 0
      AND otros_ingresos >= 0
      AND total_devengado >= 0
      AND igss_laboral >= 0
      AND isr_laboral >= 0
      AND anticipos >= 0
      AND prestamos >= 0
      AND otros_descuentos >= 0
      AND total_descuentos >= 0
      AND liquido_recibir >= 0
      AND igss_patronal >= 0
      AND irtra >= 0
      AND intecap >= 0
      AND costo_patronal_total >= 0
    ),
  CONSTRAINT planilla_detalle_estado_valido
    CHECK (estado IN ('Calculado', 'En revision', 'Aprobado', 'Observado', 'Anulado'))
);

CREATE TABLE IF NOT EXISTS public.planilla_configuracion_tasas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  nombre text NOT NULL,
  tipo text NOT NULL,
  porcentaje numeric(8,4) NOT NULL DEFAULT 0,
  aplica_empleado boolean NOT NULL DEFAULT false,
  aplica_patrono boolean NOT NULL DEFAULT false,
  vigente_desde date NOT NULL,
  vigente_hasta date,
  activo boolean NOT NULL DEFAULT true,
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT planilla_configuracion_tasas_tipo_valido
    CHECK (tipo IN ('IGSS_LABORAL', 'IGSS_PATRONAL', 'IRTRA', 'INTECAP', 'ISR', 'OTRO')),
  CONSTRAINT planilla_configuracion_tasas_porcentaje_valido
    CHECK (porcentaje >= 0 AND porcentaje <= 100),
  CONSTRAINT planilla_configuracion_tasas_vigencia_valida
    CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE TABLE IF NOT EXISTS public.planilla_prestamos_descuentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  empleado_id uuid NOT NULL REFERENCES public.empleados_planilla(id),
  tipo text NOT NULL,
  descripcion text NOT NULL,
  monto_original numeric(14,2) NOT NULL DEFAULT 0,
  saldo_pendiente numeric(14,2) NOT NULL DEFAULT 0,
  cuota_periodo numeric(14,2) NOT NULL DEFAULT 0,
  fecha_inicio date,
  fecha_fin date,
  estado text NOT NULL DEFAULT 'Activo',
  observaciones text,
  creado_por uuid REFERENCES public.perfiles(id),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES public.perfiles(id),
  actualizado_at timestamptz,
  CONSTRAINT planilla_prestamos_descuentos_tipo_valido
    CHECK (tipo IN ('ANTICIPO', 'PRESTAMO', 'DESCUENTO', 'OTRO')),
  CONSTRAINT planilla_prestamos_descuentos_estado_valido
    CHECK (estado IN ('Activo', 'Finalizado', 'Suspendido', 'Anulado')),
  CONSTRAINT planilla_prestamos_descuentos_montos_no_negativos
    CHECK (monto_original >= 0 AND saldo_pendiente >= 0 AND cuota_periodo >= 0),
  CONSTRAINT planilla_prestamos_descuentos_fechas_validas
    CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

ALTER TABLE public.empleados_planilla ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planillas_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planilla_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planilla_configuracion_tasas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planilla_prestamos_descuentos ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empleados_planilla_empresa_codigo
  ON public.empleados_planilla (empresa_id, codigo_empleado)
  WHERE codigo_empleado IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empleados_planilla_empresa_dpi
  ON public.empleados_planilla (empresa_id, dpi)
  WHERE dpi IS NOT NULL AND dpi <> '';

CREATE INDEX IF NOT EXISTS idx_empleados_planilla_empresa_activo
  ON public.empleados_planilla (empresa_id, activo, estado);

CREATE INDEX IF NOT EXISTS idx_empleados_planilla_dpi
  ON public.empleados_planilla (dpi)
  WHERE dpi IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_planillas_periodos_empresa_periodo
  ON public.planillas_periodos (empresa_id, anio, mes, tipo_planilla)
  WHERE estado <> 'Anulada';

CREATE INDEX IF NOT EXISTS idx_planillas_periodos_empresa_estado
  ON public.planillas_periodos (empresa_id, estado, fecha_inicio, fecha_fin);

CREATE INDEX IF NOT EXISTS idx_planilla_detalle_periodo
  ON public.planilla_detalle (periodo_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_planilla_detalle_periodo_empleado
  ON public.planilla_detalle (periodo_id, empleado_id);

CREATE INDEX IF NOT EXISTS idx_planilla_configuracion_tasas_empresa_tipo
  ON public.planilla_configuracion_tasas (empresa_id, tipo, activo, vigente_desde);

CREATE INDEX IF NOT EXISTS idx_planilla_prestamos_descuentos_empleado_estado
  ON public.planilla_prestamos_descuentos (empresa_id, empleado_id, estado);

-- Propuesta futura de RLS policies, no incluida en esta fase:
-- * SELECT por empresa permitida.
-- * INSERT/UPDATE por empresa permitida y funcion autorizada.
-- * Operaciones de eliminacion bloqueadas; usar estados/anulacion logica.
-- * Auditor solo lectura con permiso exclusivo de SELECT.

-- Propuesta futura de contabilidad y pagos:
-- * Aprobar planilla genera pendiente contable revisable.
-- * Pagar planilla conecta con fondos y/o CxP en rama posterior; no se genera CxP todavia.
-- * IGSS, IRTRA, INTECAP e ISR quedan como obligaciones por pagar.
-- * El asiento contable debe ser revisable, no automatico oculto.

COMMIT;
