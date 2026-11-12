"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useTRPC } from "@/trpc/client";
import { getPusherClient, getUserChannelName } from "@/lib/pusher";

type NotificationFilter = "all" | "invitations" | "unread";

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

export function NotificationsDropdown() {
  const { user, isAuthenticated } = useAuth();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Consulta ligera de contador no leído (polling o refetch rápido)
  const { data: countData, refetch: refetchCount } = useQuery({
    ...trpc.notification.getUnreadCount.queryOptions({
      userId: user?.id,
    }),
    enabled: isAuthenticated && Boolean(user?.id),
    refetchInterval: 30000,
  });

  // Consulta de la lista completa cuando el dropdown está abierto
  const {
    data: listData,
    isLoading: isLoadingList,
    refetch: refetchList,
  } = useQuery({
    ...trpc.notification.list.queryOptions({
      userId: user?.id,
      limit: 25,
      filter,
    }),
    enabled: isAuthenticated && Boolean(user?.id) && isOpen,
  });

  const markAsReadMutation = useMutation(trpc.notification.markAsRead.mutationOptions());
  const deleteNotificationMutation = useMutation(trpc.notification.delete.mutationOptions());
  const respondModMutation = useMutation(trpc.competition.respondModInvitation.mutationOptions());

  // Cerrar al hacer click fuera o presionar escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Escuchar notificaciones en tiempo real vía Pusher
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const pusher = getPusherClient(user.id);
    const channelName = getUserChannelName(user.id);
    const channel = pusher.subscribe(channelName);

    const handleUpdate = () => {
      void refetchCount();
      if (isOpen) {
        void refetchList();
      }
    };

    channel.bind("notification-received", handleUpdate);
    channel.bind("new-message-notification", handleUpdate);
    channel.bind("friend-request-received", handleUpdate);
    channel.bind("friend-request-accepted", handleUpdate);

    return () => {
      channel.unbind("notification-received", handleUpdate);
      channel.unbind("new-message-notification", handleUpdate);
      channel.unbind("friend-request-received", handleUpdate);
      channel.unbind("friend-request-accepted", handleUpdate);
      pusher.unsubscribe(channelName);
    };
  }, [isAuthenticated, user?.id, isOpen, refetchCount, refetchList]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const unreadTotal = countData?.total ?? 0;
  const pendingCount = countData?.pendingInvitations ?? 0;
  const unreadNotifCount = countData?.unreadNotifications ?? 0;

  const handleMarkAllRead = async () => {
    try {
      await markAsReadMutation.mutateAsync({
        all: true,
        userId: user.id,
      });
      await Promise.all([refetchCount(), refetchList()]);
      setFeedback({ type: "success", text: "Todas las notificaciones marcadas como leídas." });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({ type: "error", text: "Error al marcar las notificaciones." });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      await markAsReadMutation.mutateAsync({
        id,
        userId: user.id,
      });
      await Promise.all([refetchCount(), refetchList()]);
    } catch (err) {
      console.error("Error al marcar como leída:", err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotificationMutation.mutateAsync({
        id,
        userId: user.id,
      });
      await Promise.all([refetchCount(), refetchList()]);
    } catch (err) {
      console.error("Error al eliminar notificación:", err);
    }
  };

  const handleRespondInvitation = async (invitationId: string, accept: boolean) => {
    setRespondingId(invitationId);
    setFeedback(null);
    try {
      const res = await respondModMutation.mutateAsync({
        invitationId,
        accept,
        userId: user.id,
      });
      setFeedback({ type: "success", text: res.message });
      await Promise.all([
        refetchCount(),
        refetchList(),
        queryClient.invalidateQueries(),
      ]);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar la solicitud.";
      setFeedback({ type: "error", text: msg });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setRespondingId(null);
    }
  };

  const pendingInvitations = listData?.pendingInvitations ?? [];
  const notifications = listData?.notifications ?? [];
  const hasItems = pendingInvitations.length > 0 || notifications.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón Campana */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notificaciones"
        aria-expanded={isOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#23355A] bg-[#131E35] text-slate-300 transition hover:bg-[#1A2A4A] hover:text-white focus:outline-none"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF6B00] px-1 text-[10px] font-bold text-white shadow">
            {unreadTotal > 9 ? "9+" : unreadTotal}
          </span>
        )}
      </button>

      {/* Menú Desplegable */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#1E2D4A] bg-[#0E1626] shadow-2xl z-50 overflow-hidden flex flex-col max-h-[520px]">
          {/* Cabecera */}
          <div className="flex items-center justify-between border-b border-[#1A2640] bg-[#0B111E] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Notificaciones</span>
              {unreadTotal > 0 && (
                <span className="rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                  {unreadTotal} nueva{unreadTotal > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {unreadNotifCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markAsReadMutation.isPending}
                className="text-[11px] font-medium text-orange-400 hover:text-orange-300 transition disabled:opacity-50"
              >
                Marcar leídas
              </button>
            )}
          </div>

          {/* Filtros */}
          <div className="flex items-center border-b border-[#1A2640] bg-[#0B111E]/70 px-2 py-1 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`flex-1 rounded-lg py-1.5 text-center font-medium transition ${
                filter === "all"
                  ? "bg-[#18253D] text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilter("invitations")}
              className={`flex-1 rounded-lg py-1.5 text-center font-medium transition flex items-center justify-center gap-1.5 ${
                filter === "invitations"
                  ? "bg-[#18253D] text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Solicitudes</span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-300">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`flex-1 rounded-lg py-1.5 text-center font-medium transition flex items-center justify-center gap-1.5 ${
                filter === "unread"
                  ? "bg-[#18253D] text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>No leídas</span>
              {unreadNotifCount > 0 && (
                <span className="rounded-full bg-orange-500/20 px-1.5 py-0.2 text-[10px] font-bold text-orange-300">
                  {unreadNotifCount}
                </span>
              )}
            </button>
          </div>

          {/* Feedback mensaje temporal */}
          {feedback && (
            <div
              className={`px-3 py-2 text-xs font-medium border-b ${
                feedback.type === "success"
                  ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/20 border-red-500/30 text-red-300"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Cuerpo con Scroll */}
          <div className="overflow-y-auto divide-y divide-[#16233B]">
            {isLoadingList ? (
              <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                <span>Cargando notificaciones…</span>
              </div>
            ) : !hasItems ? (
              <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <svg
                  className="h-8 w-8 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>No tienes notificaciones pendientes.</span>
              </div>
            ) : (
              <>
                {/* Solicitudes de Moderador Pendientes */}
                {pendingInvitations.map((inv) => {
                  const isResponding = respondingId === inv.id;
                  return (
                    <div
                      key={inv.id}
                      className="p-3.5 bg-[#121B2F]/80 hover:bg-[#152037] transition border-l-2 border-amber-500"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="inline-block rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30 mb-1">
                            Invitación de Moderador
                          </span>
                          <Link
                            href={`/competitions/${inv.competition.id}`}
                            onClick={() => setIsOpen(false)}
                            className="block font-semibold text-white hover:text-orange-400 text-xs transition truncate"
                          >
                            {inv.competition.title}
                          </Link>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Por <strong className="text-slate-300">@{inv.inviter.username}</strong>
                            {" · "}
                            {new Date(inv.createdAt).toLocaleDateString("es-ES")}
                          </p>
                        </div>
                      </div>

                      {/* Botones de acción directa */}
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRespondInvitation(inv.id, true)}
                          disabled={isResponding}
                          className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] py-1.5 transition active:scale-[0.98] disabled:opacity-50 text-center"
                        >
                          {isResponding ? "Procesando…" : "Aceptar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondInvitation(inv.id, false)}
                          disabled={isResponding}
                          className="flex-1 rounded-lg border border-[#263652] bg-[#0B111E] hover:bg-red-500/20 hover:border-red-500/40 text-slate-300 hover:text-red-300 font-semibold text-[11px] py-1.5 transition active:scale-[0.98] disabled:opacity-50 text-center"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Notificaciones del Sistema */}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 transition flex items-start gap-3 ${
                      !n.isRead
                        ? "bg-[#111C30] border-l-2 border-orange-500 hover:bg-[#14223A]"
                        : "bg-transparent hover:bg-[#101726]"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {!n.isRead ? (
                        <div className="h-2 w-2 rounded-full bg-[#FF6B00] shadow-sm" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-slate-600" />
                      )}
                    </div>

                    <div
                      className={`flex-1 min-w-0 ${n.type === "MESSAGE" ? "cursor-pointer" : ""}`}
                      onClick={() => {
                        if (n.type === "MESSAGE") {
                          const match = n.content.match(/@([a-zA-Z0-9_-]+)/);
                          if (match) {
                            window.dispatchEvent(
                              new CustomEvent("open-chat", { detail: { username: match[1] } })
                            );
                            setIsOpen(false);
                            if (!n.isRead) {
                              void handleMarkSingleRead(n.id);
                            }
                          }
                        }
                      }}
                    >
                      <p className={`text-xs leading-relaxed ${!n.isRead ? "text-white font-medium" : "text-slate-300"}`}>
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
                        {n.type === "MESSAGE" && (
                          <span className="text-[10px] text-orange-400 font-semibold hover:underline">
                            Abrir chat
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          {new Date(n.createdAt).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkSingleRead(n.id)}
                          title="Marcar como leída"
                          className="rounded p-1 text-slate-400 hover:text-orange-400 hover:bg-[#1A2740] transition"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteNotification(n.id)}
                        title="Eliminar notificación"
                        className="rounded p-1 text-slate-500 hover:text-red-400 hover:bg-[#1A2740] transition"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Pie de Menú */}
          <div className="border-t border-[#1A2640] bg-[#0B111E] px-4 py-2.5 text-center">
            <Link
              href={`/usuarios/${encodeURIComponent(user.username)}?tab=notifications`}
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition flex items-center justify-center gap-1.5"
            >
              <span>Ver todas en mi perfil</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
