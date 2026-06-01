"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { registrarAuditoriaEvento } from "../lib/auditoria";

const LIMITE_INACTIVIDAD_MS = 30 * 60 * 1000;
const AVISO_INACTIVIDAD_MS = 29 * 60 * 1000;
const REVISION_MS = 1000;
const RUTAS_PUBLICAS = new Set(["/login"]);
const CLAVE_ULTIMA_ACTIVIDAD = "control_plus_ultima_actividad";

const EVENTOS_ACTIVIDAD = [
  "mousemove",
  "mousedown",
  "keydown",
  "click",
  "scroll",
  "touchstart",
  "touchmove",
  "pointerdown",
] as const;

function formatearTiempo(ms: number) {
  const totalSegundos = Math.max(0, Math.ceil(ms / 1000));
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  return `${minutos}:${segundos.toString().padStart(2, "0")}`;
}

function limpiarMarcadoresLocales() {
  try {
    window.localStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD);
    window.sessionStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD);
  } catch (error) {
    console.warn("No se pudieron limpiar marcadores locales de inactividad:", error);
  }
}

export default function InactivitySessionGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const ultimaActividadRef = useRef(Date.now());
  const cerrandoRef = useRef(false);
  const [sesionAutenticada, setSesionAutenticada] = useState(false);
  const [mostrarAviso, setMostrarAviso] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [restanteMs, setRestanteMs] = useState(LIMITE_INACTIVIDAD_MS);

  const rutaPublica = RUTAS_PUBLICAS.has(pathname || "");

  useEffect(() => {
    let activo = true;

    async function validarSesion() {
      if (rutaPublica) {
        setSesionAutenticada(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!activo) return;

      setSesionAutenticada(Boolean(session));
      ultimaActividadRef.current = Date.now();
      try {
        window.localStorage.setItem(
          CLAVE_ULTIMA_ACTIVIDAD,
          String(ultimaActividadRef.current)
        );
      } catch {
        // La persistencia local es auxiliar; el cierre no depende de ella.
      }
    }

    void validarSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (rutaPublica) {
        setSesionAutenticada(false);
        return;
      }

      setSesionAutenticada(Boolean(session));
      ultimaActividadRef.current = Date.now();
      setMostrarAviso(false);
      setCerrandoSesion(false);
      cerrandoRef.current = false;
    });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, [rutaPublica]);

  useEffect(() => {
    if (!sesionAutenticada || rutaPublica) return;

    function registrarActividad() {
      if (cerrandoRef.current) return;

      const ahora = Date.now();
      ultimaActividadRef.current = ahora;
      setMostrarAviso(false);
      setRestanteMs(LIMITE_INACTIVIDAD_MS);

      try {
        window.localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(ahora));
      } catch {
        // No bloquear actividad si el navegador impide localStorage.
      }
    }

    EVENTOS_ACTIVIDAD.forEach((evento) => {
      window.addEventListener(evento, registrarActividad, { passive: true });
    });

    return () => {
      EVENTOS_ACTIVIDAD.forEach((evento) => {
        window.removeEventListener(evento, registrarActividad);
      });
    };
  }, [rutaPublica, sesionAutenticada]);

  useEffect(() => {
    if (!sesionAutenticada || rutaPublica) return;

    async function cerrarPorInactividad() {
      if (cerrandoRef.current) return;

      cerrandoRef.current = true;
      setCerrandoSesion(true);
      setMostrarAviso(false);

      try {
        await registrarAuditoriaEvento({
          modulo: "seguridad",
          accion: "cierre_sesion_inactividad",
          entidad_tipo: "sesion",
          estado_anterior: "activa",
          estado_nuevo: "cerrada",
          motivo: "inactividad_30_minutos",
          descripcion:
            "Sesion cerrada automaticamente por 30 minutos sin actividad.",
          sensible: true,
          metadatos: {
            limite_minutos: 30,
            ruta: pathname || null,
          },
          origen: "guard_inactividad",
        });
      } catch (error) {
        console.warn("No se pudo auditar cierre por inactividad:", error);
      }

      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.warn("No se pudo cerrar sesion en Supabase:", error);
      } finally {
        limpiarMarcadoresLocales();
        router.replace("/login");
        router.refresh();
      }
    }

    const intervalo = window.setInterval(() => {
      const inactivoMs = Date.now() - ultimaActividadRef.current;
      const restante = LIMITE_INACTIVIDAD_MS - inactivoMs;

      setRestanteMs(restante);

      if (inactivoMs >= LIMITE_INACTIVIDAD_MS) {
        void cerrarPorInactividad();
        return;
      }

      setMostrarAviso(inactivoMs >= AVISO_INACTIVIDAD_MS);
    }, REVISION_MS);

    return () => window.clearInterval(intervalo);
  }, [pathname, router, rutaPublica, sesionAutenticada]);

  if (rutaPublica || !sesionAutenticada) return null;

  if (cerrandoSesion) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#020617] text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <Loader2 className="mx-auto mb-4 animate-spin text-cyan-300" size={34} />
          <h2 className="text-2xl font-black">Sesion cerrada</h2>
          <p className="text-gray-400 text-sm mt-2">
            Se cerro automaticamente por inactividad.
          </p>
        </div>
      </div>
    );
  }

  if (!mostrarAviso) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9998] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-amber-300/30 bg-[#0f172a] p-5 text-white shadow-2xl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-300 mt-0.5 shrink-0" size={22} />
        <div>
          <h2 className="font-black">Sesion por cerrar</h2>
          <p className="text-sm text-gray-300 mt-1">
            No se detecta actividad. Se cerrara en {formatearTiempo(restanteMs)}.
          </p>
          <p className="text-xs text-gray-500 mt-3">
            Mueve el mouse, usa el teclado, toca la pantalla o haz scroll para continuar.
          </p>
        </div>
      </div>
    </div>
  );
}
