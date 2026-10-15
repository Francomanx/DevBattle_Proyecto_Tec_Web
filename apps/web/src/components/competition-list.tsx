"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

const statusBadges = {
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  VOTING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
} as const;

export function CompetitionList() {
  const trpc = useTRPC();
  const { data, isPending, error } = useQuery(trpc.competition.list.queryOptions());

  if (isPending) return <p className="text-zinc-500">Cargando competencias…</p>;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
        <p className="font-medium">No se pudo conectar con la API:</p>
        <p className="text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="text-zinc-500">
        Todavía no hay competencias activas. Ejecutá <code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">pnpm db:seed</code>.
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      {data.map((competition) => (
        <article
          key={competition.id}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {competition.title}
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadges[competition.status] ?? statusBadges.ACTIVE
                }`}
            >
              {competition.status}
            </span>
          </div>

          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {competition.description}
          </p>

          <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Reglas: </span>
            {competition.rules}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-zinc-100 pt-4 text-xs text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
            <div>
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {competition._count.participants}
              </span>{" "}
              participantes
            </div>
            <div>
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {competition._count.projects}
              </span>{" "}
              proyectos postulados
            </div>
            <div>
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {competition.metrics.length}
              </span>{" "}
              métricas
            </div>
            <div className="ml-auto">
              Cierre de entrega:{" "}
              <time className="font-medium text-zinc-700 dark:text-zinc-200">
                {new Date(competition.submissionDeadline).toLocaleDateString("es-ES")}
              </time>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
