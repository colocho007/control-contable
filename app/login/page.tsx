"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginPage() {

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function login() {

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/dashboard");
  }

  async function register() {

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Usuario creado correctamente");
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
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-[1.02] transition-all p-4 rounded-2xl font-bold text-white shadow-lg"
          >
            Iniciar Sesión
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