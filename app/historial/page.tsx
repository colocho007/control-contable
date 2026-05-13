"use client";

import { useEffect, useState, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { History, Search, Clock, User as UserIcon } from "lucide-react";

interface Log {
  id: number;
  usuario: string;
  accion: string;
  tarea: string;
  fecha: string;
}

export default function HistorialPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    obtenerLogs();

    // Suscripción en tiempo real: Si ocurre una acción nueva, aparece arriba
    const channel = supabase
      .channel("realtime-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "logs" },
        (payload) => {
          setLogs((current) => [payload.new as Log, ...current]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function obtenerLogs() {
    try {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(100); // Limitamos a los últimos 100 por rendimiento

      if (error) throw error;
      if (data) setLogs(data);
    } catch (err) {
      console.error("Error cargando historial:", err);
    } finally {
      setLoading(false);
    }
  }

  // Filtrado en memoria para respuesta instantánea
  const logsFiltrados = useMemo(() => {
    return logs.filter(
      (log) =>
        log.usuario.toLowerCase().includes(busqueda.toLowerCase()) ||
        log.accion.toLowerCase().includes(busqueda.toLowerCase()) ||
        log.tarea.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [logs, busqueda]);

  return (
    <div className="flex bg-[#020617] min-h-screen text-white font-sans">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header con icono */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div>
              <h1 className="text-5xl font-black flex items-center gap-4">
                <History className="text-cyan-500" size={48} />
                Historial
              </h1>
              <p className="text-gray-400 mt-2">Seguimiento de actividades del sistema</p>
            </div>

            {/* Buscador dinámico */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input
                type="text"
                placeholder="Buscar en el registro..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-cyan-500/50 transition-all"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
          ) : (
            <div className="relative border-l border-white/10 ml-4 space-y-8 pb-10">
              {logsFiltrados.length > 0 ? (
                logsFiltrados.map((log) => (
                  <div key={log.id} className="relative pl-8 group">
                    {/* Puntito de la línea de tiempo */}
                    <div className="absolute left-[-5px] top-2 w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] group-hover:scale-150 transition-transform" />
                    
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/[0.08] transition-all">
                      <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <UserIcon size={16} className="text-cyan-400" />
                          <h2 className="text-xl font-bold text-cyan-400">{log.usuario}</h2>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <Clock size={14} />
                          {log.fecha ? new Date(log.fecha).toLocaleString() : "Sin fecha"}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <p className="text-lg text-gray-200">
                          {log.accion}
                        </p>
                        {log.tarea && (
                          <div className="inline-flex mt-2 items-center bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-lg text-sm w-fit border border-cyan-500/20">
                            Tarea: {log.tarea}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="pl-8 text-gray-500 italic">No se encontraron registros...</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}