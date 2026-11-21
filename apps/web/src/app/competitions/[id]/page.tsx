"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useAuth } from "@/context/auth-context";
import { EditCompetitionForm } from "@/components/edit-competition-form";
import { SubmitProjectForm } from "@/components/submit-project-form";

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

  const [isEditing, setIsEditing] = useState(false);

  const [modUsername, setModUsername] = useState("");
  const [modError, setModError] = useState<string | null>(null);
  const [modSuccess, setModSuccess] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [removingModUser, setRemovingModUser] = useState<{ id: string; username: string } | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeModError, setRemoveModError] = useState<string | null>(null);
  const [removeModSuccess, setRemoveModSuccess] = useState<string | null>(null);

  const activateMutation = useMutation(trpc.competition.activate.mutationOptions());
  const inviteModMutation = useMutation(trpc.competition.inviteMod.mutationOptions());
  const cancelModMutation = useMutation(trpc.competition.cancelModInvitation.mutationOptions());
  const removeModMutation = useMutation(trpc.competition.removeModerator.mutationOptions());

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

  const hostParticipant = competition?.participants.find((p) => p.role === "HOST");
  const isHost = Boolean(
    currentUser &&
    hostParticipant &&
    (hostParticipant.userId === currentUser.id ||
      hostParticipant.user?.username === currentUser.username ||
      hostParticipant.user?.username === currentUser.name)
  );

  const { data: modInvitations, refetch: refetchInvitations } = useQuery({
    ...trpc.competition.getModInvitations.queryOptions({
      competitionId,
      userId: currentUser?.id,
    }),
    enabled: Boolean(competitionId) && isHost,
  });

  const cleanModSearchQuery = modUsername.trim().replace(/^@+/, "");

  const { data: userSuggestions, isFetching: isSearchingUsers } = useQuery({
    ...trpc.competition.searchCandidateMods.queryOptions({
      competitionId,
      query: modUsername.trim(),
    }),
    enabled: Boolean(competitionId) && isHost && cleanModSearchQuery.length >= 1,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectSuggestion = (username: string) => {
    setModUsername(username);
    setShowSuggestions(false);
    setModError(null);
  };

  const { data: leaderboardData } = useQuery({
    ...trpc.competition.getLeaderboard.queryOptions({
      competitionId,
    }),
    enabled: Boolean(competitionId),
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

  const handleInviteMod = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (!modUsername.trim()) return;
    setModError(null);
    setModSuccess(null);
    try {
      const res = await inviteModMutation.mutateAsync({
        competitionId,
        username: modUsername.trim(),
        userId: currentUser?.id,
      });
      setModSuccess(res.message);
      setModUsername("");
      await refetchInvitations();
    } catch (err: unknown) {
      console.error("Error al invitar moderador:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al invitar al moderador.";
      setModError(message);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setModError(null);
    setModSuccess(null);
    try {
      await cancelModMutation.mutateAsync({
        invitationId,
        userId: currentUser?.id,
      });
      setModSuccess("Solicitud cancelada exitosamente.");
      await refetchInvitations();
    } catch (err: unknown) {
      console.error("Error al cancelar solicitud:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al cancelar la solicitud.";
      setModError(message);
    }
  };

  const handleStartRemoval = (mod: { id: string; username: string }) => {
    setRemovingModUser(mod);
    setRemoveReason("");
    setRemoveModError(null);
    setRemoveModSuccess(null);
  };

  const handleCancelRemoval = () => {
    setRemovingModUser(null);
    setRemoveReason("");
    setRemoveModError(null);
  };

  const handleConfirmRemoval = async () => {
    if (!removingModUser) return;
    const trimmed = removeReason.trim();
    if (!trimmed || trimmed.length < 5) {
      setRemoveModError("Debes especificar un motivo válido para la destitución (mínimo 5 caracteres).");
      return;
    }

    setRemoveModError(null);
    setRemoveModSuccess(null);
    try {
      const res = await removeModMutation.mutateAsync({
        competitionId,
        targetUserId: removingModUser.id,
        reason: trimmed,
        userId: currentUser?.id,
      });
      setRemoveModSuccess(res.message);
      setRemovingModUser(null);
      setRemoveReason("");
      await refetch();
      await refetchInvitations();
    } catch (err: unknown) {
      console.error("Error al destituir moderador:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al destituir al moderador.";
      setRemoveModError(message);
    }
  };

  // Metrics and Leaderboard calculations
  const totalWeight = competition.metrics.reduce(
    (acc, m) => acc + (m.weight ?? 0),
    0
  );

  return (
    <main
      className={`mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6 ${competition.status === "ACTIVE" ? "max-w-7xl" : "max-w-5xl"
        }`}
    >
      {isEditing ? (
        <EditCompetitionForm
          competition={competition}
          onCancel={() => setIsEditing(false)}
          onSuccess={() => {
            setIsEditing(false);
            refetch();
          }}
        />
      ) : (
        <>
          {/* Top Navigation / Breadcrumb */}
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition"
            >
              <span>← Volver a Explorar Retos</span>
            </Link>
            <span className="text-xs text-slate-500 font-mono">ID: {competition.id}</span>
          </div>

          {/* GRID LAYOUT: 2 columnas (Izquierda: detalles | Derecha: panel de participación) */}
          <div className={`grid grid-cols-1 gap-6 ${competition.status === "ACTIVE" ? "lg:grid-cols-3" : ""}`}>

            {/* COLUMNA IZQUIERDA (Info principal) */}
            <div className={`${competition.status === "ACTIVE" ? "lg:col-span-2" : ""} space-y-6 min-w-0`}>

              {/* Main Banner Card */}
              <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 sm:p-8 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider ${competition.status === "DRAFT"
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

                  <div className="flex items-center gap-3">

                    {isHost && competition.status !== "COMPLETED" && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="flex-shrink-0 rounded-xl border border-[#4A5568] bg-[#2D3748] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#4A5568] active:scale-[0.98]"
                      >
                        Editar competencia
                      </button>
                    )}

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

              {/* Moderation & Jurors Section */}
              <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 shadow-lg space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2D4A] pb-3">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Equipo de Moderación y Jurado
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Los moderadores (MOD) colaboran con el host evaluando proyectos y moderando el certamen.
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-bold text-blue-300 border border-blue-500/30">
                    {competition.participants.filter((p) => p.role === "MOD").length}{" "}
                    {competition.participants.filter((p) => p.role === "MOD").length === 1
                      ? "Moderador"
                      : "Moderadores"}
                  </span>
                </div>

                {/* List of active moderators */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-400">Moderadores activos:</p>
                  {competition.participants.filter((p) => p.role === "MOD").length === 0 ? (
                    <p className="text-xs text-slate-500 italic bg-[#0A101D] p-3 rounded-xl border border-[#1E2D4A]">
                      Aún no hay moderadores asignados a esta competencia.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {competition.participants
                        .filter((p) => p.role === "MOD")
                        .map((m) => (
                          <div
                            key={m.userId}
                            className="flex items-center gap-2 rounded-lg bg-[#0D1527] border border-[#1E2D4A] px-3 py-1.5 text-xs"
                          >
                            <Link
                              href={`/usuarios/${encodeURIComponent(m.user.username)}`}
                              className="font-semibold text-blue-400 hover:text-blue-300"
                            >
                              @{m.user.username}
                            </Link>
                            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-500/30">
                              MOD
                            </span>
                            {isHost && (
                              <button
                                type="button"
                                onClick={() => handleStartRemoval({ id: m.userId, username: m.user.username })}
                                className="rounded px-2 py-0.5 text-[10px] font-bold text-red-400 hover:text-white hover:bg-red-500/20 border border-transparent hover:border-red-500/30 transition ml-1"
                                title="Destituir de la moderación"
                              >
                                Destituir
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Panel de Destitución con Motivo Obligatorio (Solo Host) */}
                  {isHost && removingModUser && (
                    <div className="rounded-xl border border-red-500/40 bg-[#160B12] p-4 space-y-3 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          <h4 className="text-xs font-bold text-red-200">
                            Destituir a @{removingModUser.username} de la moderación
                          </h4>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Esta acción revocará de inmediato su rol de moderador en esta competencia concreta. Se enviará una notificación formal al usuario con el motivo indicado, sin derecho a réplica.
                      </p>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Motivo de la destitución (obligatorio):
                        </label>
                        <textarea
                          value={removeReason}
                          onChange={(e) => {
                            setRemoveReason(e.target.value);
                            if (removeModError) setRemoveModError(null);
                          }}
                          rows={3}
                          placeholder="Describe con claridad las razones por las cuales se remueve al usuario del rol de moderador..."
                          className="w-full rounded-lg border border-[#2D1624] bg-[#0A101D] p-2.5 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                        />
                      </div>

                      {removeModError && (
                        <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                          {removeModError}
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCancelRemoval}
                          disabled={removeModMutation.isPending}
                          className="rounded-lg border border-[#1E2D4A] bg-[#0A101D] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmRemoval}
                          disabled={removeModMutation.isPending || removeReason.trim().length < 5}
                          className="rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5"
                        >
                          {removeModMutation.isPending ? "Destituyendo..." : "Confirmar Destitución"}
                        </button>
                      </div>
                    </div>
                  )}

                  {removeModSuccess && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-between">
                      <span>{removeModSuccess}</span>
                      <button
                        type="button"
                        onClick={() => setRemoveModSuccess(null)}
                        className="text-xs text-emerald-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Host controls to invite new moderators */}
                {isHost && (
                  <div className="mt-4 pt-4 border-t border-[#1E2D4A] space-y-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                        Añadir moderador (Acción de Host)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Envía una solicitud a un usuario por su nombre de usuario. El usuario tendrá el rol de MOD únicamente si acepta la solicitud en su perfil.
                      </p>
                    </div>

                    <form onSubmit={handleInviteMod} className="flex flex-col sm:flex-row gap-2 relative">
                      <div ref={searchContainerRef} className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Buscar usuario por nombre (ej. dev_user)..."
                          value={modUsername}
                          onFocus={() => {
                            if (modUsername.trim().length >= 1) {
                              setShowSuggestions(true);
                            }
                          }}
                          onChange={(e) => {
                            setModUsername(e.target.value);
                            setShowSuggestions(true);
                            if (modError) setModError(null);
                            if (modSuccess) setModSuccess(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setShowSuggestions(false);
                          }}
                          className="w-full rounded-xl border border-[#1E2D4A] bg-[#0A101D] px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />

                        {/* Suggestions Dropdown */}
                        {showSuggestions && cleanModSearchQuery.length >= 1 && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl border border-[#1E2D4A] bg-[#0B1220] shadow-2xl overflow-hidden divide-y divide-[#16233B]">
                            {isSearchingUsers ? (
                              <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                                <span>Buscando sugerencias…</span>
                              </div>
                            ) : userSuggestions && userSuggestions.length > 0 ? (
                              <div>
                                <div className="px-3 py-1.5 bg-[#080D17] text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                  Sugerencias de usuarios
                                </div>
                                <ul className="max-h-56 overflow-y-auto">
                                  {userSuggestions.map((u) => {
                                    const isSelectable = !u.isMod && !u.isPendingInvite && !u.isHost;
                                    return (
                                      <li
                                        key={u.id}
                                        className={`flex items-center justify-between gap-3 px-3.5 py-2 text-xs transition ${isSelectable
                                          ? "hover:bg-[#121B2F] cursor-pointer"
                                          : "bg-[#0A0F1A] opacity-70 cursor-not-allowed"
                                          }`}
                                        onClick={() => {
                                          if (isSelectable) {
                                            handleSelectSuggestion(u.username);
                                          }
                                        }}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/20 text-orange-300 font-bold text-[11px]">
                                            {u.username.slice(0, 1).toUpperCase()}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="font-semibold text-white truncate">
                                              @{u.username}
                                            </p>
                                            {u.description && (
                                              <p className="text-[10px] text-slate-400 truncate">
                                                {u.description}
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        <div className="shrink-0">
                                          {u.isHost ? (
                                            <span className="rounded bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-300 border border-orange-500/30">
                                              Host del reto
                                            </span>
                                          ) : u.isMod ? (
                                            <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-500/30">
                                              Ya es MOD
                                            </span>
                                          ) : u.isPendingInvite ? (
                                            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                                              Solicitud enviada
                                            </span>
                                          ) : (
                                            <span className="rounded bg-slate-800 hover:bg-[#FF6B00] hover:text-white px-2 py-0.5 text-[10px] font-semibold text-slate-300 transition">
                                              Seleccionar
                                            </span>
                                          )}
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ) : (
                              <div className="p-3 text-center text-xs text-slate-400">
                                No se encontraron usuarios coincidentes.
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={inviteModMutation.isPending || !modUsername.trim()}
                        className="rounded-xl bg-[#FF6B00] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#E05E00] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 h-fit sm:self-start"
                      >
                        {inviteModMutation.isPending ? "Enviando…" : "Enviar solicitud"}
                      </button>
                    </form>

                    {modSuccess && (
                      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                        {modSuccess}
                      </div>
                    )}

                    {modError && (
                      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                        {modError}
                      </div>
                    )}

                    {/* List of pending/recent invitations */}
                    {modInvitations &&
                      modInvitations.filter((inv) => inv.status !== "ACCEPTED").length > 0 && (
                        <div className="space-y-2 pt-2">
                          <p className="text-xs font-semibold text-slate-400">Solicitudes enviadas:</p>
                          <div className="space-y-1.5">
                            {modInvitations
                              .filter((inv) => inv.status !== "ACCEPTED")
                              .map((inv) => (
                                <div
                                  key={inv.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#0A101D] border border-[#1E2D4A] px-3 py-2 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <Link
                                      href={`/usuarios/${encodeURIComponent(inv.invitedUser.username)}`}
                                      className="font-semibold text-white hover:text-orange-400"
                                    >
                                      @{inv.invitedUser.username}
                                    </Link>
                                    <span className="text-[11px] text-slate-400">
                                      {new Date(inv.createdAt).toLocaleDateString("es-ES")}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${inv.status === "PENDING"
                                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                        : "bg-red-500/20 text-red-300 border border-red-500/30"
                                        }`}
                                    >
                                      {inv.status === "PENDING" ? "Pendiente" : "Rechazada"}
                                    </span>
                                    {inv.status === "PENDING" && (
                                      <button
                                        type="button"
                                        onClick={() => handleCancelInvitation(inv.id)}
                                        disabled={cancelModMutation.isPending}
                                        className="text-[11px] text-red-400 hover:text-red-300 underline font-medium"
                                      >
                                        Cancelar
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Section 1: Base Description */}
              <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 shadow-lg space-y-3 min-w-0 max-w-full overflow-hidden">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-[#1E2D4A] pb-2">
                  1. Descripción y contexto del problema
                </h2>
                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] pt-1">
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

              {/* Section 3: Evaluation Metrics & Rubric */}
              <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 shadow-lg space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2D4A] pb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    3. Rúbrica y métricas de evaluación ({competition.metrics.length})
                  </h2>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                    {totalWeight}% Ponderado Total
                  </span>
                </div>

                {/* Visual segmented progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#1A2845] flex">
                  {competition.metrics.map((m, idx) => {
                    const widthPercent = Math.max(0, Math.min(100, Number(m.weight) || 0));
                    if (widthPercent === 0) return null;
                    const colors = [
                      "bg-orange-500",
                      "bg-blue-500",
                      "bg-emerald-500",
                      "bg-purple-500",
                      "bg-amber-500",
                      "bg-cyan-500",
                    ];
                    const color = colors[idx % colors.length];
                    return (
                      <div
                        key={m.id}
                        style={{ width: `${widthPercent}%` }}
                        className={`${color} h-full transition-all duration-300`}
                        title={`${m.name}: ${widthPercent}%`}
                      />
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {competition.metrics.map((m, idx) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-[#1E2D4A] bg-[#0A101D] p-3.5 space-y-2.5 transition hover:border-[#283C63]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                          {idx + 1}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${m.type === "OBJECTIVE"
                            ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            }`}
                        >
                          {m.type === "OBJECTIVE" ? "Técnico" : "Jurado"}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-white leading-snug">{m.name}</p>
                        <p className="text-[11px] font-semibold text-orange-400 mt-0.5">
                          {m.weight}% de la nota final
                        </p>
                      </div>

                      <div className="rounded-lg bg-[#0E1627] border border-[#16233B] px-2.5 py-1.5 text-[10px] text-slate-400">
                        <p className="font-mono text-slate-300">Escala 1 a {m.maxValue}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">1: Insuficiente | 3: Aceptable | 5: Sobresaliente</p>
                      </div>
                    </div>
                  ))}
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

              {/* Section 5: Leaderboard / Tabla de Posiciones */}
              <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 shadow-lg space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2D4A] pb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      5. Tabla de posiciones y TOP de participantes
                    </h2>
                  </div>
                  {leaderboardData && !leaderboardData.isVotingClosed ? (
                    <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-bold text-blue-300 border border-blue-500/30">
                      Votación en curso (TOP no disponible)
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                      Resultados oficiales (Votación finalizada)
                    </span>
                  )}
                </div>

                {leaderboardData && !leaderboardData.isVotingClosed ? (
                  <div className="rounded-xl border border-[#1A2845] bg-[#0A101D] p-6 text-center space-y-3">
                    <p className="text-sm font-semibold text-white">
                      El cálculo de puntajes y el TOP oficial se publicarán al finalizar la votación
                    </p>
                    <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                      Las competencias que aún no llegan a su fin no pueden contar con un TOP. Las evaluaciones y calificaciones ponderadas se calcularán de forma automática una vez concluida la fecha límite de votación.
                    </p>
                    <div className="inline-flex items-center gap-2 rounded-lg bg-[#0E1627] border border-[#16233B] px-3.5 py-2 text-xs text-slate-300 font-mono">
                      <span>Fecha límite de votación:</span>
                      <span className="font-bold text-orange-400">
                        {new Date(competition.votingDeadline).toLocaleString("es-ES", {
                          dateStyle: "full",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>
                ) : leaderboardData && leaderboardData.leaderboard.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-white">
                      <thead className="bg-[#0A101D] text-slate-400 uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="px-4 py-3 rounded-l-lg">Puesto</th>
                          <th className="px-4 py-3">Participante / Proyecto</th>
                          <th className="px-4 py-3 text-right">Nota (1 a 5)</th>
                          <th className="px-4 py-3 text-right">Puntaje Final</th>
                          <th className="px-4 py-3 text-right rounded-r-lg">Entregado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A2845]">
                        {leaderboardData.leaderboard.map((item) => (
                          <tr key={item.projectId} className="hover:bg-[#0D1527] transition">
                            <td className="px-4 py-3 font-bold">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold ${item.rank === 1
                                  ? "bg-amber-400 text-slate-900 shadow"
                                  : item.rank === 2
                                    ? "bg-slate-300 text-slate-900"
                                    : item.rank === 3
                                      ? "bg-amber-700 text-white"
                                      : "bg-slate-800 text-slate-300"
                                  }`}
                              >
                                {item.rank}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-semibold text-white">{item.title}</span>
                                <Link
                                  href={`/usuarios/${encodeURIComponent(item.author.username)}`}
                                  className="text-[11px] text-orange-400 hover:text-orange-300"
                                >
                                  @{item.author.username}
                                </Link>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-300">
                              {item.scoreOutOf5.toFixed(2)} / 5
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-orange-400">
                              {item.scoreOutOf100.toFixed(1)} pts
                            </td>
                            <td className="px-4 py-3 text-right text-slate-400 text-[11px]">
                              {new Date(item.submissionDate).toLocaleDateString("es-ES")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#1A2845] bg-[#0A101D] p-6 text-center text-xs text-slate-400">
                    La competencia ha finalizado, pero no se registraron proyectos evaluados para generar el ranking.
                  </div>
                )}
              </div>
            </div>

            {/* COLUMNA DERECHA (Panel de Participación) */}
            {competition.status === "ACTIVE" && (
              <div className="lg:col-span-1">
                <div className="sticky top-6">
                  <SubmitProjectForm
                    competitionId={competition.id}
                    competitionStatus={competition.status}
                    fileFormats={competition.fileFormat || "link"}
                    hasUserAlreadySubmitted={Boolean(
                      competition.projects?.some((p: any) => p.authorId === currentUser?.id)
                    )}
                    onSuccessSubmit={() => refetch()}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

export default function CompetitionDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-4 py-16 text-center">
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