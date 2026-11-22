"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useAuth } from "@/context/auth-context";

interface Metric {
  id: string;
  name: string;
  maxValue: number;
}

interface VoteProjectFormProps {
  projectId: string;
  competitionStatus: string;
  isDisqualified: boolean;
  projectAuthorId: string;
  metrics: Metric[];
  existingVotes?: { metricId: string; score: number }[];
  onVoteSuccess?: () => void;
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 shadow-xl space-y-4">
      <h3 className="text-lg font-bold text-white border-b border-[#1E2D4A] pb-3">
        Votación del Proyecto
      </h3>
      {children}
    </div>
  );
}

export function VoteProjectForm({
  projectId,
  competitionStatus,
  isDisqualified,
  projectAuthorId,
  metrics,
  existingVotes = [],
  onVoteSuccess,
}: VoteProjectFormProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const trpc = useTRPC();

  const [scores, setScores] = useState<Record<string, number>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const voteMutation = useMutation(trpc.vote.voteForProject.mutationOptions());

  if (isAuthLoading || !user) {
    return null;
  }

  if (competitionStatus !== "VOTING") {
    return null;
  }

  if (isDisqualified) {
    return (
      <Wrapper>
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
          <p className="text-sm font-semibold text-red-300">
            No se puede votar en un proyecto descalificado.
          </p>
        </div>
      </Wrapper>
    );
  }

  if (user.id === projectAuthorId) {
    return (
      <Wrapper>
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-center">
          <p className="text-sm font-semibold text-amber-300">
            No puedes votar por un proyecto propio.
          </p>
        </div>
      </Wrapper>
    );
  }

  const hasVoted = existingVotes.length > 0 || successMessage !== null;

  if (hasVoted) {
    return (
      <Wrapper>
        <div className="space-y-4">
          <div className="grid gap-3">
            {metrics.map((metric) => {
              const score =
                existingVotes.find((v) => v.metricId === metric.id)?.score ||
                scores[metric.id] ||
                0;

              return (
                <div key={metric.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#0A101D] p-3 border border-[#1A2845]">
                  <span className="text-sm font-medium text-slate-300">{metric.name}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <div
                        key={val}
                        className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold ${
                          val <= score
                            ? "bg-orange-500 text-white"
                            : "bg-[#16233B] text-slate-500"
                        }`}
                      >
                        {val}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
            <p className="text-sm font-semibold text-emerald-400">
              {successMessage || "Ya has votado por este proyecto."}
            </p>
          </div>
        </div>
      </Wrapper>
    );
  }

  const handleScoreChange = (metricId: string, value: number) => {
    setScores((prev) => ({ ...prev, [metricId]: value }));
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    const missingMetrics = metrics.filter((m) => !scores[m.id]);
    if (missingMetrics.length > 0) {
      setErrorMessage("Por favor, asigna una calificación (1-5) a todas las métricas antes de enviar.");
      return;
    }

    try {
      const scoresPayload = metrics.map((m) => ({
        metricId: m.id,
        score: scores[m.id],
      }));

      const res = await voteMutation.mutateAsync({
        projectId,
        scores: scoresPayload,
      });

      setSuccessMessage(res.message);
      if (onVoteSuccess) onVoteSuccess();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al registrar el voto."
      );
    }
  };

  return (
    <Wrapper>
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Califica este proyecto del 1 al 5 en cada métrica (1 = Insuficiente, 5 = Sobresaliente).
        </p>

        <div className="grid gap-3">
          {metrics.map((metric) => (
            <div key={metric.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#0A101D] p-3 border border-[#1A2845] transition hover:border-[#283C63]">
              <span className="text-sm font-medium text-white">{metric.name}</span>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((val) => {
                  const isSelected = scores[metric.id] === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleScoreChange(metric.id, val)}
                      className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold transition-all hover:scale-105 active:scale-95 ${
                        isSelected
                          ? "bg-[#FF6B00] text-white shadow-md shadow-orange-500/20 border-orange-500"
                          : "bg-[#16233B] text-slate-400 hover:bg-[#1E2D4A] border-transparent"
                      } border`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={voteMutation.isPending || metrics.length !== Object.keys(scores).length}
          className="w-full rounded-xl bg-[#FF6B00] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#E05E00] active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
        >
          {voteMutation.isPending ? "Registrando voto..." : "Confirmar Voto"}
        </button>
      </div>
    </Wrapper>
  );
}