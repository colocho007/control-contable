"use client";

import Sidebar from "./components/Sidebar";

export default function Page() {

  return (

    <div className="flex bg-[#020617] min-h-screen text-white">

      <Sidebar />

      <main className="flex-1 p-10">

        <h1 className="text-5xl font-black">
          Dashboard Empresarial
        </h1>

        <p className="text-gray-400 mt-4">
          Sistema funcionando correctamente.
        </p>

      </main>

    </div>

  );

}