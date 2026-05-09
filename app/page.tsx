"use client";

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);
  }

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      checkUser();
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  // DASHBOARD
  if (user) {
    return (
      <main className="min-h-screen bg-gray-100 p-6">

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Control Contable
            </h1>

            <p className="text-gray-500 mt-1">
              Bienvenido {user.email}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-4">

          <div className="bg-white p-5 rounded-2xl shadow">
            <h2 className="text-gray-600">
              Tareas pendientes
            </h2>

            <p className="text-3xl font-bold mt-3 text-black">
              15
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow">
            <h2 className="text-gray-600">
              Urgentes
            </h2>

            <p className="text-3xl font-bold mt-3 text-red-500">
              3
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow">
            <h2 className="text-gray-600">
              Completadas
            </h2>

            <p className="text-3xl font-bold mt-3 text-green-500">
              8
            </p>
          </div>

        </div>
      </main>
    );
  }

  // LOGIN
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-[400px]">

        <h1 className="text-3xl font-bold text-center text-gray-800">
          Control Contable
        </h1>

        <p className="text-gray-500 text-center mt-2">
          Iniciar sesión
        </p>

        <div className="mt-8">
          <label className="text-sm text-gray-600">
            Correo electrónico
          </label>

          <input
            type="email"
            placeholder="correo@empresa.com"
            className="w-full mt-2 p-3 border rounded-xl outline-none text-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mt-5">
          <label className="text-sm text-gray-600">
            Contraseña
          </label>

          <input
            type="password"
            placeholder="********"
            className="w-full mt-2 p-3 border rounded-xl outline-none text-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          onClick={handleLogin}
          className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-medium"
        >
          Ingresar
        </button>

      </div>
    </main>
  );
}