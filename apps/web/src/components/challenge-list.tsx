"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

const badge = {
  EASY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  HARD: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
} as const;

export function ChallengeList() {
  const trpc = useTRPC();
  const { data, isPending, error } = useQuery(trpc.challenge.list.queryOptions());

  if (isPending) return <p className="text-zinc-500">Cargando retos…</p>;
  if (error) {
    return (
      <p className="text-red-600">
        No se pudo conectar con la API: {error.message}
      </p>
    );
  }
  if (data.length === 0) {
    return <p className="text-zinc-500">Todavía no hay retos. Ejecutá `pnpm db:seed`.</p>;
  }

  return (
    <ul className="grid gap-4">
      {data.map((challenge) => (
        <li
          key={challenge.id}
          className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{challenge.title}</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[challenge.difficulty]}`}
            >
              {challenge.difficulty}
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {challenge.description}
          </p>
        </li>
      ))}
    </ul>
  );
}
