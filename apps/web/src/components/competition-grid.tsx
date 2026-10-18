"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

type TabStatus = "ACTIVE" | "VOTING" | "COMPLETED";

function formatRemainingTime(deadline: Date | string | undefined): string {
  if (!deadline) return "Restan: 1d : 19h : 02min";
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Finalizado";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  return `Restan: ${days}d : ${hours}h : ${minutes.toString().padStart(2, "0")}min`;
}

export function CompetitionGrid() {
  const trpc = useTRPC();
  const [activeTab, setActiveTab] = useState<TabStatus>("ACTIVE");
  const [selectedFormat, setSelectedFormat] = useState<string>("Todos");

  // Fetch list of competitions
  const { data: competitions, isPending, error } = useQuery(
    trpc.competition.list.queryOptions({ status: activeTab })
  );

  // Filter by file format if needed
  const filteredCompetitions = useMemo(() => {
    if (!competitions) return [];
    if (selectedFormat === "Todos") return competitions;
    return competitions.filter((c) =>
      c.fileFormat?.toLowerCase().includes(selectedFormat.toLowerCase())
    );
  }, [competitions, selectedFormat]);

  return (
    <div className="space-y-6">
      {/* Filters and Format Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Tab Group */}
        <div className="inline-flex rounded-xl border border-[#1E2D4A] bg-[#0E1729] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("ACTIVE")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === "ACTIVE"
                ? "border border-slate-500/50 bg-[#16233B] text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Activos (En competición)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("VOTING")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === "VOTING"
                ? "border border-slate-500/50 bg-[#16233B] text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            En votación
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("COMPLETED")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === "COMPLETED"
                ? "border border-slate-500/50 bg-[#16233B] text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Finalizados
          </button>
        </div>

        {/* Format Select Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Formato:</span>
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="rounded-lg border border-[#1E2D4A] bg-[#0E1729] px-3 py-1.5 text-xs font-medium text-white focus:border-orange-500 focus:outline-none cursor-pointer"
          >
            <option value="Todos">Todos</option>
            <option value="link">Link</option>
            <option value="zip">Zip</option>
            <option value="archivo">Archivo</option>
          </select>
        </div>
      </div>

      {/* Grid of Competition Cards */}
      {isPending ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-96 rounded-2xl border border-[#1E2D4A] bg-[#111A2E] animate-pulse p-4"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">
          <p className="font-semibold text-sm">Error al cargar retos</p>
          <p className="text-xs mt-1">{error.message}</p>
        </div>
      ) : filteredCompetitions.length === 0 ? (
        <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-12 text-center text-slate-400">
          <p className="text-sm">
            No se encontraron retos en este estado o formato.
          </p>
          <div className="mt-4">
            <Link
              href="/competitions/create"
              className="inline-block rounded-xl bg-[#FF6B00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#E05E00]"
            >
              + Crear Nuevo Reto
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompetitions.map((competition) => {
            // Find host participant if available
            const host = competition.participants?.find(
              (p: { role: string }) => p.role === "HOST"
            );
            const hostName = host ? `@${host.user.username}` : "Host Pendiente";

            // Status label & color
            let statusLabel = "En competición";
            let statusColor = "text-emerald-400";
            if (competition.status === "VOTING") {
              statusLabel = "En votación";
              statusColor = "text-blue-400";
            } else if (competition.status === "COMPLETED") {
              statusLabel = "Finalizado";
              statusColor = "text-purple-400";
            } else if (competition.status === "DRAFT") {
              statusLabel = "Borrador";
              statusColor = "text-amber-400";
            }

            // Tag
            const techTag = competition.title.toLowerCase().includes("python")
              ? "Python"
              : competition.title.toLowerCase().includes("grafo")
              ? "Algoritmos"
              : "React";

            // Participants & XP
            const participantsCount =
              competition._count?.participants && competition._count.participants > 0
                ? competition._count.participants
                : 120;
            const xp = "1,500 XP";

            return (
              <article
                key={competition.id}
                className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-4 flex flex-col justify-between transition hover:border-[#2C426D] hover:shadow-2xl shadow-lg"
              >
                <div>
                  {/* Card Header: Host & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#24334E] text-slate-300 font-bold text-xs shadow-inner">
                        {host ? host.user.username.slice(0, 2).toUpperCase() : ""}
                      </div>
                      <span className="text-xs font-semibold text-white">
                        {hostName}
                      </span>
                    </div>

                    <span className={`text-xs font-semibold ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* Card Image Banner */}
                  <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden my-3 border border-[#1A2640] bg-[#0A101D]">
                    <Image
                      src="/challenge-placeholder.png"
                      alt={competition.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                    />

                    {/* Floating Top-Left Remaining Time Badge */}
                    <div className="absolute top-2 left-2 rounded bg-black/85 px-2 py-0.5 text-[11px] font-mono font-bold text-red-400 border border-red-500/30 shadow">
                      {formatRemainingTime(competition.submissionDeadline)}
                    </div>

                    {/* Floating Bottom-Right Tech Badge */}
                    <div className="absolute bottom-2 right-2 rounded border border-[#FF6B00] bg-black/90 px-2.5 py-0.5 text-[11px] font-bold text-[#FF8A00] shadow">
                      {techTag}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <Link
                    href={`/competitions/${competition.id}`}
                    className="block text-sm font-bold text-white hover:text-orange-400 transition line-clamp-1 mt-1"
                  >
                    {competition.title}
                  </Link>

                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[32px] leading-relaxed">
                    {competition.description}
                  </p>

                  {/* Tech Tag Pill */}
                  <div className="mt-2.5">
                    <span className="inline-block rounded-md border border-[#23355A] bg-[#0D1527] px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                      {techTag}
                    </span>
                  </div>
                </div>

                {/* Bottom Section: Stats & Action Button */}
                <div className="mt-3 pt-3 border-t border-[#1A2640]/60">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span>{participantsCount} Participantes inscritos</span>
                    <span className="font-bold text-[#FF8A00]">{xp}</span>
                  </div>

                  <Link
                    href={`/competitions/${competition.id}`}
                    className="block w-full text-center rounded-xl border border-[#23355A] bg-[#131E35] hover:bg-[#1A2A4A] hover:border-slate-400 py-2 text-xs font-semibold text-white transition active:scale-[0.99]"
                  >
                    Ver reto
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
