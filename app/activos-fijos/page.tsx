"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, FileSpreadsheet, FileText, Lock, ShieldCheck } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";

const resumen = [
  { titulo: "Activos", valor: "Pendiente de conectar" },
  { titulo: "Depreciación mensual", valor: "Sin conexión todavía" },
  { titulo: "Valor en libros", valor: "Pendiente de conectar" },
  { titulo: "Asientos depreciación", valor: "Preparado para fase SQL" },
];

const funciones = [
  "Activos",
  "Código",
  "Factura",
  "Proveedor",
  "Costo",
  "Ubicación",
  "Responsable",
  "Vida útil",
  "Depreciación mensual",
  "Depreciación acumulada",
  "Valor en libros",
  "Asientos de depreciación",
];

const proximosPasos = [
  "Conectar catálogo de activos fijos",
  "Preparar cálculo de depreciación",
  "Vincular documentos, facturas y proveedores",
  "Activar asientos de depreciación en una rama posterior",
];

export default function ActivosFijosPage() {
  const router = useRouter();
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [mensajeBloqueo, setMensajeBloqueo] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    async function iniciar() {
      try {
        const acceso = await validarAccesoModuloUsuario("activos-fijos");
        if (!activo) return;
        if (!acceso.ok) {
          const volverLogin = ["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(acceso.motivo || "");
          if (volverLogin) {
            router.replace("/login");
            return;
          }
          setMensajeBloqueo("No tienes acceso al módulo Activos fijos.");
          setAutorizado(false);
          setValidandoAcceso(false);
          return;
        }
        setAutorizado(true);
        setValidandoAcceso(false);
      } catch (error) {
        console.error("Error validando acceso a activos fijos:", error);
        if (activo) {
          setMensajeBloqueo("No se pudo validar el acceso al módulo Activos fijos.");
          setAutorizado(false);
          setValidandoAcceso(false);
        }
      }
    }
    void iniciar();
    return () => {
      activo = false;
    };
  }, [router]);

  if (validandoAcceso) return <EstadoCentro>Validando acceso...</EstadoCentro>;
  if (!autorizado) return <EstadoCentro>{mensajeBloqueo || "No tienes acceso a este módulo."}</EstadoCentro>;

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <FileSpreadsheet className="text-cyan-500" size={42} />
                <h1 className="text-4xl md:text-5xl font-black">Activos fijos</h1>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-200">Estructura base</span>
              </div>
              <p className="mt-3 max-w-3xl text-[var(--muted)]">
                Base visual para registro, control y depreciación de activos fijos.
              </p>
            </div>
            <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-5 py-3 text-sm font-black text-[var(--muted-strong)] opacity-70">
              <Lock size={16} />
              Próximamente
            </button>
          </header>
          <Banner />
          <Resumen items={resumen} />
          <Panel titulo="Funciones previstas" subtitulo="Módulo en estructura base, pendiente de conexión completa."><GridFunciones items={funciones} /></Panel>
          <Panel titulo="Próximos pasos" subtitulo="Conexiones planificadas para fases posteriores."><Lista items={proximosPasos} /></Panel>
        </div>
      </main>
    </div>
  );
}

function EstadoCentro({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-center text-[var(--foreground)]">{children}</div>;
}

function Banner() {
  return <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-5 text-cyan-100"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0" size={20} /><div><p className="font-black">Módulo en estructura base, pendiente de conexión completa.</p><p className="mt-1">Este módulo está preparado para conexión futura con Supabase, auditoría, documentos y reportes. Por ahora no guarda datos.</p></div></div></section>;
}

function Resumen({ items }: { items: Array<{ titulo: string; valor: string }> }) {
  return <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <article key={item.titulo} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5"><p className="text-sm font-semibold text-[var(--muted)]">{item.titulo}</p><h2 className="mt-3 text-xl font-black">{item.valor}</h2></article>)}</section>;
}

function Panel({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5"><h2 className="text-xl font-black">{titulo}</h2><p className="mt-1 text-sm text-[var(--muted-strong)]">{subtitulo}</p><div className="mt-5">{children}</div></section>;
}

function GridFunciones({ items }: { items: string[] }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{items.map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--surface)] p-4 text-sm font-semibold"><ClipboardList size={16} className="shrink-0 text-cyan-500" />{item}</div>)}</div>;
}

function Lista({ items }: { items: string[] }) {
  return <ul className="grid gap-3 md:grid-cols-2">{items.map((item) => <li key={item} className="flex items-start gap-3 text-sm text-[var(--muted)]"><FileText size={16} className="mt-0.5 shrink-0 text-cyan-500" />{item}</li>)}</ul>;
}
