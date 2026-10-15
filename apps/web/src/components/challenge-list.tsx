"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

const badge = {
  EASY: "difficulty-easy",
  MEDIUM: "difficulty-medium",
  HARD: "difficulty-hard",
} as const;

export function ChallengeList() {
  const trpc = useTRPC();
  const { data, isPending, error } = useQuery(trpc.challenge.list.queryOptions());

  if (isPending) return <p className="challenge-status">Cargando retos...</p>;
  if (error) {
    return (
      <p className="challenge-status is-error">
        No se pudo conectar con la API: {error.message}
      </p>
    );
  }
  if (data.length === 0) {
    return <p className="challenge-status">Todavía no hay retos.</p>;
  }

  return (
    <ul className="challenge-grid">
      {data.map((challenge) => (
        <li key={challenge.id} className="challenge-item">
          <div className="challenge-item-head">
            <h2>{challenge.title}</h2>
            <span
              className={`difficulty-tag ${badge[challenge.difficulty]}`}
            >
              {challenge.difficulty}
            </span>
          </div>
          <p>{challenge.description}</p>
        </li>
      ))}
    </ul>
  );
}
