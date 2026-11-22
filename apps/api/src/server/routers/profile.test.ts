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

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("mocked_hashed_password"),
  compare: vi.fn().mockImplementation(async (plain: string) => plain === "correctOldPassword"),
}));

import { TRPCError } from "@trpc/server";
import { profileRouter } from "./profile";
import { createCallerFactory, type Context } from "../trpc";

describe("profileRouter - Pruebas Exhaustivas", () => {
  const createCaller = createCallerFactory(profileRouter);

  describe("Procedimiento: byUsername", () => {
    const mockUserDb = {
      id: "user-target-id",
      username: "developer_target",
      description: "Desarrollador apasionado",
      githubUrl: "https://github.com/developer_target",
      competitionParticipants: [
        {
          role: "HOST",
          competition: { id: "comp-host-1", title: "Torneo Host 1", status: "ACTIVE" },
        },
        {
          role: "HOST",
          competition: { id: "comp-host-draft", title: "Torneo Host Borrador", status: "DRAFT" },
        },
        {
          role: "DEV",
          competition: { id: "comp-dev-1", title: "Torneo Dev 1", status: "COMPLETED" },
        },
        {
          role: "MOD",
          competition: { id: "comp-mod-1", title: "Torneo Mod 1", status: "VOTING" },
        },
      ],
      projects: [
        {
          id: "proj-1",
          title: "Mi Proyecto",
          competitionId: "comp-dev-1",
          competition: { title: "Torneo Dev 1", fileFormat: "link" },
        },
      ],
    };

    it("lanza NOT_FOUND si el usuario no existe", async () => {
      const caller = createCaller({
        prisma: {
          user: { findUnique: async () => null },
        } as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.byUsername({ username: "non_existent_user" })
      ).rejects.toThrowError(
        new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" })
      );
    });

    it("oculta las competencias en estado DRAFT a visitantes externos", async () => {
      const caller = createCaller({
        prisma: {
          user: { findUnique: async () => mockUserDb },
        } as unknown as Context["prisma"],
        session: { user: { id: "visitor-user-id" }, expires: "" }, // No es el dueño
        headers: new Headers(),
      });

      const res = await caller.byUsername({ username: "developer_target" });

      expect(res.user.username).toBe("developer_target");
      expect(res.stats.hostedCompetitions).toBe(1);
      expect(res.hostedCompetitions.some((c) => c.status === "DRAFT")).toBe(false);
      expect(res.hostedCompetitions).toHaveLength(1);
      expect(res.hostedCompetitions[0].id).toBe("comp-host-1");
      expect(res.receivedModInvitations).toHaveLength(0);
      expect(res.notifications).toHaveLength(0);
    });

    it("expone las competencias en DRAFT, notificaciones e invitaciones al propio dueño", async () => {
      const mockInvitations = [
        {
          id: "inv-1",
          competitionId: "comp-99",
          competition: { id: "comp-99", title: "Torneo 99", status: "ACTIVE" },
          inviter: { id: "inviter-id", username: "host_pro" },
        },
      ];
      const mockNotifications = [
        {
          id: "notif-1",
          content: "Has recibido una notificación",
          isRead: false,
        },
      ];

      const caller = createCaller({
        prisma: {
          user: { findUnique: async () => mockUserDb },
          modInvitation: { findMany: async () => mockInvitations },
          notification: { findMany: async () => mockNotifications },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-target-id" }, expires: "" }, // Mismo ID que mockUserDb.id
        headers: new Headers(),
      });

      const res = await caller.byUsername({ username: "developer_target" });

      expect(res.stats.hostedCompetitions).toBe(2);
      expect(res.hostedCompetitions.some((c) => c.status === "DRAFT")).toBe(true);
      expect(res.hostedCompetitions).toHaveLength(2);
      expect(res.receivedModInvitations).toHaveLength(1);
      expect(res.notifications).toHaveLength(1);
    });
  });

  describe("Procedimiento: updateProfile", () => {
    it("rechaza si el usuario no ha iniciado sesión", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.updateProfile({
          username: "validusername",
          description: "Nueva descripción",
          githubUrl: "https://github.com/validuser",
        })
      ).rejects.toThrow();
    });

    it("rechaza si el nombre de usuario ya está en uso por otro usuario", async () => {
      const caller = createCaller({
        prisma: {
          user: {
            findFirst: async () => ({ id: "other-user-id" }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.updateProfile({
          username: "taken_username",
          description: "Descripción",
          githubUrl: "https://github.com/validuser",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "CONFLICT",
          message: "Ese nombre de usuario ya está en uso.",
        })
      );
    });

    it("rechaza si la URL de GitHub no corresponde a un enlace válido de github.com", async () => {
      const caller = createCaller({
        prisma: {
          user: { findFirst: async () => null },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.updateProfile({
          username: "validuser",
          description: "Descripción",
          githubUrl: "https://gitlab.com/attacker",
        })
      ).rejects.toThrow();
    });

    it("permite actualizar el perfil propio exitosamente", async () => {
      let updatedData: unknown = null;

      const caller = createCaller({
        prisma: {
          user: {
            findFirst: async () => null,
            update: async ({ data }: { data: unknown }) => {
              updatedData = data;
              return {
                id: "user-1",
                username: "owner_dev",
                description: "Nueva descripción profesional",
                githubUrl: "https://github.com/owner_dev",
              };
            },
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.updateProfile({
        username: "owner_dev",
        description: "Nueva descripción profesional",
        githubUrl: "https://github.com/owner_dev",
      });

      expect(res.id).toBe("user-1");
      expect(res.username).toBe("owner_dev");
      expect(updatedData).toEqual({
        username: "owner_dev",
        description: "Nueva descripción profesional",
        githubUrl: "https://github.com/owner_dev",
      });
    });
  });

  describe("Procedimiento: changePassword", () => {
    it("rechaza si las contraseñas nuevas no coinciden", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.changePassword({
          currentPassword: "correctOldPassword",
          newPassword: "newSecurePassword1",
          confirmPassword: "newSecurePassword2",
        })
      ).rejects.toThrowError();
    });

    it("rechaza si la contraseña actual es incorrecta", async () => {
      const caller = createCaller({
        prisma: {
          user: {
            findUnique: async () => ({ passwordHash: "mocked_hashed_password" }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.changePassword({
          currentPassword: "wrongOldPassword",
          newPassword: "newSecurePassword1",
          confirmPassword: "newSecurePassword1",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "La contraseña actual es incorrecta.",
        })
      );
    });

    it("actualiza la contraseña exitosamente con transacción y notificación", async () => {
      let updatedData: unknown = null;
      let createdNotification: unknown = null;

      const caller = createCaller({
        prisma: {
          user: {
            findUnique: async () => ({ passwordHash: "mocked_hashed_password" }),
          },
          $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
            return cb({
              user: {
                update: async ({ data }: { data: unknown }) => {
                  updatedData = data;
                  return data;
                },
              },
              notification: {
                create: async ({ data }: { data: unknown }) => {
                  createdNotification = data;
                  return data;
                },
              },
            });
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.changePassword({
        currentPassword: "correctOldPassword",
        newPassword: "newSecurePassword1",
        confirmPassword: "newSecurePassword1",
      });

      expect(res.success).toBe(true);
      expect(updatedData).toEqual({ passwordHash: "mocked_hashed_password" });
      expect(createdNotification).toBeDefined();
    });
  });

  describe("Procedimiento: searchUsers", () => {
    it("retorna usuarios cuando el término de búsqueda coincide", async () => {
      const caller = createCaller({
        prisma: {
          user: {
            findMany: async () => [
              { id: "u1", username: "developer_pro", description: "Backend dev" },
            ],
          },
        } as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      const users = await caller.searchUsers({ query: "developer" });
      expect(users).toHaveLength(1);
      expect(users[0]?.username).toBe("developer_pro");
    });

    it("retorna arreglo vacío si el término de búsqueda está vacío", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      const users = await caller.searchUsers({ query: "   " });
      expect(users).toEqual([]);
    });
  });
});
