"use client";

import { CompetitionGrid } from "@/components/competition-grid";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header Banner */}
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Bienvenido Usuario!
        </h1>
        <p className="text-sm text-slate-400">
          Compite, Construye y Demuestra tu Talento
        </p>
      </header>

      {/* Challenges Section with Filter Tabs & Cards Grid */}
      <section className="pt-2">
        <CompetitionGrid />
      </section>
    </main>
  );
}
