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

import { TRPCError } from "@trpc/server";
import { notificationRouter } from "./notification";
import { createCallerFactory, type Context } from "../trpc";

describe("notificationRouter - Pruebas Exhaustivas", () => {
  const createCaller = createCallerFactory(notificationRouter);

  describe("Procedimiento: getUnreadCount", () => {
    it("retorna ceros si no se proporciona usuario ni hay sesión activa", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      const res = await caller.getUnreadCount();
      expect(res).toEqual({
        total: 0,
        unreadNotifications: 0,
        pendingInvitations: 0,
      });
    });

    it("calcula la suma correcta de notificaciones no leídas e invitaciones pendientes", async () => {
      const caller = createCaller({
        prisma: {
          notification: {
            count: async () => 4,
          },
          modInvitation: {
            count: async () => 2,
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.getUnreadCount();
      expect(res).toEqual({
        total: 6,
        unreadNotifications: 4,
        pendingInvitations: 2,
      });
    });
  });

  describe("Procedimiento: list", () => {
    it("aplica el filtro 'unread' trayendo solo notificaciones y no invitaciones", async () => {
      const mockNotifs = [
        { id: "n-1", content: "Notif 1", isRead: false },
        { id: "n-2", content: "Notif 2", isRead: false },
      ];

      const caller = createCaller({
        prisma: {
          notification: {
            findMany: async () => mockNotifs,
            count: async () => 2,
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.list({ filter: "unread" });
      expect(res.notifications).toHaveLength(2);
      expect(res.pendingInvitations).toHaveLength(0);
    });

    it("aplica el filtro 'invitations' trayendo solo solicitudes pendientes", async () => {
      const mockInvitations = [
        {
          id: "inv-1",
          status: "PENDING",
          competition: { id: "c-1", title: "Comp 1", status: "ACTIVE" },
          inviter: { id: "h-1", username: "host1" },
        },
      ];

      const caller = createCaller({
        prisma: {
          modInvitation: {
            findMany: async () => mockInvitations,
          },
          notification: {
            count: async () => 0,
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.list({ filter: "invitations" });
      expect(res.notifications).toHaveLength(0);
      expect(res.pendingInvitations).toHaveLength(1);
    });
  });

  describe("Procedimiento: markAsRead", () => {
    it("rechaza si el usuario no ha iniciado sesión", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.markAsRead({ id: "notif-1" })
      ).rejects.toThrowError(
        new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para marcar notificaciones como leídas.",
        })
      );
    });

    it("marca todas las notificaciones como leídas cuando all: true", async () => {
      let updatedData: unknown = null;

      const caller = createCaller({
        prisma: {
          notification: {
            updateMany: async ({ data }: { data: unknown }) => {
              updatedData = data;
              return { count: 5 };
            },
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.markAsRead({ all: true });
      expect(res.success).toBe(true);
      expect(res.markedCount).toBe(5);
      expect(updatedData).toEqual({ isRead: true });
    });

    it("lanza NOT_FOUND si la notificación individual no existe o pertenece a otro usuario", async () => {
      const caller = createCaller({
        prisma: {
          notification: {
            findFirst: async () => null,
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.markAsRead({ id: "other-user-notif" })
      ).rejects.toThrowError(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Notificación no encontrada.",
        })
      );
    });

    it("marca como leída una notificación individual válida", async () => {
      let updatedWhere: unknown = null;

      const caller = createCaller({
        prisma: {
          notification: {
            findFirst: async () => ({ id: "notif-own", userId: "user-1", isRead: false }),
            update: async ({ where }: { where: unknown }) => {
              updatedWhere = where;
              return { id: "notif-own", isRead: true };
            },
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.markAsRead({ id: "notif-own" });
      expect(res.success).toBe(true);
      expect(res.markedCount).toBe(1);
      expect(updatedWhere).toEqual({ id: "notif-own" });
    });
  });

  describe("Procedimiento: delete", () => {
    it("rechaza si el usuario no ha iniciado sesión", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(caller.delete({ id: "notif-1" })).rejects.toThrowError(
        new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para eliminar notificaciones.",
        })
      );
    });

    it("elimina la notificación si pertenece al usuario", async () => {
      let deletedId: unknown = null;

      const caller = createCaller({
        prisma: {
          notification: {
            findFirst: async () => ({ id: "notif-del", userId: "user-1" }),
            delete: async ({ where }: { where: { id: string } }) => {
              deletedId = where.id;
              return {};
            },
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.delete({ id: "notif-del" });
      expect(res.success).toBe(true);
      expect(deletedId).toBe("notif-del");
    });
  });
});
