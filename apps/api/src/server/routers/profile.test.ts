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
}));

vi.mock("../password-change", () => ({
  createPasswordChangeCode: vi.fn().mockReturnValue({ code: "123456", codeHash: "mocked_hash" }),
  passwordChangeCodeMatches: vi.fn().mockReturnValue(true),
  sendPasswordChangeCodeEmail: vi.fn().mockResolvedValue(undefined),
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

  describe("Procedimientos: requestPasswordChangeCode & changePassword", () => {
    it("rechaza solicitud de código si las contraseñas no coinciden", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: { user: { id: "user-1", email: "user@example.com" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.requestPasswordChangeCode({
          newPassword: "password1234",
          confirmPassword: "passwordDifferent",
        })
      ).rejects.toThrow();
    });

    it("lanza PRECONDITION_FAILED si no están configuradas las variables de correo", async () => {
      const originalApiKey = process.env.RESEND_API_KEY;
      const originalFromEmail = process.env.RESEND_FROM_EMAIL;
      delete process.env.RESEND_API_KEY;
      delete process.env.RESEND_FROM_EMAIL;

      const caller = createCaller({
        prisma: {
          user: {
            findUnique: async () => ({ id: "user-1", email: "user@example.com" }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1", email: "user@example.com" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.requestPasswordChangeCode({
          newPassword: "newSecurePassword123",
          confirmPassword: "newSecurePassword123",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "El envío de correo no está configurado en el servidor.",
        })
      );

      process.env.RESEND_API_KEY = originalApiKey;
      process.env.RESEND_FROM_EMAIL = originalFromEmail;
    });

    it("procesa la solicitud de código cuando el servidor está configurado", async () => {
      process.env.RESEND_API_KEY = "mock_key";
      process.env.RESEND_FROM_EMAIL = "noreply@devbattle.com";

      const caller = createCaller({
        prisma: {
          user: {
            findUnique: async () => ({ id: "user-1", email: "user@example.com" }),
          },
          passwordChangeCode: {
            findFirst: async () => null,
            updateMany: async () => ({ count: 1 }),
            create: async () => ({ id: "code-rec-1" }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1", email: "user@example.com" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.requestPasswordChangeCode({
        newPassword: "newSecurePassword123",
        confirmPassword: "newSecurePassword123",
      });

      expect(res.success).toBe(true);
      expect(res.expiresInSeconds).toBe(600);
    });

    it("rechaza changePassword si el código es inválido o no existe", async () => {
      const caller = createCaller({
        prisma: {
          passwordChangeCode: {
            findFirst: async () => null,
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.changePassword({
          code: "999999",
          newPassword: "securePassword123",
          confirmPassword: "securePassword123",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "El código es inválido o expiró. Solicita uno nuevo.",
        })
      );
    });
  });
});
