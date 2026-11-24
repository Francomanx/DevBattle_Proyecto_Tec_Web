"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, type UserSession } from "@/context/auth-context";
import { useTRPC } from "@/trpc/client";
import {
  getPusherClient,
  resetPusherClient,
  getChatChannelName,
  getUserChannelName,
} from "@/lib/pusher";

interface FriendItem {
  id: string;
  username: string;
  description: string | null;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string | Date;
  } | null;
}

interface ChatMessage {
  id: string;
  senderId: string;
  receiverId?: string | null;
  content: string;
  createdAt: string | Date;
  sender?: {
    id: string;
    username: string;
  };
}

function ChatWidgetContent({ user }: { user: UserSession }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"friends" | "manage">("friends");
  const [activeFriend, setActiveFriend] = useState<FriendItem | null>(null);

  const [searchFriend, setSearchFriend] = useState("");
  const [addUsernameInput, setAddUsernameInput] = useState("");
  const [addFeedback, setAddFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [inputMessage, setInputMessage] = useState("");
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Invalidate any residual queries from a previous user on mount
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: [["chat"]] });
  }, [queryClient, user.id]);

  // Queries scoped to active authenticated session
  const { data: friends = [], refetch: refetchFriends } = useQuery(
    trpc.chat.getFriends.queryOptions(undefined)
  );

  // Listener para abrir el chat directamente desde notificaciones u otros componentes
  useEffect(() => {
    const handleOpenChat = (e: CustomEvent<{ username?: string; friendId?: string }>) => {
      setIsOpen(true);
      if (e.detail?.friendId) {
        const found = friends.find((f) => f.id === e.detail.friendId);
        if (found) setActiveFriend(found);
      } else if (e.detail?.username) {
        const found = friends.find(
          (f) => f.username.toLowerCase() === e.detail.username?.toLowerCase()
        );
        if (found) setActiveFriend(found);
      }
    };

    window.addEventListener("open-chat", handleOpenChat as EventListener);
    return () => {
      window.removeEventListener("open-chat", handleOpenChat as EventListener);
    };
  }, [friends]);

  // Invalidate notifications when active friend is opened so the bell count updates immediately
  useEffect(() => {
    if (activeFriend) {
      void queryClient.invalidateQueries({ queryKey: [["notification"]] });
    }
  }, [activeFriend, queryClient]);

  const { data: requests = { incoming: [], outgoing: [] }, refetch: refetchRequests } = useQuery(
    trpc.chat.getFriendRequests.queryOptions(undefined)
  );

  const { data: initialMessages = [] } = useQuery(
    trpc.chat.getMessages.queryOptions(
      { friendId: activeFriend?.id ?? "" },
      {
        enabled: !!activeFriend,
      }
    )
  );

  // Reset realtime messages when active friend changes
  const currentFriendId = activeFriend?.id;
  const [prevFriendId, setPrevFriendId] = useState<string | undefined>(currentFriendId);
  if (currentFriendId !== prevFriendId) {
    setPrevFriendId(currentFriendId);
    setRealtimeMessages([]);
  }

  const messages = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const msg of initialMessages) {
      map.set(msg.id, msg);
    }
    for (const msg of realtimeMessages) {
      map.set(msg.id, msg);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [initialMessages, realtimeMessages]);

  // Mutations
  const sendFriendRequestMutation = useMutation(trpc.chat.sendFriendRequest.mutationOptions());
  const respondFriendRequestMutation = useMutation(trpc.chat.respondFriendRequest.mutationOptions());
  const sendMessageMutation = useMutation(trpc.chat.sendMessage.mutationOptions());

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Real-time listener: User notifications (Friend requests, new messages alerts)
  useEffect(() => {
    const pusher = getPusherClient(user.id);
    const userChannelName = getUserChannelName(user.id);
    const userChannel = pusher.subscribe(userChannelName);

    const handleNewNotification = () => {
      refetchFriends();
      refetchRequests();
    };

    userChannel.bind("new-message-notification", handleNewNotification);
    userChannel.bind("friend-request-received", handleNewNotification);
    userChannel.bind("friend-request-accepted", handleNewNotification);

    return () => {
      userChannel.unbind("new-message-notification", handleNewNotification);
      userChannel.unbind("friend-request-received", handleNewNotification);
      userChannel.unbind("friend-request-accepted", handleNewNotification);
      pusher.unsubscribe(userChannelName);
    };
  }, [user.id, refetchFriends, refetchRequests]);

  // Real-time listener: Active chat room
  useEffect(() => {
    if (!activeFriend?.id) return;

    const pusher = getPusherClient(user.id);
    const chatChannelName = getChatChannelName(user.id, activeFriend.id);
    const chatChannel = pusher.subscribe(chatChannelName);

    const handleIncomingMessage = (newMsg: ChatMessage) => {
      setRealtimeMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      refetchFriends();
    };

    chatChannel.bind("new-message", handleIncomingMessage);
    chatChannel.bind("message-persisted", handleIncomingMessage);

    return () => {
      chatChannel.unbind("new-message", handleIncomingMessage);
      chatChannel.unbind("message-persisted", handleIncomingMessage);
      pusher.unsubscribe(chatChannelName);
    };
  }, [user.id, activeFriend?.id, refetchFriends]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeFriend || sendMessageMutation.isPending) return;

    const content = inputMessage.trim();
    setInputMessage("");

    try {
      const sentMessage = await sendMessageMutation.mutateAsync({
        receiverId: activeFriend.id,
        content,
      });

      setRealtimeMessages((prev) => {
        if (prev.some((m) => m.id === sentMessage.id)) return prev;
        return [...prev, sentMessage];
      });

      // Trigger client event if connected
      const pusher = getPusherClient(user.id);
      const channelName = getChatChannelName(user.id, activeFriend.id);
      const channel = pusher.channel(channelName);
      if (channel) {
        channel.trigger("client-send-message", {
          content,
          receiverId: activeFriend.id,
          senderId: user.id,
        });
      }

      await queryClient.invalidateQueries({ queryKey: [["chat", "getFriends"]] });
    } catch (err: unknown) {
      console.error("Error al enviar mensaje:", err);
    }
  };

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsernameInput.trim() || sendFriendRequestMutation.isPending) return;

    setAddFeedback(null);
    try {
      const res = await sendFriendRequestMutation.mutateAsync({
        username: addUsernameInput.trim(),
      });
      setAddFeedback({ type: "success", text: res.message });
      setAddUsernameInput("");
      refetchRequests();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al enviar la solicitud.";
      setAddFeedback({ type: "error", text: message });
    }
  };

  const handleRespondRequest = async (requesterId: string, action: "ACCEPT" | "REJECT") => {
    try {
      await respondFriendRequestMutation.mutateAsync({
        requesterId,
        action,
      });
      refetchRequests();
      refetchFriends();
    } catch (err: unknown) {
      console.error("Error al responder solicitud:", err);
    }
  };

  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(searchFriend.toLowerCase())
  );

  const pendingIncomingCount = requests.incoming.length;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 rounded-full bg-[#FF6B00] px-4 py-3 text-sm font-bold text-white shadow-2xl transition hover:bg-[#E05E00] active:scale-95"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span>Amigos</span>
          {pendingIncomingCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#FF6B00]">
              {pendingIncomingCount}
            </span>
          )}
        </button>
      )}

      {/* Main Chat Drawer / Window */}
      {isOpen && (
        <div className="flex h-[520px] w-88 sm:w-96 flex-col overflow-hidden rounded-2xl border border-[#1E2D4A] bg-[#0E1626] shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1E2D4A] bg-[#111A2E] px-4 py-3 gap-2">
            {activeFriend ? (
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setActiveFriend(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-[#1A2640] hover:text-white shrink-0"
                  title="Volver a lista de amigos"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-white truncate">@{activeFriend.username}</span>
                  <span className="text-[11px] font-medium text-emerald-400">Activo</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Chats</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setActiveFriend(null);
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-[#1A2640] hover:text-white text-sm font-bold shrink-0"
              title="Cerrar mensajería"
            >
              x
            </button>
          </div>

          {/* Body */}
          {activeFriend ? (
            /* ACTIVE CHAT VIEW */
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Message History */}
              <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-slate-400">
                    <p>No hay mensajes previos. Inicia la conversación.</p>
                  </div>
                ) : (
                  messages.map((msg: ChatMessage) => {
                    const isMe = msg.senderId === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-white shadow-sm break-words [overflow-wrap:anywhere] ${isMe
                            ? "bg-[#FF6B00] text-white rounded-br-none"
                            : "bg-[#1A2640] text-slate-100 rounded-bl-none border border-[#23355A]"
                            }`}
                        >
                          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</p>
                        </div>
                        <span className="mt-1 px-1 text-[10px] text-slate-500">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={handleSendMessage} className="border-t border-[#1E2D4A] bg-[#111A2E] p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 rounded-xl border border-[#1E2D4A] bg-[#0A101D] px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#FF6B00]"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || sendMessageMutation.isPending}
                    className="rounded-xl bg-[#FF6B00] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#E05E00] disabled:opacity-50"
                  >
                    Enviar
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* FRIENDS & REQUESTS VIEW */
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Navigation Bar */}
              <div className="flex items-center justify-between border-b border-[#1E2D4A] bg-[#10182A] px-3 py-2 text-xs font-semibold">

                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === "manage" ? "friends" : "manage")}
                  className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${activeTab === "manage"
                    ? "bg-[#FF6B00] text-white"
                    : "bg-[#16223B] text-slate-300 hover:bg-[#1E2D4A] hover:text-white"
                    }`}
                  title="Agregar amigos y solicitudes pendientes"
                  aria-label="Agregar amigos y solicitudes pendientes"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  </svg>
                  <span>Agregar Amigos</span>

                  {pendingIncomingCount > 0 && (
                    <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
                      {pendingIncomingCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-3">
                {activeTab === "friends" && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={searchFriend}
                      onChange={(e) => setSearchFriend(e.target.value)}
                      placeholder="Buscar en amigos..."
                      className="w-full rounded-lg border border-[#1E2D4A] bg-[#0A101D] p-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#FF6B00]"
                    />

                    {filteredFriends.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        <p>No se encontraron amigos.</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Utiliza el botón con el símbolo de agregar amigos (+) para conectar con otros desarrolladores.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab("manage")}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#FF6B00]/10 px-3 py-1.5 text-xs font-semibold text-[#FF6B00] transition hover:bg-[#FF6B00]/20"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                          <span>Agregar amigos</span>
                        </button>
                      </div>
                    ) : (
                      filteredFriends.map((friend) => (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => setActiveFriend(friend)}
                          className="flex w-full items-center gap-3 rounded-xl border border-transparent p-2.5 text-left transition hover:border-[#1E2D4A] hover:bg-[#131E35]"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E2D4A] text-xs font-bold text-white">
                            {friend.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="truncate text-xs font-bold text-white">@{friend.username}</p>
                            <p className="truncate text-[11px] text-slate-400">
                              {friend.lastMessage?.content ?? "Sin mensajes aún. Haz clic para chatear."}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "manage" && (
                  <div className="space-y-4 p-1 text-xs">
                    {/* Formulario Agregar Usuario */}
                    <form
                      onSubmit={handleSendFriendRequest}
                      className="space-y-2.5 rounded-xl border border-[#1E2D4A] bg-[#111A2E] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#FF6B00]/10 text-[#FF6B00]">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                        </div>
                        <h4 className="font-bold text-white">Agregar Amigo</h4>
                      </div>

                      <p className="text-[11px] text-slate-400">
                        Ingresa el nombre de usuario exacto para enviar una solicitud de amistad:
                      </p>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={addUsernameInput}
                          onChange={(e) => setAddUsernameInput(e.target.value)}
                          placeholder="Nombre de usuario (ej. matias_dev)"
                          className="flex-1 rounded-xl border border-[#1E2D4A] bg-[#0A101D] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#FF6B00]"
                        />
                        <button
                          type="submit"
                          disabled={!addUsernameInput.trim() || sendFriendRequestMutation.isPending}
                          className="rounded-xl bg-[#FF6B00] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#E05E00] disabled:opacity-50"
                        >
                          {sendFriendRequestMutation.isPending ? "Enviando..." : "Enviar"}
                        </button>
                      </div>

                      {addFeedback && (
                        <div
                          className={`rounded-lg border p-2 text-[11px] break-words [overflow-wrap:anywhere] ${addFeedback.type === "success"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-red-500/30 bg-red-500/10 text-red-300"
                            }`}
                        >
                          {addFeedback.text}
                        </div>
                      )}
                    </form>

                    {/* Seccion de Solicitudes Pendientes */}
                    <div className="space-y-3">
                      {/* Solicitudes Recibidas */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="font-bold text-slate-300">Solicitudes Recibidas</h4>
                          {pendingIncomingCount > 0 && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              {pendingIncomingCount} pendiente{pendingIncomingCount > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {requests.incoming.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-[#1E2D4A] p-3 text-center text-[11px] text-slate-500">
                            No tienes solicitudes entrantes pendientes.
                          </p>
                        ) : (
                          requests.incoming.map((req) => (
                            <div
                              key={req.id}
                              className="mb-2 flex items-center justify-between rounded-xl border border-[#1E2D4A] bg-[#111A2E] p-2.5 gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E2D4A] text-[11px] font-bold text-white">
                                  {req.username.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="font-bold text-white truncate">@{req.username}</span>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleRespondRequest(req.id, "ACCEPT")}
                                  disabled={respondFriendRequestMutation.isPending}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  Aceptar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRespondRequest(req.id, "REJECT")}
                                  disabled={respondFriendRequestMutation.isPending}
                                  className="rounded-lg bg-[#1E2D4A] px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                                >
                                  Rechazar
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Solicitudes Enviadas */}
                      <div className="border-t border-[#1E2D4A] pt-3">
                        <h4 className="mb-2 font-bold text-slate-300">Solicitudes Enviadas</h4>
                        {requests.outgoing.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-[#1E2D4A] p-3 text-center text-[11px] text-slate-500">
                            No tienes solicitudes salientes pendientes.
                          </p>
                        ) : (
                          requests.outgoing.map((req) => (
                            <div
                              key={req.id}
                              className="mb-2 flex items-center justify-between rounded-xl border border-[#1E2D4A] bg-[#111A2E] p-2.5 text-slate-300 gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E2D4A] text-[11px] font-bold text-white">
                                  {req.username.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="truncate">@{req.username}</span>
                              </div>
                              <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                                Pendiente
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatWidget() {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      resetPusherClient();
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated || !user) {
    return null;
  }

  return <ChatWidgetContent key={user.id} user={user} />;
}
