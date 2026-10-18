"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

const statusBadges = {
  DRAFT: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  ACTIVE: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  VOTING: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  COMPLETED: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
} as const;

export function CompetitionList() {
  const trpc = useTRPC();
  const { data, isPending, error } = useQuery(trpc.competition.list.queryOptions());

  if (isPending) return <p className="text-slate-400">Cargando competencias…</p>;

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
        <p className="font-medium">No se pudo conectar con la API:</p>
        <p className="text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="text-slate-400">
        Todavía no hay competencias activas. Haz clic en{" "}
        <Link href="/competitions/create" className="text-orange-400 underline font-semibold">
          Crear Reto
        </Link>{" "}
        para crear la primera.
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      {data.map((competition) => (
        <article
          key={competition.id}
          className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 shadow-md transition hover:border-[#2C426D] hover:shadow-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/competitions/${competition.id}`}
              className="text-xl font-bold tracking-tight text-white hover:text-orange-400 transition"
            >
              {competition.title}
            </Link>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                statusBadges[competition.status] ?? statusBadges.ACTIVE
              }`}
            >
              {competition.status}
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-300 line-clamp-3">
            {competition.description}
          </p>

          <div className="mt-4 rounded-xl bg-[#0A101D] border border-[#1A2640] p-3 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">Reglas: </span>
            {competition.rules}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[#1A2640] pt-4 text-xs text-slate-400">
            <div>
              <span className="font-semibold text-slate-200">
                {competition._count.participants}
              </span>{" "}
              participantes
            </div>
            <div>
              <span className="font-semibold text-slate-200">
                {competition._count.projects}
              </span>{" "}
              proyectos postulados
            </div>
            <div>
              <span className="font-semibold text-slate-200">
                {competition.metrics.length}
              </span>{" "}
              métricas
            </div>
            <div className="ml-auto">
              Cierre de entrega:{" "}
              <time className="font-medium text-slate-200">
                {new Date(competition.submissionDeadline).toLocaleDateString("es-ES")}
              </time>
            </div>
            <div>
              <Link
                href={`/competitions/${competition.id}`}
                className="text-xs font-semibold text-orange-400 hover:text-orange-300 underline"
              >
                Ver detalle →
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
