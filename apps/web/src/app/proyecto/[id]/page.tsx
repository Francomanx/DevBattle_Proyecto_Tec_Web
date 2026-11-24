"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useTRPC } from "@/trpc/client";
import { VoteProjectForm } from "@/components/vote-project-form";

function ProjectDetailContent() {
  const params = useParams();
  const projectId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const trpc = useTRPC();
  const { user } = useAuth();

  console.log("--> ID recibido en la página del proyecto:", projectId);
  console.log("--> Parámetros completos:", params);

  const [isDisqualifying, setIsDisqualifying] = useState(false);
  const [isConfirmingDisqualification, setIsConfirmingDisqualification] = useState(false);
  const [disqualifyReason, setDisqualifyReason] = useState("");
  const [disqualifyError, setDisqualifyError] = useState<string | null>(null);
  const [disqualifySuccess, setDisqualifySuccess] = useState<string | null>(null);

  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const downloadQuery = useQuery({
    ...trpc.project.getDownloadUrl.queryOptions({ projectId }),
    enabled: false,
  });

  async function handleDownload() {
    setDownloadError(null);

    if (!user) {
      router.push("/login");
      return;
    }

    try {
      setIsDownloading(true);
      const result = await downloadQuery.refetch();

      if (result.error) {
        throw result.error;
      }

      if (result.data?.downloadUrl) {
        const link = document.createElement("a");
        link.href = result.data.downloadUrl;
        link.setAttribute("download", result.data.fileName || "proyecto");
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err: unknown) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : "No se pudo descargar el archivo del proyecto."
      );
    } finally {
      setIsDownloading(false);
    }
  }

  const { data: project, isLoading, error, refetch: refetchProject } = useQuery(
    trpc.project.byId.queryOptions({ id: projectId })
  );

  const disqualifyMutation = useMutation(trpc.project.disqualify.mutationOptions());

  if (isLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-orange-500 border-t-transparent" />
          <p className="text-sm text-zinc-400">Cargando proyecto...</p>
        </div>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-white">Proyecto no encontrado</h1>
        <p className="mt-2 text-zinc-400">El ID buscado no corresponde a ningún proyecto válido.</p>
        <Link href="/" className="mt-6 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
          Volver al inicio
        </Link>
      </main>
    );
  }

  const submissionDate = new Date(project.submissionDate).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const callerParticipant = project.competition?.participants?.find(
    (p) => p.userId === user?.id
  );
  const isHost = callerParticipant?.role === "HOST";
  const isMod = callerParticipant?.role === "MOD";
  const canModerate = Boolean(
    user &&
      (isHost || isMod) &&
      project.competition?.status !== "COMPLETED"
  );
  const projectIdForDisqualification = project.id;

  async function handleDisqualify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDisqualifyError(null);
    const reason = disqualifyReason.trim();
    if (reason.length < 5) {
      setDisqualifyError("Debes ingresar un motivo de al menos 5 caracteres.");
      return;
    }

    setIsConfirmingDisqualification(true);
  }

  async function confirmDisqualification() {
    setDisqualifyError(null);
    const reason = disqualifyReason.trim();
    try {
      await disqualifyMutation.mutateAsync({
        projectId: projectIdForDisqualification,
        reason,
      });
      setIsDisqualifying(false);
      setIsConfirmingDisqualification(false);
      setDisqualifyReason("");
      setDisqualifySuccess("Proyecto descalificado exitosamente.");
      await refetchProject();
    } catch (error: unknown) {
      setIsConfirmingDisqualification(false);
      setDisqualifyError(
        error instanceof Error
          ? error.message
          : "Ha ocurrido un error inesperado."
      );
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:py-12">
      {disqualifySuccess && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"
        >
          {disqualifySuccess}
        </p>
      )}
      
      <nav className="mb-8">
        <Link 
          href={`/reto/${project.competitionId}`} 
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Volver a la competencia
        </Link>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        
        <div className="flex flex-col gap-6 lg:col-span-2">
          
          {project.isDisqualified && (
            <div className="flex items-start gap-4 rounded-xl border border-red-500/50 bg-red-500/10 p-5 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div>
                <h3 className="font-bold text-red-400">Proyecto Descalificado</h3>
                <p className="mt-1 text-sm text-red-200/90 leading-relaxed break-words [overflow-wrap:anywhere]">
                  <span className="font-semibold text-red-300">Motivo:</span> {project.disqualificationReason}
                </p>
                {project.disqualifiedBy?.username && (
                  <p className="mt-2 text-xs text-red-200/70">
                    Descalificado por @{project.disqualifiedBy.username}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-[#455b7a] bg-[#1E2433] shadow-lg">
            
            <div className="h-24 w-full bg-gradient-to-r from-[#263245] to-[#1E2433] border-b border-[#455b7a]/50"></div>
            
            <div className="p-8 -mt-12">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl border-2 border-[#1E2433] bg-orange-500 text-white shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
              </div>

              <h1 className="text-3xl font-extrabold text-white tracking-tight break-words [overflow-wrap:anywhere]">{project.title}</h1>
              
              <div className="mt-8 border-t border-[#455b7a]/50 pt-8">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  Descripción técnica
                </h2>
                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-zinc-300 leading-relaxed">
                  {project.description}
                </p>
              </div>
            </div>
          </div>
          
          <VoteProjectForm
            projectId={project.id}
            competitionStatus={project.competition?.status || ""}
            isDisqualified={project.isDisqualified}
            projectAuthorId={project.authorId}
            metrics={project.competition?.metrics || []}
            existingVotes={project.votes?.filter((vote) => vote.voterId === user?.id) || []}
            onVoteSuccess={() => refetchProject()}
          />

        </div>

        <div className="flex flex-col gap-6 lg:col-span-1">
          
          <div className="rounded-xl border border-[#455b7a] bg-[#1E2433] p-6 shadow-lg">
            <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-zinc-400">
              Detalles de la Entrega
            </h3>

            <div className="space-y-6 text-sm">
              
              <div>
                <span className="block text-zinc-500 mb-1">Desarrollado por</span>
                <Link href={`/user/${project.authorId}`} className="group flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#263245] text-zinc-300 transition-colors group-hover:bg-orange-500/20 group-hover:text-orange-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <span className="font-semibold text-orange-400 transition-colors group-hover:text-orange-300">
                    @{project.author?.username || "Usuario Desconocido"}
                  </span>
                </Link>
              </div>

              <div className="border-t border-[#455b7a]/40 pt-4">
                <span className="block text-zinc-500 mb-1">Competencia</span>
                <Link href={`/reto/${project.competitionId}`} className="flex items-start gap-2 font-medium text-blue-400 hover:text-blue-300 transition-colors min-w-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                  <span className="leading-snug break-words">{project.competition?.title || "Reto"}</span>
                </Link>
              </div>

              <div className="border-t border-[#455b7a]/40 pt-4">
                <span className="block text-zinc-500 mb-1">Fecha de envío</span>
                <div className="flex items-center gap-2 font-medium text-zinc-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {submissionDate}
                </div>
              </div>

            </div>
          </div>

          <div className="rounded-xl border border-[#455b7a] bg-[#1E2433] p-6 shadow-lg">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-400">
              Entregables
            </h3>
            <div className="flex flex-col gap-3">
              {project.repoUrl && (
                <a 
                  href={project.repoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white transition-all hover:bg-orange-600 hover:shadow-md hover:shadow-orange-500/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-y-0.5"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                  Ver Repositorio
                </a>
              )}
              
              {project.fileUrl && (
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="group flex w-full items-center justify-center gap-2 rounded-lg border border-[#455b7a] bg-[#263245] px-6 py-3 font-semibold text-white transition-all hover:bg-[#2d3a50] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDownloading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Preparando descarga...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-y-0.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                      Descargar proyecto
                    </>
                  )}
                </button>
              )}

              {downloadError && (
                <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {downloadError}
                </p>
              )}

              {!project.repoUrl && !project.fileUrl && (
                <p className="text-center text-sm text-zinc-500 italic py-2">
                  No hay archivos adjuntos.
                </p>
              )}
            </div>
          </div>

          {canModerate && !project.isDisqualified && (
            <div className="rounded-xl border border-red-500/30 bg-[#1E2433] p-6 shadow-lg space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">
                Moderación del Proyecto
              </h3>
              {!isDisqualifying ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsDisqualifying(true);
                    setIsConfirmingDisqualification(false);
                    setDisqualifyError(null);
                    setDisqualifySuccess(null);
                  }}
                  className="w-full rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 active:scale-[0.98]"
                >
                  Descalificar Proyecto
                </button>
              ) : (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
                  onMouseDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      !disqualifyMutation.isPending
                    ) {
                      setIsDisqualifying(false);
                      setIsConfirmingDisqualification(false);
                      setDisqualifyReason("");
                      setDisqualifyError(null);
                    }
                  }}
                >
                  <section
                    aria-labelledby="disqualify-project-title"
                    aria-modal="true"
                    className="w-full max-w-lg space-y-4 rounded-2xl border border-red-500/30 bg-[#111A2E] p-6 shadow-2xl"
                    role="dialog"
                  >
                    <div>
                      <h4
                        id="disqualify-project-title"
                        className="text-lg font-bold text-white"
                      >
                        Descalificar proyecto
                      </h4>
                      <p className="mt-1 text-sm text-slate-300">
                        Escribe el motivo de la descalificación. El autor recibirá una notificación.
                      </p>
                    </div>
                    {isConfirmingDisqualification ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                          <p className="text-sm font-semibold text-red-200">
                            ¿Confirmas que quieres descalificar este proyecto?
                          </p>
                          <p className="mt-2 text-sm text-slate-300">
                            Esta acción no se puede deshacer. El motivo que se registrará es:
                          </p>
                          <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-md bg-black/20 p-3 text-sm text-white">
                            {disqualifyReason.trim()}
                          </p>
                        </div>
                        {disqualifyError && (
                          <p role="alert" className="text-sm font-medium text-red-300">
                            {disqualifyError}
                          </p>
                        )}
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            disabled={disqualifyMutation.isPending}
                            onClick={() => setIsConfirmingDisqualification(false)}
                            className="rounded-lg border border-[#34445F] px-4 py-2 text-sm text-slate-300 hover:bg-[#1A2640] disabled:opacity-50"
                          >
                            Volver
                          </button>
                          <button
                            type="button"
                            disabled={disqualifyMutation.isPending}
                            onClick={confirmDisqualification}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
                          >
                            {disqualifyMutation.isPending
                              ? "Procesando..."
                              : "Sí, descalificar"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <form className="space-y-4" onSubmit={handleDisqualify}>
                        <label className="block space-y-2 text-sm text-slate-300">
                          <span>Motivo de descalificación</span>
                          <textarea
                            autoFocus
                            required
                            minLength={5}
                            maxLength={1000}
                            rows={5}
                            value={disqualifyReason}
                            onChange={(event) => {
                              setDisqualifyReason(event.target.value);
                              if (disqualifyError) setDisqualifyError(null);
                            }}
                            placeholder="Describe por qué el proyecto incumple las reglas (mínimo 5 caracteres)."
                            className="w-full rounded-lg border border-[#34445F] bg-[#0A101D] p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-red-500"
                          />
                        </label>
                        {disqualifyError && (
                          <p role="alert" className="text-sm font-medium text-red-300">
                            {disqualifyError}
                          </p>
                        )}
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            disabled={disqualifyMutation.isPending}
                            onClick={() => {
                              setIsDisqualifying(false);
                              setDisqualifyReason("");
                              setDisqualifyError(null);
                              setIsConfirmingDisqualification(false);
                            }}
                            className="rounded-lg border border-[#34445F] px-4 py-2 text-sm text-slate-300 hover:bg-[#1A2640] disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={disqualifyMutation.isPending}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
                          >
                            Continuar
                          </button>
                        </div>
                      </form>
                    )}
                  </section>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </main>
  );
}

// 2. El export default ahora es solo un envolvedor que aplica el Suspense
export default function ProjectDetailPage() {
  return (
    <Suspense 
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-orange-500 border-t-transparent" />
            <p className="text-sm text-zinc-400">Preparando entorno...</p>
          </div>
        </main>
      }
    >
      <ProjectDetailContent />
    </Suspense>
  );
}