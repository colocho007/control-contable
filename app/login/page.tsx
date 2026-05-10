"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginPage() {

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

const [mensaje, setMensaje] =
  useState("");

  useEffect(() => {

  verificarSesion();

}, []);

async function verificarSesion() {

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {

  window.location.href = "/dashboard";

  }

}

async function login() {

  setLoading(true);

  setMensaje("");

  const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {

    setMensaje(error.message);

    setLoading(false);

    return;
  }

  router.push("/dashboard");

}

async function register() {

  setLoading(true);

  setMensaje("");

  const { error } =
    await supabase.auth.signUp({
      email,
      password,
    });

  if (error) {

    setMensaje(error.message);

    setLoading(false);

    return;
  }

  setMensaje(
    "Cuenta creada correctamente"
  );

  setLoading(false);

}

  return (
    <main className="min-h-screen bg-[#030712] flex items-center justify-center overflow-hidden relative">

      {/* FONDO */}
      <div className="absolute w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-3xl top-[-100px] left-[-100px]" />

      <div className="absolute w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-3xl bottom-[-100px] right-[-100px]" />

      {/* CARD */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 shadow-2xl"
      >

        <div className="mb-8 text-center">

          <h1 className="text-5xl font-bold text-white mb-3">
            Control+
          </h1>

          <p className="text-gray-400 text-lg">
            Sistema Contable Empresarial
          </p>

        </div>

        <div className="space-y-5">
          {mensaje && (

  <div className="bg-white/5 border border-white/10 text-center p-4 rounded-2xl text-sm text-cyan-300">

    {mensaje}

  </div>

)}

          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#0B1120] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-cyan-400"
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#0B1120] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-purple-400"
          />

         <button
  onClick={login}
  disabled={loading}
  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-[1.02] transition-all p-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2"
>

  {loading ? (

    <>

      <Loader2 className="animate-spin" size={20} />

      Entrando...

    </>

  ) : (

    "Iniciar Sesión"

  )}

</button>

          <button
            onClick={register}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-[1.02] transition-all p-4 rounded-2xl font-bold text-white shadow-lg"
          >
            Crear Cuenta
          </button>

        </div>

      </motion.div>

    </main>
  );
}