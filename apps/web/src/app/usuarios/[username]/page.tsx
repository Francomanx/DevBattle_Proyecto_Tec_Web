//pagina de visualizacion de perfil de usuario
"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useTRPC } from "@/trpc/client";
//modal de edicion de perfil
import { ProfileEditModal } from "@/components/profile-edit-modal";

type ProfileTab = "host" | "mod" | "dev" | "projects" | "notifications";
//estilos para los diferentes estados de la competencia 
const statusStyles: Record<string, string> = {
  DRAFT: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  ACTIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  VOTING: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  COMPLETED: "border-purple-500/30 bg-purple-500/10 text-purple-300",
};

function getNotificationTypeBadge(type: string) {
  switch (type) {
    case "DISQUALIFICATION":
      return {
        label: "Descalificación",
        className: "bg-red-500/20 text-red-300 border-red-500/30",
      };
    case "MOD_REMOVAL":
      return {
        label: "Moderación",
        className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      };
    case "STATE_CHANGE":
      return {
        label: "Estado",
        className: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      };
    case "MESSAGE":
      return {
        label: "Mensaje",
        className: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      };
    default:
      return {
        label: "Aviso",
        className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
      };
  }
}

// funcion interna de la pagina de perfil
function UserProfileContent() {
  const params = useParams<{ username: string }>();
  const searchParams = useSearchParams();
  //router para redireccionar al usuario si cambia su nombre de usuario
  const router = useRouter();
  const username = params.username;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  //se obtiene el usuario actual y la funcion para actualizar el nombre de usuario
  const { user: currentUser, updateUserName } = useAuth();
  //estado para controlar la apertura del modal de edicion de perfil
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const tabParam = searchParams.get("tab") as ProfileTab | null;
  const [selectedTab, setSelectedTab] = useState<ProfileTab | null>(null);

  const activeTab: ProfileTab =
    selectedTab ??
    (tabParam && ["host", "mod", "dev", "projects", "notifications"].includes(tabParam)
      ? tabParam
      : "host");

  const setActiveTab = (tab: ProfileTab) => {
    setSelectedTab(tab);
  };

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [friendActionFeedback, setFriendActionFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const respondMutation = useMutation(trpc.competition.respondModInvitation.mutationOptions());
  const markAsReadMutation = useMutation(trpc.notification.markAsRead.mutationOptions());
  const deleteNotificationMutation = useMutation(trpc.notification.delete.mutationOptions());
  const sendFriendRequestMutation = useMutation(trpc.chat.sendFriendRequest.mutationOptions());

  const { data, isPending, error, refetch } = useQuery(
    trpc.profile.byUsername.queryOptions({
      username,
    })
  );
  //si la api esta cargando, se muestra un mensaje de carga
  if (isPending) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-400">
        Cargando perfil…
      </main>
    );
  }
  //si hay un error al cargar los datos del perfil, se muestra un mensaje de error
  if (error) {
    const notFound = error.data?.code === "NOT_FOUND";
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8">
          <h1 className="text-2xl font-bold text-white">
            {notFound ? "Usuario no encontrado" : "No se pudo cargar el perfil"}
          </h1>
          <p className="mt-2 text-sm text-red-200">
            {notFound
              ? "Comprueba que el nombre de usuario esté escrito correctamente."
              : error.message}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }
  //si no hay datos de perfil, no se muestra nada
  if (!data) return null;
  //en el caso de que se carguen los datos del perfil,
  //se muestra la informacion del usuario, incluyendo su nombre de usuario,
  //descripcion, enlaces a su perfil de GitHub, y estadisticas de su
  //actividad en la plataforma, como competencias hosteadas, competencias
  //realizadas como desarrollador y proyectos entregados. Tambien
  //se muestran pestañas para filtrar la actividad del usuario por tipo (host, dev, projects).
  const handleRespondInvitation = async (invitationId: string, accept: boolean) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await respondMutation.mutateAsync({
        invitationId,
        accept,
        userId: currentUser?.id,
      });
      setActionSuccess(res.message);
      await refetch();
    } catch (err: unknown) {
      console.error("Error al responder solicitud:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Ocurrió un error al responder la solicitud.";
      setActionError(message);
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentUser?.id) return;
    try {
      await markAsReadMutation.mutateAsync({
        all: true,
        userId: currentUser.id,
      });
      await Promise.all([refetch(), queryClient.invalidateQueries()]);
      setActionSuccess("Todas las notificaciones han sido marcadas como leídas.");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al marcar las notificaciones.";
      setActionError(message);
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    if (!currentUser?.id) return;
    try {
      await markAsReadMutation.mutateAsync({
        id,
        userId: currentUser.id,
      });
      await Promise.all([refetch(), queryClient.invalidateQueries()]);
    } catch (err) {
      console.error("Error al marcar como leída:", err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!currentUser?.id) return;
    try {
      await deleteNotificationMutation.mutateAsync({
        id,
        userId: currentUser.id,
      });
      await Promise.all([refetch(), queryClient.invalidateQueries()]);
      setActionSuccess("Notificación eliminada correctamente.");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al eliminar la notificación.";
      setActionError(message);
    }
  };
  //se determina si el perfil que se esta viendo es el del usuario
  //actual, para mostrar opciones de edicion y notificaciones
  const isOwnProfile = currentUser?.id === data.user.id;

  const pendingInvitations = isOwnProfile
    ? (data.receivedModInvitations ?? []).filter((inv) => inv.status === "PENDING")
    : [];

  const unreadNotifsCount = isOwnProfile
    ? (data.notifications ?? []).filter((n) => !n.isRead).length
    : 0;

  const totalUnreadBadge = unreadNotifsCount + pendingInvitations.length;

  const hasActivity =
    data.hostedCompetitions.length > 0 ||
    (data.modCompetitions?.length ?? 0) > 0 ||
    data.devCompetitions.length > 0 ||
    data.projects.length > 0 ||
    pendingInvitations.length > 0 ||
    (data.notifications?.length ?? 0) > 0;

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "host", label: "Como host" },
    { id: "mod", label: `Como mod (${data.stats.modCompetitions ?? 0})` },
    { id: "dev", label: "Como dev" },
    { id: "projects", label: "Proyectos" },
  ];

  if (isOwnProfile) {
    tabs.push({
      id: "notifications",
      label:
        totalUnreadBadge > 0
          ? `Notificaciones (${totalUnreadBadge})`
          : "Notificaciones",
    });
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6">
        <div
          aria-hidden="true"
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/10 text-3xl font-bold text-orange-300"
        >
          {data.user.username.slice(0, 1).toUpperCase()}
        </div>

        <h1 className="mt-4 text-center text-xl font-bold text-white">
          @{data.user.username}
        </h1>

        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">
          {data.user.description?.trim() || "Sin descripción"}
        </p>

        {data.user.githubUrl && (
          <a
            href={data.user.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block break-all text-sm text-orange-300 underline hover:text-orange-200"
          >
            Ver perfil de GitHub
          </a>
        )}

        {isOwnProfile && (
          //boton de edicion de perfil
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="mt-6 w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Editar perfil
          </button>
        )}

        {!isOwnProfile && currentUser && (
          <div className="mt-6 space-y-2">
            <button
              type="button"
              disabled={sendFriendRequestMutation.isPending}
              onClick={async () => {
                setFriendActionFeedback(null);
                try {
                  const res = await sendFriendRequestMutation.mutateAsync({
                    username: data.user.username,
                  });
                  setFriendActionFeedback({ type: "success", text: res.message });
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : "Error al enviar la solicitud.";
                  setFriendActionFeedback({ type: "error", text: msg });
                }
              }}
              className="w-full rounded-lg bg-[#FF6B00] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#E05E00] disabled:opacity-50"
            >
              {sendFriendRequestMutation.isPending ? "Enviando..." : "Enviar Solicitud de Amistad"}
            </button>
            {friendActionFeedback && (
              <div
                className={`rounded-lg border p-2 text-xs font-medium ${
                  friendActionFeedback.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/30 bg-red-500/10 text-red-300"
                }`}
              >
                {friendActionFeedback.text}
              </div>
            )}
          </div>
        )}
      </aside>

      <section className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Retos hosteados"
            value={data.stats.hostedCompetitions}
          />
          <StatCard
            label="Retos moderados"
            value={data.stats.modCompetitions ?? 0}
          />
          <StatCard
            label="Retos realizados como dev"
            value={data.stats.devCompetitions}
          />
        </div>

        {/* Pending Mod Invitations Card for profile owner */}
        {isOwnProfile && pendingInvitations.length > 0 && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 pb-3">
              <div>
                <h2 className="text-sm font-bold text-amber-200">
                  Solicitudes de Moderador Pendientes ({pendingInvitations.length})
                </h2>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Has recibido invitación para ser moderador en las siguientes competencias. Al aceptar la solicitud, obtendrás el rol de MOD en la competencia.
                </p>
              </div>
              <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                Requiere tu respuesta
              </span>
            </div>

            {actionSuccess && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/20 p-3 text-xs text-emerald-300 font-medium">
                {actionSuccess}
              </div>
            )}
            {actionError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/20 p-3 text-xs text-red-300 font-medium">
                {actionError}
              </div>
            )}

            <div className="space-y-3">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[#1E2D4A] bg-[#0A101D] p-4"
                >
                  <div className="space-y-1">
                    <Link
                      href={`/competitions/${inv.competition.id}`}
                      className="font-bold text-white hover:text-orange-400 text-sm transition"
                    >
                      {inv.competition.title}
                    </Link>
                    <p className="text-xs text-slate-400">
                      Invitado por:{" "}
                      <Link
                        href={`/usuarios/${encodeURIComponent(inv.inviter.username)}`}
                        className="font-semibold text-orange-400 hover:text-orange-300"
                      >
                        @{inv.inviter.username}
                      </Link>
                      {" · "}
                      <span>{new Date(inv.createdAt).toLocaleDateString("es-ES")}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRespondInvitation(inv.id, true)}
                      disabled={respondMutation.isPending}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 transition active:scale-[0.98] disabled:opacity-50"
                    >
                      Aceptar solicitud
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespondInvitation(inv.id, false)}
                      disabled={respondMutation.isPending}
                      className="rounded-lg border border-[#263652] bg-[#111A2E] hover:bg-red-500/20 hover:border-red-500/40 text-slate-300 hover:text-red-300 font-semibold text-xs px-3.5 py-2 transition active:scale-[0.98] disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {actionSuccess && !pendingInvitations.length && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/20 p-3 text-xs text-emerald-300 font-medium">
            {actionSuccess}
          </div>
        )}

        {actionError && !pendingInvitations.length && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/20 p-3 text-xs text-red-300 font-medium">
            {actionError}
          </div>
        )}

        <div className="rounded-xl border border-[#34445F] bg-[#111A2E] p-4 text-sm text-slate-400">
          Medallas: pendiente de definir cómo se obtienen y transfieren.
        </div>

        {!hasActivity ? (
          <div className="rounded-2xl border border-dashed border-[#34445F] p-10 text-center">
            <h2 className="font-semibold text-white">
              Aún no tiene actividad en la plataforma
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Cuando participe o cree competencias, aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#1E2D4A] bg-[#111A2E]">
            <div
              className="flex flex-wrap gap-2 border-b border-[#1E2D4A] p-3"
              role="tablist"
              aria-label="Actividad del usuario"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id
                      ? "bg-orange-500 text-white"
                      : "text-slate-400 hover:bg-[#1A2640] hover:text-white"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-3 p-4">
              {activeTab === "host" &&
                (data.hostedCompetitions.length ? (
                  data.hostedCompetitions.map((competition) => (
                    <CompetitionRow
                      key={competition.id}
                      id={competition.id}
                      title={competition.title}
                      status={competition.status}
                    />
                  ))
                ) : (
                  <EmptyTab message="No ha hosteado competencias todavía." />
                ))}

              {activeTab === "mod" &&
                ((data.modCompetitions?.length ?? 0) > 0 ? (
                  data.modCompetitions.map((competition) => (
                    <CompetitionRow
                      key={competition.id}
                      id={competition.id}
                      title={competition.title}
                      status={competition.status}
                    />
                  ))
                ) : (
                  <EmptyTab message="No moderas competencias todavía." />
                ))}

              {activeTab === "dev" &&
                (data.devCompetitions.length ? (
                  data.devCompetitions.map((competition) => (
                    <CompetitionRow
                      key={competition.id}
                      id={competition.id}
                      title={competition.title}
                      status={competition.status}
                    />
                  ))
                ) : (
                  <EmptyTab message="No ha participado como dev todavía." />
                ))}

              {activeTab === "projects" &&
                (data.projects.length ? (
                  data.projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/proyecto/${project.id}`}
                      className="block rounded-xl border border-[#263652] p-4 transition hover:border-orange-500/50 hover:bg-[#0D1527]"
                    >
                      <p className="font-semibold text-white">{project.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Competencia: {project.competitionTitle}
                      </p>
                      <p className="mt-2 text-xs text-orange-300">
                        Formato: {project.fileFormat || "No especificado"}
                      </p>
                    </Link>
                  ))
                ) : (
                  <EmptyTab message="No ha entregado proyectos todavía." />
                ))}

              {activeTab === "notifications" && (
                <div className="space-y-4">
                  {(!data.notifications || data.notifications.length === 0) &&
                  (!data.receivedModInvitations || data.receivedModInvitations.length === 0) ? (
                    <EmptyTab message="No tienes notificaciones registradas." />
                  ) : (
                    <div className="space-y-3">
                      {data.receivedModInvitations && data.receivedModInvitations.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-400">Historial de solicitudes de moderador:</p>
                          {data.receivedModInvitations.map((inv) => (
                            <div
                              key={inv.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#263652] bg-[#0A101D] p-3 text-xs"
                            >
                              <div className="space-y-0.5">
                                <p className="text-white font-medium">
                                  Invitación a moderar: <strong className="text-orange-400">{inv.competition.title}</strong>
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  Por @{inv.inviter.username} · {new Date(inv.createdAt).toLocaleDateString("es-ES")}
                                </p>
                              </div>
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  inv.status === "PENDING"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : inv.status === "ACCEPTED"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-red-500/20 text-red-300 border border-red-500/30"
                                }`}
                              >
                                {inv.status === "PENDING"
                                  ? "Pendiente"
                                  : inv.status === "ACCEPTED"
                                  ? "Aceptada"
                                  : "Rechazada"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {data.notifications && data.notifications.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-slate-400">Notificaciones del sistema:</p>
                              {unreadNotifsCount > 0 && (
                                <span className="rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                                  {unreadNotifsCount} no leída{unreadNotifsCount > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>

                            {isOwnProfile && unreadNotifsCount > 0 && (
                              <button
                                type="button"
                                onClick={handleMarkAllRead}
                                disabled={markAsReadMutation.isPending}
                                className="text-xs font-medium text-orange-400 hover:text-orange-300 transition disabled:opacity-50"
                              >
                                Marcar todas como leídas
                              </button>
                            )}
                          </div>

                          <div className="space-y-2">
                            {data.notifications.map((n) => (
                              <div
                                key={n.id}
                                className={`rounded-xl border p-3.5 text-xs flex items-center justify-between gap-3 transition ${
                                  !n.isRead
                                    ? "border-orange-500/40 bg-[#121D32] shadow-sm"
                                    : "border-[#263652] bg-[#0A101D]"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {!n.isRead ? (
                                    <span className="h-2 w-2 rounded-full bg-[#FF6B00] shrink-0" />
                                  ) : (
                                    <span className="h-2 w-2 rounded-full bg-slate-600 shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <p className={`${!n.isRead ? "text-white font-medium" : "text-slate-300"}`}>
                                      {n.content}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span
                                        className={`rounded border px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                          getNotificationTypeBadge(n.type).className
                                        }`}
                                      >
                                        {getNotificationTypeBadge(n.type).label}
                                      </span>
                                      <span className="text-slate-500 text-[10px]">
                                        {new Date(n.createdAt).toLocaleDateString("es-ES", {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {isOwnProfile && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    {!n.isRead && (
                                      <button
                                        type="button"
                                        onClick={() => handleMarkSingleRead(n.id)}
                                        title="Marcar como leída"
                                        className="rounded-lg p-1.5 text-slate-400 hover:text-orange-400 hover:bg-[#1A2740] transition"
                                      >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteNotification(n.id)}
                                      title="Eliminar notificación"
                                      className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-[#1A2740] transition"
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      {isOwnProfile && isEditModalOpen && (
        //modal de edicion de perfil
        <ProfileEditModal
          username={data.user.username}
          description={data.user.description}
          githubUrl={data.user.githubUrl}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={(updatedProfile) => {
            updateUserName(updatedProfile.username);
            void queryClient.invalidateQueries();
            if (updatedProfile.username !== username) {
              router.replace(
                `/usuarios/${encodeURIComponent(updatedProfile.username)}`
              );
            }
          }}
        />
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function CompetitionRow({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: string;
}) {
  return (
    <Link
      href={`/competitions/${id}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#263652] p-4 transition hover:border-orange-500/50 hover:bg-[#0D1527]"
    >
      <span className="font-semibold text-white">{title}</span>
      <span
        className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? "border-slate-600 text-slate-300"
          }`}
      >
        {status}
      </span>
    </Link>
  );
}

function EmptyTab({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{message}</p>;
}

export default function UserProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-400">
          Cargando perfil…
        </main>
      }
    >
      <UserProfileContent />
    </Suspense>
  );
}