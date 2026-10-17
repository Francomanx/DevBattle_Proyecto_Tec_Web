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
      format: activeFormat === "" ? undefined : activeFormat
    })
  );

  if (isPending) return <p className="text-zinc-500">Cargando retos…</p>;
  if (error) return <p className="text-red-600">Error: {error.message}</p>;

  const filteredData = data.items;

  return (
    <div className="w-full">

      {/* Controles: tabs y ordenamiento */}
      <div className="mb-6 flex items-center justify-between">
        
        {/* Pestañas tabs*/}
        <div className="inline-flex items-center rounded-lg border border-[#455b7a] bg-[#263245] p-1">
          
          {filters?.statuses.includes("active") && (
          <button
            onClick={() => {
              setActiveTab("active");
              setCurrentPage(1);
            }}
            className={`rounded-md px-4 py-2 text-sm transition-all ${
              activeTab === "active"
                ? "border border-orange-500/70 bg-[#0F172A] text-white"
                : "border border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            Activos (En competición)
          </button>
          )}
          
          {filters?.statuses.includes("vote") && (
          <button
            onClick={() => {
              setActiveTab("vote");
              setCurrentPage(1);
            }}
            className={`rounded-md px-4 py-2 text-sm transition-all ${
              activeTab === "vote"
                ? "border border-orange-500/70 bg-[#0F172A] text-white"
                : "border border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            En votación
          </button>
          )}
          
          {filters?.statuses.includes("completed") && (
          <button
            onClick={() => {
              setActiveTab("completed");
              setCurrentPage(1);
            }}
            className={`rounded-md px-4 py-2 text-sm transition-all ${
              activeTab === "completed"
                ? "border border-orange-500/70 bg-[#0F172A] text-white"
                : "border border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            Finalizados
          </button>
          )}

        </div>

          {/*Dropdown de formatos*/}
          {filters && filters.formats.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>Formato:</span>
              <select 
                value={activeFormat}
                onChange={(e) => {
                  setActiveFormat(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded border border-[#455b7a] bg-[#161B28] px-3 py-2 text-white outline-none"
              >
                <option value="">Todos</option>
                {filters.formats.map((format) => (
                  <option key={format} value={format}>{format}</option>
                ))}
              </select>
            </div>
          )}
      </div>

      {/*Grilla de resultados*/}
      {data.items.length === 0 ? (
        
        <div className="mt-10 rounded-lg border border-dashed border-[#455b7a] py-20 text-center">
          <p className="text-lg font-semibold text-white">No hay competencias disponibles</p>
        </div>

      ) : (

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>

      )}

      {/*Barra de paginación*/}
      {data.items.length > 0 && (
        <div className="mt-8 flex items-center justify-between rounded-lg border border-[#455b7a] bg-[#1E2433] px-6 py-4">
          
          {/* Texto de información*/}
          <span className="text-sm text-zinc-400">
            {data.meta.totalPages === 1 ? (
              <>
                Mostrando <span className="font-bold text-white">{data.meta.total}</span> resultados
              </>
            ) : (
              <>
                Mostrando <span className="font-bold text-white">{data.items.length}</span> de <span className="font-bold text-white">{data.meta.total}</span> resultados
              </>
            )}
          </span>

          {/*Controles de página*/}
          <div className="flex items-center gap-2 text-sm font-semibold">
            
            {/*Botón anterior*/}
            <button 
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex h-8 w-8 items-center justify-center rounded border border-zinc-600 bg-[#161B28] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-50 disabled:hover:border-zinc-600 disabled:hover:text-zinc-400"
            >
              &lt;
            </button>

            {/*Dibuja un botón por cada página disponible*/}
            {Array.from({ length: data.meta.totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
                  currentPage === pageNum
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "border border-zinc-600 bg-[#161B28] text-zinc-400 hover:border-zinc-500 hover:text-white"
                }`}
              >
                {pageNum}
              </button>
            ))}

            {/* Botón Siguiente */}
            <button 
              onClick={() => setCurrentPage((prev) => Math.min(data.meta.totalPages, prev + 1))}
              disabled={currentPage === data.meta.totalPages}
              className="flex h-8 w-8 items-center justify-center rounded border border-zinc-600 bg-[#161B28] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-50 disabled:hover:border-zinc-600 disabled:hover:text-zinc-400"
            >
              &gt;
            </button>

          </div>
        </div>
      )}

    </div>
  );
}