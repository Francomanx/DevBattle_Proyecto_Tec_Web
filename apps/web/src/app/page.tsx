"use client";

import { ChallengeList } from "@/components/challenge-list";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Bloque de bienvenida */}
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Bienvenido Usuario!
        </h1>
        <p className="text-sm text-slate-400">
          Compite, Construye y Demuestra tu Talento
        </p>
      </header>

      {/* Lista de retos */}
      <section className="pt-2">
        <ChallengeList />
      </section>
    </main>
  );
}