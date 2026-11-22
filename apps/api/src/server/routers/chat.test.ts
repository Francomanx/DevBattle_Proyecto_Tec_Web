import { describe, expect, it, vi } from "vitest";

vi.mock("@devbattle/db", () => ({
  prisma: {},
}));

vi.mock("../../auth", () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
}));

vi.mock("../services/pusher.service", () => ({
  getChatChannelName: vi.fn((u1: string, u2: string) => `private-chat-${[u1, u2].sort().join("-")}`),
  getUserChannelName: vi.fn((userId: string) => `private-user-${userId}`),
  triggerPusherEvent: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/notification.service", () => ({
  upsertMessageNotification: vi.fn().mockResolvedValue({ id: "notif-id" }),
  markFriendMessageNotificationsAsRead: vi.fn().mockResolvedValue({ count: 1 }),
}));

import { TRPCError } from "@trpc/server";
import { chatRouter } from "./chat";
import { createCallerFactory, type Context } from "../trpc";
import { triggerPusherEvent } from "../services/pusher.service";
import { upsertMessageNotification, markFriendMessageNotificationsAsRead } from "../services/notification.service";

describe("chatRouter - Pruebas Exhaustivas", () => {
  const createCaller = createCallerFactory(chatRouter);

  describe("Procedimiento: sendFriendRequest", () => {
    it("rechaza si el usuario intenta enviarse una solicitud a sí mismo", async () => {
      const caller = createCaller({
        prisma: {
          user: {
            findUnique: async () => ({ id: "user-1", username: "user_one" }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1", name: "User One" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.sendFriendRequest({ username: "user_one" })
      ).rejects.toThrowError(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "No puedes enviarte una solicitud de amistad a ti mismo.",
        })
      );
    });

    it("rechaza si el usuario destinatario no existe", async () => {
      const caller = createCaller({
        prisma: {
          user: { findUnique: async () => null },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.sendFriendRequest({ username: "non_existent_target" })
      ).rejects.toThrowError(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario no encontrado.",
        })
      );
    });

    it("rechaza si ya son amigos actualmente", async () => {
      const caller = createCaller({
        prisma: {
          user: {
            findUnique: async () => ({ id: "user-2", username: "friend_two" }),
          },
          friendship: {
            findFirst: async () => ({ status: "ACCEPTED" }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.sendFriendRequest({ username: "friend_two" })
      ).rejects.toThrowError(
        new TRPCError({
          code: "CONFLICT",
          message: "Ya son amigos actualmente.",
        })
      );
    });

    it("crea exitosamente la solicitud de amistad pendiente y emite evento Pusher", async () => {
      let createdData: unknown = null;

      const caller = createCaller({
        prisma: {
          user: {
            findUnique: async () => ({ id: "user-2", username: "friend_two" }),
          },
          friendship: {
            findFirst: async () => null,
            create: async ({ data }: { data: unknown }) => {
              createdData = data;
              return data;
            },
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1", name: "User One" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.sendFriendRequest({ username: "friend_two" });

      expect(res.success).toBe(true);
      expect(createdData).toEqual({
        user1Id: "user-1",
        user2Id: "user-2",
        status: "PENDING",
      });
      expect(triggerPusherEvent).toHaveBeenCalledWith(
        "private-user-user-2",
        "friend-request-received",
        expect.objectContaining({
          fromId: "user-1",
          fromUsername: "User One",
        })
      );
    });
  });

  describe("Procedimiento: respondFriendRequest", () => {
    it("rechaza si la solicitud de amistad pendiente no existe", async () => {
      const caller = createCaller({
        prisma: {
          friendship: { findFirst: async () => null },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-receiver" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.respondFriendRequest({
          requesterId: "requester-user",
          action: "ACCEPT",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "NOT_FOUND",
          message: "No se encontro la solicitud de amistad pendiente.",
        })
      );
    });

    it("acepta la solicitud, actualiza el estado a ACCEPTED y notifica por Pusher", async () => {
      let updatedData: unknown = null;

      const caller = createCaller({
        prisma: {
          friendship: {
            findFirst: async () => ({
              id: "f-1",
              user1Id: "requester-user",
              user2Id: "user-receiver",
              status: "PENDING",
              user1: { id: "requester-user", username: "requester_nick" },
            }),
            update: async ({ data }: { data: unknown }) => {
              updatedData = data;
              return data;
            },
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-receiver", name: "Receiver User" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.respondFriendRequest({
        requesterId: "requester-user",
        action: "ACCEPT",
      });

      expect(res.success).toBe(true);
      expect(updatedData).toEqual({ status: "ACCEPTED" });
      expect(triggerPusherEvent).toHaveBeenCalledWith(
        "private-user-requester-user",
        "friend-request-accepted",
        expect.objectContaining({
          friendId: "user-receiver",
          friendUsername: "Receiver User",
        })
      );
    });

    it("rechaza la solicitud eliminando el registro de amistad", async () => {
      let deletedWhere: unknown = null;

      const caller = createCaller({
        prisma: {
          friendship: {
            findFirst: async () => ({
              id: "f-1",
              user1Id: "requester-user",
              user2Id: "user-receiver",
              status: "PENDING",
              user1: { id: "requester-user", username: "requester_nick" },
            }),
            delete: async ({ where }: { where: unknown }) => {
              deletedWhere = where;
              return {};
            },
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-receiver" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.respondFriendRequest({
        requesterId: "requester-user",
        action: "REJECT",
      });

      expect(res.success).toBe(true);
      expect(res.message).toBe("Solicitud de amistad rechazada.");
      expect(deletedWhere).toBeDefined();
    });
  });

  describe("Procedimiento: sendMessage & getMessages", () => {
    it("rechaza enviar un mensaje a un usuario si no son amigos", async () => {
      const caller = createCaller({
        prisma: {
          friendship: { findFirst: async () => null },
        } as unknown as Context["prisma"],
        session: { user: { id: "sender-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.sendMessage({
          receiverId: "stranger-1",
          content: "Hola desconocido",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Solo puedes enviar mensajes a usuarios que sean tus amigos.",
        })
      );
    });

    it("envía el mensaje, emite evento en canales de chat y actualiza notificación", async () => {
      const mockCreatedMessage = {
        id: "msg-123",
        senderId: "user-1",
        receiverId: "user-2",
        content: "Hola amigo!",
        createdAt: new Date(),
        sender: { id: "user-1", username: "alice" },
        receiver: { id: "user-2", username: "bob" },
      };

      const caller = createCaller({
        prisma: {
          friendship: { findFirst: async () => ({ status: "ACCEPTED" }) },
          message: {
            create: async () => mockCreatedMessage,
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1", name: "Alice" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.sendMessage({
        receiverId: "user-2",
        content: "Hola amigo!",
      });

      expect(res.id).toBe("msg-123");
      expect(triggerPusherEvent).toHaveBeenCalled();
      expect(upsertMessageNotification).toHaveBeenCalledWith({
        senderId: "user-1",
        senderUsername: "alice",
        receiverId: "user-2",
      });
    });

    it("obtiene los mensajes y marca como leídas las notificaciones del amigo", async () => {
      const mockMessages = [
        {
          id: "m-1",
          senderId: "user-1",
          receiverId: "user-2",
          content: "Primero",
          createdAt: new Date(),
          sender: { id: "user-1", username: "alice" },
          receiver: { id: "user-2", username: "bob" },
        },
      ];

      const caller = createCaller({
        prisma: {
          friendship: { findFirst: async () => ({ status: "ACCEPTED" }) },
          message: {
            findMany: async () => mockMessages,
          },
          user: {
            findUnique: async () => ({ username: "bob" }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.getMessages({ friendId: "user-2" });

      expect(res).toHaveLength(1);
      expect(res[0].content).toBe("Primero");
      expect(markFriendMessageNotificationsAsRead).toHaveBeenCalledWith("user-1", "bob");
    });
  });
});
