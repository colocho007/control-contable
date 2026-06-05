"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  tieneFuncionOperativaLocal,
} from "../../lib/funcionesOperativas";
import { obtenerEmpresasOperativasDesdeIds } from "../../lib/empresasOperativas";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import {
  registrarAuditoriaEvento,
  type RegistrarAuditoriaEventoParams,
} from "../../lib/auditoria";

type Tab =
  | "resumen"
  | "activos"
  | "movimientos"
  | "depreciaciones"
  | "proximamente";

type Empresa = {
  id: number;
  nombre: string;
};

type Perfil = {
  id: string;
  rol: string | null;
  activo: boolean;
};

type ActivoFijo = {
  id: string;
  empresa_id: number;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  estado: string;
  fecha_adquisicion: string | null;
  proveedor: string | null;
  documento_referencia: string | null;
  costo_adquisicion: number;
  valor_residual: number;
  vida_util_meses: number | null;
  fecha_inicio_depreciacion: string | null;
  metodo_depreciacion: string;
  depreciacion_acumulada: number;
  valor_en_libros: number;
  moneda: string;
  ubicacion: string | null;
  observaciones: string | null;
  activo: boolean;
  creado_at: string;
};

type MovimientoActivo = {
  id: string;
  empresa_id: number;
  activo_fijo_id: string;
  tipo_movimiento: string;
  fecha_movimiento: string;
  descripcion: string;
  monto: number;
  moneda: string;
  estado: string;
  observaciones: string | null;
  creado_at: string;
};

type DepreciacionActivo = {
  id: string;
  empresa_id: number;
  activo_fijo_id: string;
  anio: number;
  mes: number;
  fecha_depreciacion: string;
  monto_depreciacion: number;
  depreciacion_acumulada: number;
  valor_en_libros: number;
  moneda: string;
  estado: string;
  observaciones: string | null;
  creado_at: string;
};

type Mensaje = {
  tipo: "exito" | "error" | "aviso";
  texto: string;
};

const categorias = [
  "Mobiliario",
  "Equipo",
  "Vehiculo",
  "Maquinaria",
  "Inmueble",
  "Equipo de computo",
  "Herramienta",
  "Otro",
];

const estadosActivo = [
  "Activo",
  "En mantenimiento",
  "Dado de baja",
  "Vendido",
  "Extraviado",
  "Donado",
];

const metodosDepreciacion = ["Linea recta", "Sin depreciacion", "Otro"];
const tiposMovimiento = [
  "Alta",
  "Mejora",
  "Mantenimiento",
  "Depreciacion",
  "Baja",
  "Venta",
  "Traslado",
  "Ajuste",
  "Otro",
];
const monedas = ["GTQ", "USD"];
const tabs: { id: Tab; etiqueta: string }[] = [
  { id: "resumen", etiqueta: "Resumen" },
  { id: "activos", etiqueta: "Activos fijos" },
  { id: "movimientos", etiqueta: "Movimientos" },
  { id: "depreciaciones", etiqueta: "Depreciaciones" },
  { id: "proximamente", etiqueta: "Próximamente" },
];

const activoInicial = {
  empresaId: "",
  codigo: "",
  nombre: "",
  descripcion: "",
  categoria: "Equipo",
  estado: "Activo",
  fechaAdquisicion: "",
  proveedor: "",
  documentoReferencia: "",
  costoAdquisicion: "0",
  valorResidual: "0",
  vidaUtilMeses: "",
  fechaInicioDepreciacion: "",
  metodoDepreciacion: "Linea recta",
  depreciacionAcumulada: "0",
  moneda: "GTQ",
  ubicacion: "",
  observaciones: "",
};

const movimientoInicial = {
  empresaId: "",
  activoFijoId: "",
  tipoMovimiento: "Alta",
  fechaMovimiento: new Date().toISOString().slice(0, 10),
  descripcion: "",
  monto: "0",
  moneda: "GTQ",
  observaciones: "",
};

const depreciacionInicial = {
  empresaId: "",
  activoFijoId: "",
  anio: String(new Date().getFullYear()),
  mes: String(new Date().getMonth() + 1),
  fechaDepreciacion: new Date().toISOString().slice(0, 10),
  montoDepreciacion: "0",
  depreciacionAcumulada: "0",
  valorEnLibros: "0",
  moneda: "GTQ",
  observaciones: "",
};

function numeroSeguro(valor: string) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : NaN;
}

function textoONull(valor: string) {
  const limpio = valor.trim();
  return limpio || null;
}

function moneda(valor: number, codigo: string) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: codigo,
    minimumFractionDigits: 2,
  }).format(valor);
}

function fecha(valor: string | null) {
  if (!valor) return "Sin fecha";
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium" }).format(
    new Date(`${valor.slice(0, 10)}T12:00:00`),
  );
}

export default function ActivosFijosPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("resumen");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasEscritura, setEmpresasEscritura] = useState<Empresa[]>([]);
  const [activos, setActivos] = useState<ActivoFijo[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoActivo[]>([]);
  const [depreciaciones, setDepreciaciones] = useState<DepreciacionActivo[]>([]);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [auditorSoloLectura, setAuditorSoloLectura] = useState(false);
  const [activoForm, setActivoForm] = useState(activoInicial);
  const [movimientoForm, setMovimientoForm] = useState(movimientoInicial);
  const [depreciacionForm, setDepreciacionForm] = useState(depreciacionInicial);

  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [empresa.id, empresa.nombre])),
    [empresas],
  );
  const activosPorId = useMemo(
    () => new Map(activos.map((activo) => [activo.id, activo.nombre])),
    [activos],
  );
  const puedeEscribir = empresasEscritura.length > 0 && !auditorSoloLectura;

  const activosDisponiblesMovimiento = activos.filter(
    (activo) => activo.empresa_id === Number(movimientoForm.empresaId),
  );
  const activosDisponiblesDepreciacion = activos.filter(
    (activo) => activo.empresa_id === Number(depreciacionForm.empresaId),
  );

  const resumen = useMemo(() => {
    const sumar = (campo: "costo_adquisicion" | "depreciacion_acumulada" | "valor_en_libros", divisa: string) =>
      activos
        .filter((activo) => activo.moneda === divisa)
        .reduce((total, activo) => total + Number(activo[campo]), 0);

    return {
      activos: activos.filter((activo) => activo.estado === "Activo").length,
      mantenimiento: activos.filter((activo) => activo.estado === "En mantenimiento").length,
      bajas: activos.filter((activo) => activo.estado === "Dado de baja").length,
      movimientos: movimientos.length,
      depreciaciones: depreciaciones.length,
      gtq: {
        costo: sumar("costo_adquisicion", "GTQ"),
        depreciacion: sumar("depreciacion_acumulada", "GTQ"),
        libros: sumar("valor_en_libros", "GTQ"),
      },
      usd: {
        costo: sumar("costo_adquisicion", "USD"),
        depreciacion: sumar("depreciacion_acumulada", "USD"),
        libros: sumar("valor_en_libros", "USD"),
      },
    };
  }, [activos, depreciaciones.length, movimientos.length]);

  async function cargarDatos() {
    setCargando(true);
    setMensaje(null);

    try {
      const acceso = await validarAccesoModuloUsuario("activos-fijos");
      if (!acceso.ok || !acceso.user || !acceso.perfil) {
        if (["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(acceso.motivo || "")) {
          router.replace("/login");
          return;
        }
        setMensaje({
          tipo: "error",
          texto: "No tienes acceso al módulo de activos fijos.",
        });
        return;
      }

      const perfilActual = acceso.perfil as Perfil;
      const empresasPermitidas = await obtenerEmpresasPermitidas(
        acceso.user.id,
        perfilActual.rol || "",
      );
      const idsPermitidos = empresasPermitidas;
      const empresasOperativas = await obtenerEmpresasOperativasDesdeIds(idsPermitidos);
      const funciones = await listarFuncionesOperativasUsuario(acceso.user.id, empresasOperativas.ids);
      const rol = (perfilActual.rol || "").toLowerCase();
      const empresasConAuditoria = empresasOperativas.empresas.filter((empresa) =>
        esAuditorSoloLecturaLocal(funciones, [empresa.id]),
      );
      const empresasConEscritura = empresasOperativas.empresas.filter((empresa) => {
        if (esAuditorSoloLecturaLocal(funciones, [empresa.id])) return false;
        return (
          ["admin", "supervisor", "jefe"].includes(rol) ||
          tieneFuncionOperativaLocal(funciones, acceso.user!.id, empresa.id, [
            "auxiliar_contable",
            "contador_revisor",
          ])
        );
      });

      setPerfil(perfilActual);
      setEmpresas(empresasOperativas.empresas);
      setEmpresasEscritura(empresasConEscritura);
      setAuditorSoloLectura(empresasConAuditoria.length > 0);

      if (empresasOperativas.ids.length === 0) {
        setActivos([]);
        setMovimientos([]);
        setDepreciaciones([]);
        setMensaje({
          tipo: "aviso",
          texto: "No tienes empresas operativas asignadas para consultar.",
        });
        return;
      }

      const [activosRespuesta, movimientosRespuesta, depreciacionesRespuesta] =
        await Promise.all([
          supabase
            .from("activos_fijos")
            .select(
              "id, empresa_id, codigo, nombre, descripcion, categoria, estado, fecha_adquisicion, proveedor, documento_referencia, costo_adquisicion, valor_residual, vida_util_meses, fecha_inicio_depreciacion, metodo_depreciacion, depreciacion_acumulada, valor_en_libros, moneda, ubicacion, observaciones, activo, creado_at",
            )
            .in("empresa_id", empresasOperativas.ids)
            .order("creado_at", { ascending: false }),
          supabase
            .from("activos_fijos_movimientos")
            .select(
              "id, empresa_id, activo_fijo_id, tipo_movimiento, fecha_movimiento, descripcion, monto, moneda, estado, observaciones, creado_at",
            )
            .in("empresa_id", empresasOperativas.ids)
            .order("fecha_movimiento", { ascending: false }),
          supabase
            .from("activos_fijos_depreciaciones")
            .select(
              "id, empresa_id, activo_fijo_id, anio, mes, fecha_depreciacion, monto_depreciacion, depreciacion_acumulada, valor_en_libros, moneda, estado, observaciones, creado_at",
            )
            .in("empresa_id", empresasOperativas.ids)
            .order("fecha_depreciacion", { ascending: false }),
        ]);

      if (
        activosRespuesta.error ||
        movimientosRespuesta.error ||
        depreciacionesRespuesta.error
      ) {
        console.error("Error al cargar activos fijos", {
          activos: activosRespuesta.error,
          movimientos: movimientosRespuesta.error,
          depreciaciones: depreciacionesRespuesta.error,
        });
        throw new Error("No fue posible cargar la información de activos fijos.");
      }

      setActivos((activosRespuesta.data || []) as ActivoFijo[]);
      setMovimientos((movimientosRespuesta.data || []) as MovimientoActivo[]);
      setDepreciaciones((depreciacionesRespuesta.data || []) as DepreciacionActivo[]);
    } catch (error) {
      console.error("Carga de activos fijos fallida", error);
      setMensaje({
        tipo: "error",
        texto: "No fue posible cargar la información de activos fijos.",
      });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarDatos();
  }, [router]);

  async function auditar(params: RegistrarAuditoriaEventoParams) {
    try {
      await registrarAuditoriaEvento(params);
      return true;
    } catch (error) {
      console.warn("No se pudo registrar auditoría de activos fijos", error);
      return false;
    }
  }

  async function crearActivo(evento: FormEvent) {
    evento.preventDefault();
    setMensaje(null);

    const empresaId = Number(activoForm.empresaId);
    const costo = numeroSeguro(activoForm.costoAdquisicion);
    const residual = numeroSeguro(activoForm.valorResidual);
    const depreciacion = numeroSeguro(activoForm.depreciacionAcumulada);
    const vidaUtil = activoForm.vidaUtilMeses ? Number(activoForm.vidaUtilMeses) : null;

    if (!activoForm.nombre.trim() || !empresasEscritura.some((empresa) => empresa.id === empresaId)) {
      setMensaje({ tipo: "error", texto: "Completa el nombre y selecciona una empresa autorizada." });
      return;
    }
    if (
      [costo, residual, depreciacion].some((valor) => !Number.isFinite(valor) || valor < 0) ||
      residual > costo ||
      depreciacion > costo ||
      (vidaUtil !== null && (!Number.isInteger(vidaUtil) || vidaUtil <= 0))
    ) {
      setMensaje({ tipo: "error", texto: "Revisa los montos y la vida útil del activo." });
      return;
    }

    setGuardando(true);
    try {
      const { data, error } = await supabase
        .from("activos_fijos")
        .insert({
          empresa_id: empresaId,
          codigo: textoONull(activoForm.codigo),
          nombre: activoForm.nombre.trim(),
          descripcion: textoONull(activoForm.descripcion),
          categoria: activoForm.categoria,
          estado: activoForm.estado,
          fecha_adquisicion: activoForm.fechaAdquisicion || null,
          proveedor: textoONull(activoForm.proveedor),
          documento_referencia: textoONull(activoForm.documentoReferencia),
          costo_adquisicion: costo,
          valor_residual: residual,
          vida_util_meses: vidaUtil,
          fecha_inicio_depreciacion: activoForm.fechaInicioDepreciacion || null,
          metodo_depreciacion: activoForm.metodoDepreciacion,
          depreciacion_acumulada: depreciacion,
          valor_en_libros: costo - depreciacion,
          moneda: activoForm.moneda,
          ubicacion: textoONull(activoForm.ubicacion),
          observaciones: textoONull(activoForm.observaciones),
          creado_por: perfil?.id,
        })
        .select("id")
        .single();
      if (error || !data) {
        console.error("No se pudo crear el activo fijo", error);
        throw new Error();
      }

      const auditoriaRegistrada = await auditar({
        modulo: "activos-fijos",
        accion: "crear_activo_fijo",
        entidad_tipo: "activos_fijos",
        entidad_id: data.id,
        empresa_id: empresaId,
        metadatos: { nombre: activoForm.nombre.trim(), moneda: activoForm.moneda, costo },
      });
      setActivoForm({ ...activoInicial, empresaId: String(empresaId) });
      await cargarDatos();
      setMensaje(
        auditoriaRegistrada
          ? { tipo: "exito", texto: "Activo fijo registrado correctamente." }
          : { tipo: "aviso", texto: "El activo se guardó, pero no fue posible registrar la auditoría central." },
      );
      setTab("activos");
    } catch (error) {
      console.error("Alta de activo fijo fallida", error);
      setMensaje({ tipo: "error", texto: "No fue posible registrar el activo fijo." });
    } finally {
      setGuardando(false);
    }
  }

  async function crearMovimiento(evento: FormEvent) {
    evento.preventDefault();
    setMensaje(null);
    const empresaId = Number(movimientoForm.empresaId);
    const monto = numeroSeguro(movimientoForm.monto);
    const activo = activos.find((item) => item.id === movimientoForm.activoFijoId);

    if (
      !activo ||
      activo.empresa_id !== empresaId ||
      !movimientoForm.descripcion.trim() ||
      !empresasEscritura.some((empresa) => empresa.id === empresaId) ||
      !Number.isFinite(monto) ||
      monto < 0
    ) {
      setMensaje({ tipo: "error", texto: "Completa los datos válidos del movimiento." });
      return;
    }

    setGuardando(true);
    try {
      const { data, error } = await supabase
        .from("activos_fijos_movimientos")
        .insert({
          empresa_id: empresaId,
          activo_fijo_id: activo.id,
          tipo_movimiento: movimientoForm.tipoMovimiento,
          fecha_movimiento: movimientoForm.fechaMovimiento,
          descripcion: movimientoForm.descripcion.trim(),
          monto,
          moneda: movimientoForm.moneda,
          observaciones: textoONull(movimientoForm.observaciones),
          creado_por: perfil?.id,
        })
        .select("id")
        .single();
      if (error || !data) {
        console.error("No se pudo crear el movimiento de activo fijo", error);
        throw new Error();
      }

      const auditoriaRegistrada = await auditar({
        modulo: "activos-fijos",
        accion: "crear_movimiento_activo_fijo",
        entidad_tipo: "activos_fijos_movimientos",
        entidad_id: data.id,
        empresa_id: empresaId,
        metadatos: { activo_fijo_id: activo.id, tipo: movimientoForm.tipoMovimiento, monto },
      });
      setMovimientoForm({ ...movimientoInicial, empresaId: String(empresaId) });
      await cargarDatos();
      setMensaje(
        auditoriaRegistrada
          ? { tipo: "exito", texto: "Movimiento registrado correctamente." }
          : { tipo: "aviso", texto: "El movimiento se guardó, pero no fue posible registrar la auditoría central." },
      );
      setTab("movimientos");
    } catch (error) {
      console.error("Alta de movimiento de activo fijo fallida", error);
      setMensaje({ tipo: "error", texto: "No fue posible registrar el movimiento." });
    } finally {
      setGuardando(false);
    }
  }

  async function crearDepreciacion(evento: FormEvent) {
    evento.preventDefault();
    setMensaje(null);
    const empresaId = Number(depreciacionForm.empresaId);
    const anio = Number(depreciacionForm.anio);
    const mes = Number(depreciacionForm.mes);
    const montoDepreciacion = numeroSeguro(depreciacionForm.montoDepreciacion);
    const depreciacionAcumulada = numeroSeguro(depreciacionForm.depreciacionAcumulada);
    const valorEnLibros = numeroSeguro(depreciacionForm.valorEnLibros);
    const activo = activos.find((item) => item.id === depreciacionForm.activoFijoId);

    if (
      !activo ||
      activo.empresa_id !== empresaId ||
      !empresasEscritura.some((empresa) => empresa.id === empresaId) ||
      !Number.isInteger(anio) ||
      anio < 1900 ||
      anio > 2200 ||
      !Number.isInteger(mes) ||
      mes < 1 ||
      mes > 12 ||
      [montoDepreciacion, depreciacionAcumulada, valorEnLibros].some(
        (valor) => !Number.isFinite(valor) || valor < 0,
      )
    ) {
      setMensaje({ tipo: "error", texto: "Completa los datos válidos de la depreciación manual." });
      return;
    }

    setGuardando(true);
    try {
      const { data, error } = await supabase
        .from("activos_fijos_depreciaciones")
        .insert({
          empresa_id: empresaId,
          activo_fijo_id: activo.id,
          anio,
          mes,
          fecha_depreciacion: depreciacionForm.fechaDepreciacion,
          monto_depreciacion: montoDepreciacion,
          depreciacion_acumulada: depreciacionAcumulada,
          valor_en_libros: valorEnLibros,
          moneda: depreciacionForm.moneda,
          observaciones: textoONull(depreciacionForm.observaciones),
          creado_por: perfil?.id,
        })
        .select("id")
        .single();
      if (error || !data) {
        console.error("No se pudo crear la depreciación manual", error);
        throw new Error();
      }

      const auditoriaRegistrada = await auditar({
        modulo: "activos-fijos",
        accion: "crear_depreciacion_activo_fijo",
        entidad_tipo: "activos_fijos_depreciaciones",
        entidad_id: data.id,
        empresa_id: empresaId,
        metadatos: { activo_fijo_id: activo.id, anio, mes, monto: montoDepreciacion },
      });
      setDepreciacionForm({ ...depreciacionInicial, empresaId: String(empresaId) });
      await cargarDatos();
      setMensaje(
        auditoriaRegistrada
          ? { tipo: "exito", texto: "Depreciación manual registrada correctamente." }
          : { tipo: "aviso", texto: "La depreciación se guardó, pero no fue posible registrar la auditoría central." },
      );
      setTab("depreciaciones");
    } catch (error) {
      console.error("Alta de depreciación manual fallida", error);
      setMensaje({ tipo: "error", texto: "No fue posible registrar la depreciación manual." });
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-100">Cargando activos fijos...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">Control contable</p>
              <h1 className="mt-2 text-3xl font-bold">Activos fijos</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Registro manual y consulta de activos, movimientos y depreciaciones por empresa.
              </p>
            </div>
            <Link href="/" className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">
              Volver al inicio
            </Link>
          </div>
        </header>

        {auditorSoloLectura && (
          <MensajePanel tipo="aviso" texto="Modo auditor: puedes consultar la información, pero no registrar cambios." />
        )}
        {mensaje && <MensajePanel tipo={mensaje.tipo} texto={mensaje.texto} />}

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
                tab === item.id ? "bg-cyan-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {item.etiqueta}
            </button>
          ))}
        </nav>

        {tab === "resumen" && (
          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <TarjetaResumen titulo="Activos" valor={resumen.activos} />
              <TarjetaResumen titulo="En mantenimiento" valor={resumen.mantenimiento} />
              <TarjetaResumen titulo="Dados de baja" valor={resumen.bajas} />
              <TarjetaResumen titulo="Movimientos" valor={resumen.movimientos} />
              <TarjetaResumen titulo="Depreciaciones" valor={resumen.depreciaciones} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {(["GTQ", "USD"] as const).map((codigo) => {
                const datos = codigo === "GTQ" ? resumen.gtq : resumen.usd;
                return (
                  <Panel key={codigo} titulo={`Totales ${codigo}`}>
                    <dl className="grid gap-4 sm:grid-cols-3">
                      <Dato titulo="Costo" valor={moneda(datos.costo, codigo)} />
                      <Dato titulo="Depreciación acumulada" valor={moneda(datos.depreciacion, codigo)} />
                      <Dato titulo="Valor en libros" valor={moneda(datos.libros, codigo)} />
                    </dl>
                  </Panel>
                );
              })}
            </div>
          </section>
        )}

        {tab === "activos" && (
          <section className="space-y-6">
            {puedeEscribir && (
              <Panel titulo="Registrar activo fijo">
                <form onSubmit={crearActivo} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <SelectorEmpresa valor={activoForm.empresaId} empresas={empresasEscritura} onChange={(valor) => setActivoForm({ ...activoForm, empresaId: valor })} />
                  <Campo etiqueta="Código" valor={activoForm.codigo} onChange={(valor) => setActivoForm({ ...activoForm, codigo: valor })} />
                  <Campo etiqueta="Nombre" requerido valor={activoForm.nombre} onChange={(valor) => setActivoForm({ ...activoForm, nombre: valor })} />
                  <Selector etiqueta="Categoría" valor={activoForm.categoria} opciones={categorias} onChange={(valor) => setActivoForm({ ...activoForm, categoria: valor })} />
                  <Selector etiqueta="Estado" valor={activoForm.estado} opciones={estadosActivo} onChange={(valor) => setActivoForm({ ...activoForm, estado: valor })} />
                  <Campo etiqueta="Fecha de adquisición" tipo="date" valor={activoForm.fechaAdquisicion} onChange={(valor) => setActivoForm({ ...activoForm, fechaAdquisicion: valor })} />
                  <Campo etiqueta="Proveedor" valor={activoForm.proveedor} onChange={(valor) => setActivoForm({ ...activoForm, proveedor: valor })} />
                  <Campo etiqueta="Documento de referencia" valor={activoForm.documentoReferencia} onChange={(valor) => setActivoForm({ ...activoForm, documentoReferencia: valor })} />
                  <Campo etiqueta="Costo de adquisición" tipo="number" min="0" paso="0.01" requerido valor={activoForm.costoAdquisicion} onChange={(valor) => setActivoForm({ ...activoForm, costoAdquisicion: valor })} />
                  <Campo etiqueta="Valor residual" tipo="number" min="0" paso="0.01" requerido valor={activoForm.valorResidual} onChange={(valor) => setActivoForm({ ...activoForm, valorResidual: valor })} />
                  <Campo etiqueta="Depreciación acumulada inicial" tipo="number" min="0" paso="0.01" requerido valor={activoForm.depreciacionAcumulada} onChange={(valor) => setActivoForm({ ...activoForm, depreciacionAcumulada: valor })} />
                  <Campo etiqueta="Valor en libros calculado" tipo="number" valor={String(Math.max(0, numeroSeguro(activoForm.costoAdquisicion) - numeroSeguro(activoForm.depreciacionAcumulada)) || 0)} deshabilitado />
                  <Campo etiqueta="Vida útil (meses)" tipo="number" min="1" paso="1" valor={activoForm.vidaUtilMeses} onChange={(valor) => setActivoForm({ ...activoForm, vidaUtilMeses: valor })} />
                  <Campo etiqueta="Inicio de depreciación" tipo="date" valor={activoForm.fechaInicioDepreciacion} onChange={(valor) => setActivoForm({ ...activoForm, fechaInicioDepreciacion: valor })} />
                  <Selector etiqueta="Método de depreciación" valor={activoForm.metodoDepreciacion} opciones={metodosDepreciacion} onChange={(valor) => setActivoForm({ ...activoForm, metodoDepreciacion: valor })} />
                  <Selector etiqueta="Moneda" valor={activoForm.moneda} opciones={monedas} onChange={(valor) => setActivoForm({ ...activoForm, moneda: valor })} />
                  <Campo etiqueta="Ubicación" valor={activoForm.ubicacion} onChange={(valor) => setActivoForm({ ...activoForm, ubicacion: valor })} />
                  <Campo etiqueta="Descripción" valor={activoForm.descripcion} onChange={(valor) => setActivoForm({ ...activoForm, descripcion: valor })} />
                  <Campo etiqueta="Observaciones" valor={activoForm.observaciones} onChange={(valor) => setActivoForm({ ...activoForm, observaciones: valor })} />
                  <BotonGuardar texto="Registrar activo fijo" guardando={guardando} />
                </form>
              </Panel>
            )}
            <Panel titulo="Activos registrados">
              {activos.length === 0 ? <Vacio texto="No hay activos fijos registrados." /> : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {activos.map((activo) => (
                    <article key={activo.id} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase text-cyan-400">{empresasPorId.get(activo.empresa_id) || "Empresa"}</p>
                          <h3 className="text-lg font-bold">{activo.nombre}</h3>
                          <p className="text-sm text-slate-400">{activo.codigo || "Sin código"} · {activo.categoria}</p>
                        </div>
                        <Etiqueta texto={activo.estado} />
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <Dato titulo="Costo" valor={moneda(Number(activo.costo_adquisicion), activo.moneda)} />
                        <Dato titulo="Valor en libros" valor={moneda(Number(activo.valor_en_libros), activo.moneda)} />
                        <Dato titulo="Adquisición" valor={fecha(activo.fecha_adquisicion)} />
                        <Dato titulo="Ubicación" valor={activo.ubicacion || "Sin ubicación"} />
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          </section>
        )}

        {tab === "movimientos" && (
          <section className="space-y-6">
            {puedeEscribir && (
              <Panel titulo="Registrar movimiento manual">
                <form onSubmit={crearMovimiento} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <SelectorEmpresa valor={movimientoForm.empresaId} empresas={empresasEscritura} onChange={(valor) => setMovimientoForm({ ...movimientoForm, empresaId: valor, activoFijoId: "" })} />
                  <Selector etiqueta="Activo fijo" valor={movimientoForm.activoFijoId} opciones={activosDisponiblesMovimiento.map((activo) => activo.id)} etiquetas={new Map(activosDisponiblesMovimiento.map((activo) => [activo.id, activo.nombre]))} onChange={(valor) => setMovimientoForm({ ...movimientoForm, activoFijoId: valor })} />
                  <Selector etiqueta="Tipo" valor={movimientoForm.tipoMovimiento} opciones={tiposMovimiento} onChange={(valor) => setMovimientoForm({ ...movimientoForm, tipoMovimiento: valor })} />
                  <Campo etiqueta="Fecha" tipo="date" requerido valor={movimientoForm.fechaMovimiento} onChange={(valor) => setMovimientoForm({ ...movimientoForm, fechaMovimiento: valor })} />
                  <Campo etiqueta="Descripción" requerido valor={movimientoForm.descripcion} onChange={(valor) => setMovimientoForm({ ...movimientoForm, descripcion: valor })} />
                  <Campo etiqueta="Monto" tipo="number" min="0" paso="0.01" requerido valor={movimientoForm.monto} onChange={(valor) => setMovimientoForm({ ...movimientoForm, monto: valor })} />
                  <Selector etiqueta="Moneda" valor={movimientoForm.moneda} opciones={monedas} onChange={(valor) => setMovimientoForm({ ...movimientoForm, moneda: valor })} />
                  <Campo etiqueta="Observaciones" valor={movimientoForm.observaciones} onChange={(valor) => setMovimientoForm({ ...movimientoForm, observaciones: valor })} />
                  <BotonGuardar texto="Registrar movimiento" guardando={guardando} />
                </form>
              </Panel>
            )}
            <Panel titulo="Movimientos registrados">
              {movimientos.length === 0 ? <Vacio texto="No hay movimientos de activos fijos registrados." /> : (
                <Tabla encabezados={["Fecha", "Empresa", "Activo", "Tipo", "Descripción", "Monto", "Estado"]}>
                  {movimientos.map((item) => (
                    <tr key={item.id} className="border-t border-slate-800">
                      <Celda>{fecha(item.fecha_movimiento)}</Celda><Celda>{empresasPorId.get(item.empresa_id) || "Empresa"}</Celda><Celda>{activosPorId.get(item.activo_fijo_id) || "Activo"}</Celda><Celda>{item.tipo_movimiento}</Celda><Celda>{item.descripcion}</Celda><Celda>{moneda(Number(item.monto), item.moneda)}</Celda><Celda>{item.estado}</Celda>
                    </tr>
                  ))}
                </Tabla>
              )}
            </Panel>
          </section>
        )}

        {tab === "depreciaciones" && (
          <section className="space-y-6">
            {puedeEscribir && (
              <Panel titulo="Registrar depreciación manual">
                <form onSubmit={crearDepreciacion} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <SelectorEmpresa valor={depreciacionForm.empresaId} empresas={empresasEscritura} onChange={(valor) => setDepreciacionForm({ ...depreciacionForm, empresaId: valor, activoFijoId: "" })} />
                  <Selector etiqueta="Activo fijo" valor={depreciacionForm.activoFijoId} opciones={activosDisponiblesDepreciacion.map((activo) => activo.id)} etiquetas={new Map(activosDisponiblesDepreciacion.map((activo) => [activo.id, activo.nombre]))} onChange={(valor) => setDepreciacionForm({ ...depreciacionForm, activoFijoId: valor })} />
                  <Campo etiqueta="Año" tipo="number" min="1900" paso="1" requerido valor={depreciacionForm.anio} onChange={(valor) => setDepreciacionForm({ ...depreciacionForm, anio: valor })} />
                  <Campo etiqueta="Mes" tipo="number" min="1" paso="1" requerido valor={depreciacionForm.mes} onChange={(valor) => setDepreciacionForm({ ...depreciacionForm, mes: valor })} />
                  <Campo etiqueta="Fecha" tipo="date" requerido valor={depreciacionForm.fechaDepreciacion} onChange={(valor) => setDepreciacionForm({ ...depreciacionForm, fechaDepreciacion: valor })} />
                  <Campo etiqueta="Monto depreciación" tipo="number" min="0" paso="0.01" requerido valor={depreciacionForm.montoDepreciacion} onChange={(valor) => setDepreciacionForm({ ...depreciacionForm, montoDepreciacion: valor })} />
                  <Campo etiqueta="Depreciación acumulada" tipo="number" min="0" paso="0.01" requerido valor={depreciacionForm.depreciacionAcumulada} onChange={(valor) => setDepreciacionForm({ ...depreciacionForm, depreciacionAcumulada: valor })} />
                  <Campo etiqueta="Valor en libros" tipo="number" min="0" paso="0.01" requerido valor={depreciacionForm.valorEnLibros} onChange={(valor) => setDepreciacionForm({ ...depreciacionForm, valorEnLibros: valor })} />
                  <Selector etiqueta="Moneda" valor={depreciacionForm.moneda} opciones={monedas} onChange={(valor) => setDepreciacionForm({ ...depreciacionForm, moneda: valor })} />
                  <Campo etiqueta="Observaciones" valor={depreciacionForm.observaciones} onChange={(valor) => setDepreciacionForm({ ...depreciacionForm, observaciones: valor })} />
                  <BotonGuardar texto="Registrar depreciación" guardando={guardando} />
                </form>
              </Panel>
            )}
            <Panel titulo="Depreciaciones registradas">
              {depreciaciones.length === 0 ? <Vacio texto="No hay depreciaciones de activos fijos registradas." /> : (
                <Tabla encabezados={["Periodo", "Empresa", "Activo", "Fecha", "Monto", "Acumulada", "Valor en libros", "Estado"]}>
                  {depreciaciones.map((item) => (
                    <tr key={item.id} className="border-t border-slate-800">
                      <Celda>{item.mes}/{item.anio}</Celda><Celda>{empresasPorId.get(item.empresa_id) || "Empresa"}</Celda><Celda>{activosPorId.get(item.activo_fijo_id) || "Activo"}</Celda><Celda>{fecha(item.fecha_depreciacion)}</Celda><Celda>{moneda(Number(item.monto_depreciacion), item.moneda)}</Celda><Celda>{moneda(Number(item.depreciacion_acumulada), item.moneda)}</Celda><Celda>{moneda(Number(item.valor_en_libros), item.moneda)}</Celda><Celda>{item.estado}</Celda>
                    </tr>
                  ))}
                </Tabla>
              )}
            </Panel>
          </section>
        )}

        {tab === "proximamente" && (
          <Panel titulo="Integraciones futuras">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {["Generar depreciación automática", "Contabilizar depreciaciones", "Procesar baja de activo", "Conectar documentos y trámites", "Conectar proyectos", "Ver reportes avanzados"].map((texto) => (
                <button key={texto} type="button" disabled className="cursor-not-allowed rounded-xl border border-slate-700 bg-slate-950 p-4 text-left text-sm text-slate-500">
                  {texto} · Próximamente
                </button>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-4 text-xl font-bold">{titulo}</h2>{children}</section>;
}

function TarjetaResumen({ titulo, valor }: { titulo: string; valor: number }) {
  return <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{titulo}</p><p className="mt-2 text-3xl font-bold text-cyan-400">{valor}</p></article>;
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return <div><dt className="text-xs uppercase text-slate-500">{titulo}</dt><dd className="mt-1 font-semibold text-slate-200">{valor}</dd></div>;
}

function Etiqueta({ texto }: { texto: string }) {
  return <span className="h-fit rounded-full border border-cyan-800 bg-cyan-950 px-3 py-1 text-xs font-semibold text-cyan-300">{texto}</span>;
}

function MensajePanel({ tipo, texto }: Mensaje) {
  const estilo = tipo === "error" ? "border-red-800 bg-red-950 text-red-200" : tipo === "exito" ? "border-emerald-800 bg-emerald-950 text-emerald-200" : "border-amber-800 bg-amber-950 text-amber-200";
  return <div className={`rounded-xl border p-4 text-sm ${estilo}`}>{texto}</div>;
}

function Vacio({ texto }: { texto: string }) {
  return <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">{texto}</p>;
}

function Campo({ etiqueta, valor, onChange, tipo = "text", min, paso, requerido = false, deshabilitado = false }: { etiqueta: string; valor: string; onChange?: (valor: string) => void; tipo?: string; min?: string; paso?: string; requerido?: boolean; deshabilitado?: boolean }) {
  return <label className="text-sm text-slate-300">{etiqueta}<input type={tipo} value={valor} min={min} step={paso} required={requerido} disabled={deshabilitado} onChange={(evento) => onChange?.(evento.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 disabled:text-slate-500" /></label>;
}

function Selector({ etiqueta, valor, opciones, etiquetas, onChange }: { etiqueta: string; valor: string; opciones: string[]; etiquetas?: Map<string, string>; onChange: (valor: string) => void }) {
  return <label className="text-sm text-slate-300">{etiqueta}<select value={valor} required onChange={(evento) => onChange(evento.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"><option value="">Selecciona una opción</option>{opciones.map((opcion) => <option key={opcion} value={opcion}>{etiquetas?.get(opcion) || opcion}</option>)}</select></label>;
}

function SelectorEmpresa({ valor, empresas, onChange }: { valor: string; empresas: Empresa[]; onChange: (valor: string) => void }) {
  return <Selector etiqueta="Empresa" valor={valor} opciones={empresas.map((empresa) => String(empresa.id))} etiquetas={new Map(empresas.map((empresa) => [String(empresa.id), empresa.nombre]))} onChange={onChange} />;
}

function BotonGuardar({ texto, guardando }: { texto: string; guardando: boolean }) {
  return <div className="flex items-end"><button type="submit" disabled={guardando} className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">{guardando ? "Guardando..." : texto}</button></div>;
}

function Tabla({ encabezados, children }: { encabezados: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{encabezados.map((encabezado) => <th key={encabezado} className="px-3 py-3">{encabezado}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function Celda({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-3 text-slate-300">{children}</td>;
}
