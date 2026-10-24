"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

const statusBadges: Record<string, string> = {
  DRAFT: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  ACTIVE: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  VOTING: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  COMPLETED: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
};

export function ChallengeList() {
  const trpc = useTRPC();
  const { data, isPending, error } = useQuery(trpc.competition.list.queryOptions());

  if (isPending) return <p className="text-slate-400">Cargando retos...</p>;
  if (error) {
    return (
      <p className="text-red-400 font-medium">
        No se pudo conectar con la API: {error.message}
      </p>
    );
  }
  if (!data || data.length === 0) {
    return <p className="text-slate-400">Todavía no hay retos.</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((item) => (
        <li
          key={item.id}
          className="rounded-xl border border-[#1E2D4A] bg-[#111A2E] p-5 shadow"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-white line-clamp-1">{item.title}</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                statusBadges[item.status] ?? statusBadges.ACTIVE
              }`}
            >
              {item.status}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-300 line-clamp-3">{item.description}</p>
          <div className="mt-4 pt-3 border-t border-[#1A2640] flex justify-between items-center text-xs text-slate-400">
            <span>{item._count?.participants ?? 0} participantes</span>
            <Link
              href={`/competitions/${item.id}`}
              className="text-orange-400 hover:text-orange-300 underline font-semibold"
            >
              Ver reto →
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
