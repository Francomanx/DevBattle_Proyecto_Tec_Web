"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useAuth } from "@/context/auth-context";

function CompetitionDetailContent() {
  const params = useParams();
  const competitionId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : "";
  const trpc = useTRPC();
  const { user: currentUser, isLoading: isAuthLoading } = useAuth();

  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  const activateMutation = useMutation(trpc.competition.activate.mutationOptions());

  const {
    data: competition,
    isLoading,
    error,
    refetch,
  } = useQuery({
    ...trpc.competition.byId.queryOptions({
      id: competitionId,
      userId: currentUser?.id,
    }),
    enabled: !isAuthLoading && Boolean(competitionId),
  });

  if (isAuthLoading || isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-orange-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Cargando detalle de la competencia…</p>
        </div>
      </main>
    );
  }

  // Handle errors (such as 403 Forbidden for drafts accessed by non-hosts)
  if (error) {
    const isForbidden =
      error.data?.code === "FORBIDDEN" ||
      error.shape?.data?.code === "FORBIDDEN" ||
      error.message.toLowerCase().includes("solo el host") ||
      error.message.toLowerCase().includes("borrador") ||
      error.message.toLowerCase().includes("draft");

    if (isForbidden) {
      return (
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-2xl border border-amber-500/30 bg-[#111A2E] p-8 text-center shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-white">Acceso Restringido</h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
              Solo el <strong className="text-white">host</strong> de la competencia creada tiene la posibilidad de acceder al detalle de esta competencia en estado borrador.
            </p>
            <div className="pt-4 flex justify-center gap-3">
              <Link
                href="/"
                className="rounded-xl bg-[#FF6B00] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#E05E00] transition shadow-md"
              >
                Volver a Explorar Retos
              </Link>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">
          <h2 className="text-xl font-bold text-red-200">Competencia no encontrada</h2>
          <p className="mt-2 text-sm text-red-300/80">
            {error?.message || "No se pudo cargar la información de la competencia."}
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-block rounded-xl bg-[#FF6B00] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#E05E00]"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!competition) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">
          <h2 className="text-xl font-bold text-red-200">Competencia no encontrada</h2>
          <p className="mt-2 text-sm text-red-300/80">
            No se encontró la información de la competencia especificada.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-block rounded-xl bg-[#FF6B00] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#E05E00]"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Find host participant
  const hostParticipant = competition.participants.find((p) => p.role === "HOST");

  // Determine if current user is the host
  const isHost = Boolean(
    currentUser &&
    hostParticipant &&
    (hostParticipant.userId === currentUser.id ||
      hostParticipant.user?.username === currentUser.username ||
      hostParticipant.user?.username === currentUser.name)
  );

  // If status is DRAFT and not host, restrict access
  if (competition.status === "DRAFT" && !isHost) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-amber-500/30 bg-[#111A2E] p-8 text-center shadow-xl space-y-4">
          <h2 className="text-xl font-bold text-white">Acceso Restringido</h2>
          <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
            Solo el <strong className="text-white">host</strong> de la competencia creada tiene la posibilidad de acceder al detalle de esta competencia en estado borrador.
          </p>
          <div className="pt-4 flex justify-center gap-3">
            <Link
              href="/"
              className="rounded-xl bg-[#FF6B00] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#E05E00] transition shadow-md"
            >
              Volver a Explorar Retos
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const handleActivateCompetition = async () => {
    setActivationError(null);
    setIsActivating(true);
    try {
      await activateMutation.mutateAsync({
        id: competition.id,
        userId: currentUser?.id,
      });
      await refetch();
    } catch (err: unknown) {
      console.error("Error al activar competencia:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al activar la competencia.";
      setActivationError(message);
    } finally {
      setIsActivating(false);
    }
  };

  // Separate metrics
  const objectiveMetrics = competition.metrics.filter((m) => m.type === "OBJECTIVE");
  const subjectiveMetrics = competition.metrics.filter((m) => m.type === "SUBJECTIVE");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Top Navigation / Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition"
        >
          <span>← Volver a Explorar Retos</span>
        </Link>
        <span className="text-xs text-slate-500 font-mono">ID: {competition.id}</span>
      </div>

      {/* Main Banner Card */}
      <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider ${
                competition.status === "DRAFT"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {competition.status === "DRAFT" ? "ESTADO: BORRADOR" : "ESTADO: ACTIVA"}
            </span>
            <span className="text-xs text-slate-400">
              Creado el {new Date(competition.createdAt).toLocaleDateString("es-ES")}
            </span>
          </div>

          {hostParticipant && (
            <div className="flex items-center gap-2 rounded-lg bg-[#0D1527] border border-[#1E2D4A] px-3 py-1.5 text-xs">
              <span className="text-slate-400">Host de la competencia:</span>
              <Link
                href={`/usuarios/${encodeURIComponent(hostParticipant.user.username)}`}
                className="font-semibold text-orange-400 hover:text-orange-300"
              >
                @{hostParticipant.user.username}
              </Link>
              <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold text-orange-300">
                {hostParticipant.role}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {competition.title}
          </h1>

          {competition.status === "DRAFT" && isHost && (
            <button
              type="button"
              onClick={handleActivateCompetition}
              disabled={isActivating}
              className="flex-shrink-0 rounded-xl bg-[#FF6B00] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#E05E00] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isActivating ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Activando…</span>
                </>
              ) : (
                <span>Activar competencia</span>
              )}
            </button>
          )}
        </div>

        {/* Feedback Messages */}
        {activationError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-300 flex items-start gap-3">
            <div className="space-y-1">
              <p className="font-semibold text-red-200">No se pudo activar la competencia</p>
              <p>{activationError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Section 1: Base Description */}
      <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 shadow-lg space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-[#1E2D4A] pb-2">
          1. Descripción y contexto del problema
        </h2>
        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap pt-1">
          {competition.description}
        </div>
      </div>

      {/* Section 2: Rules & Delivery Format */}
      <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 shadow-lg space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-[#1E2D4A] pb-2">
          2. Reglas y formato de recepción
        </h2>

        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-400">Reglas y restricciones:</h3>
            <p className="mt-1 text-sm text-slate-300 whitespace-pre-wrap bg-[#0A101D] p-3.5 rounded-xl border border-[#1E2D4A]">
              {competition.rules}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400">Formatos permitidos de entrega:</h3>
            <div className="mt-1 flex flex-wrap gap-2">
              {competition.fileFormat ? (
                competition.fileFormat.split(",").map((fmt) => (
                  <span
                    key={fmt}
                    className="rounded-lg bg-orange-500/20 border border-orange-500/30 px-3 py-1 text-xs font-semibold uppercase text-orange-300"
                  >
                    {fmt.trim()}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">No especificado</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Evaluation Metrics */}
      <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 shadow-lg space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-[#1E2D4A] pb-2">
          3. Métricas de evaluación configuradas ({competition.metrics.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Objective */}
          <div className="rounded-xl border border-[#1A2845] bg-[#0D1527] p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
              Métricas Automatizadas (Objetivas)
            </h3>
            {objectiveMetrics.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Ninguna definida.</p>
            ) : (
              <ul className="space-y-2">
                {objectiveMetrics.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-lg border border-[#1E2D4A] bg-[#0A101D] p-2.5 text-xs text-white flex items-center justify-between"
                  >
                    <span className="font-semibold">{m.name}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                      Escala 1 al {m.maxValue}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Subjective */}
          <div className="rounded-xl border border-[#1A2845] bg-[#0D1527] p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
              Métricas de Jurado (Subjetivas)
            </h3>
            {subjectiveMetrics.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Ninguna definida.</p>
            ) : (
              <ul className="space-y-2">
                {subjectiveMetrics.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-lg border border-[#1E2D4A] bg-[#0A101D] p-2.5 text-xs text-white flex items-center justify-between"
                  >
                    <span className="font-semibold">{m.name}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                      Escala 1 al {m.maxValue}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Cronograma y Fechas */}
      <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 shadow-lg space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-[#1E2D4A] pb-2">
          4. Cronograma y fechas límite
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="rounded-xl border border-[#1A2845] bg-[#0D1527] p-4">
            <p className="text-xs text-slate-400">Cierre de recepción de soluciones</p>
            <p className="text-base font-bold text-white mt-1">
              {new Date(competition.submissionDeadline).toLocaleString("es-ES", {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </p>
          </div>

          <div className="rounded-xl border border-[#1A2845] bg-[#0D1527] p-4">
            <p className="text-xs text-slate-400">Publicación final y veredicto de jurado</p>
            <p className="text-base font-bold text-white mt-1">
              {new Date(competition.votingDeadline).toLocaleString("es-ES", {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CompetitionDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-4 py-16 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-orange-500 border-t-transparent" />
            <p className="text-sm text-slate-400">Cargando…</p>
          </div>
        </main>
      }
    >
      <CompetitionDetailContent />
    </Suspense>
  );
}
