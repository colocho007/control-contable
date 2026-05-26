"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

export default function LoginPage() {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

 async function iniciarSesion(e: React.FormEvent) {
  e.preventDefault();

  const emailLimpio = correo.trim().toLowerCase();
  const passwordLimpio = password.trim();

  if (!emailLimpio || !passwordLimpio) {
    toast.error("Ingresa correo y contraseña");
    return;
  }

  setLoading(true);
  const toastId = toast.loading("Autenticando...");

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: emailLimpio,
      password: passwordLimpio,
    });

    if (error) {
      throw error;
    }

    toast.success("Acceso autorizado", { id: toastId });

    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 500);
  } catch (error: any) {
    console.error("Error al iniciar sesión:", error);

    let mensajeError = "Ocurrió un error al iniciar sesión";

    if (error?.message?.includes("Invalid login credentials")) {
      mensajeError = "Correo o contraseña incorrectos";
    } else if (error?.message?.includes("Email not confirmed")) {
      mensajeError = "Debes confirmar tu correo electrónico primero";
    } else if (error?.status === 401) {
      mensajeError = "Correo o contraseña incorrectos";
    }

    toast.error(mensajeError, { id: toastId });
    setLoading(false);
  }
}

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white px-4">
      <Toaster 
        position="bottom-right" 
        toastOptions={{ 
          style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b'} 
        }} 
      />

      <form
        onSubmit={iniciarSesion}
        className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500 flex items-center justify-center mb-4">
            <ShieldCheck className="text-black" size={34} />
          </div>

          <h1 className="text-3xl font-black tracking-tight">Control+</h1>
          <p className="text-gray-400 text-sm mt-1">
            ERP Empresarial
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            disabled={loading} 
            autoFocus 
            className="w-full h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition disabled:opacity-50"
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading} 
            className="w-full h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 disabled:text-black/50 text-black font-black transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Iniciando...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
