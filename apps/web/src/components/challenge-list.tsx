"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { ChallengeCard } from "./challenge-card";

export function ChallengeList() {
  const trpc = useTRPC();
  const [activeTab, setActiveTab] = useState<"active" | "vote" | "completed">("active");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFormat, setActiveFormat] = useState<string>("");

  const { data: filters } = useQuery(trpc.challenge.getAvailableFilters.queryOptions());

  const { data, isPending, error } = useQuery(
    trpc.challenge.list.queryOptions({
      page: currentPage,
      status: activeTab,
      format: activeFormat === "" ? undefined : activeFormat,
    })
  );

  if (isPending) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300 break-words">
        <p className="font-semibold">No se pudo conectar con la API:</p>
        <p className="text-sm mt-1 text-red-400 break-words">{error.message}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="w-full space-y-6">
      {/* Controles: tabs y selector de formato */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Pestañas tabs */}
        <div className="inline-flex items-center rounded-lg border border-[#455b7a] bg-[#263245] p-1">
          {(!filters || filters.statuses.includes("active")) && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("active");
                setCurrentPage(1);
              }}
              className={`rounded-md px-4 py-2 text-sm transition-all cursor-pointer ${
                activeTab === "active"
                  ? "border border-orange-500/70 bg-[#0F172A] text-white font-semibold"
                  : "border border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              Activos (En competición)
            </button>
          )}

          {(!filters || filters.statuses.includes("vote")) && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("vote");
                setCurrentPage(1);
              }}
              className={`rounded-md px-4 py-2 text-sm transition-all cursor-pointer ${
                activeTab === "vote"
                  ? "border border-orange-500/70 bg-[#0F172A] text-white font-semibold"
                  : "border border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              En votación
            </button>
          )}

          {(!filters || filters.statuses.includes("completed")) && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("completed");
                setCurrentPage(1);
              }}
              className={`rounded-md px-4 py-2 text-sm transition-all cursor-pointer ${
                activeTab === "completed"
                  ? "border border-orange-500/70 bg-[#0F172A] text-white font-semibold"
                  : "border border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              Finalizados
            </button>
          )}
        </div>

        {/* Dropdown de formatos */}
        {filters && filters.formats.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span>Formato:</span>
            <select
              value={activeFormat}
              onChange={(e) => {
                setActiveFormat(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded border border-[#455b7a] bg-[#161B28] px-3 py-2 text-white outline-none cursor-pointer focus:border-orange-500"
            >
              <option value="">Todos</option>
              {filters.formats.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Grilla de resultados */}
      {data.items.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-[#455b7a] py-20 text-center">
          <p className="text-lg font-semibold text-white">No hay competencias disponibles</p>
          <p className="text-sm text-zinc-400 mt-1">Prueba seleccionando otro estado o formato.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>
      )}

      {/* Barra de paginación */}
      {data.items.length > 0 && (
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-[#455b7a] bg-[#1E2433] px-6 py-4">
          {/* Texto de información */}
          <span className="text-sm text-zinc-400">
            {data.meta.totalPages === 1 ? (
              <>
                Mostrando <span className="font-bold text-white">{data.meta.total}</span> resultados
              </>
            ) : (
              <>
                Mostrando <span className="font-bold text-white">{data.items.length}</span> de{" "}
                <span className="font-bold text-white">{data.meta.total}</span> resultados
              </>
            )}
          </span>

          {/* Controles de página */}
          <div className="flex items-center gap-2 text-sm font-semibold">
            {/* Botón anterior */}
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex h-8 w-8 items-center justify-center rounded border border-zinc-600 bg-[#161B28] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &lt;
            </button>

            {/* Dibuja un botón por cada página disponible */}
            {Array.from({ length: data.meta.totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
                  currentPage === pageNum
                    ? "bg-orange-500 text-white hover:bg-orange-600 font-bold"
                    : "border border-zinc-600 bg-[#161B28] text-zinc-400 hover:border-zinc-500 hover:text-white"
                }`}
              >
                {pageNum}
              </button>
            ))}

            {/* Botón Siguiente */}
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(data.meta.totalPages, prev + 1))}
              disabled={currentPage === data.meta.totalPages}
              className="flex h-8 w-8 items-center justify-center rounded border border-zinc-600 bg-[#161B28] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}