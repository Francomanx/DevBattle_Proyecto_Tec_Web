import { describe, expect, it, vi } from "vitest";

vi.mock("@devbattle/db", () => ({
  prisma: {},
  CompetitionStatus: {
    DRAFT: "DRAFT",
    ACTIVE: "ACTIVE",
    VOTING: "VOTING",
    COMPLETED: "COMPLETED",
  },
  NotificationType: {
    STATE_CHANGE: "STATE_CHANGE",
  },
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
import { competitionRouter } from "./competition";
import { createCallerFactory, type Context } from "../trpc";

describe("competitionRouter: Activación y Gestión de Moderadores", () => {
  const createCaller = createCallerFactory(competitionRouter);
  const now = Date.now();

  const validDraftComp = {
    id: "comp-draft-1",
    title: "Torneo Algorítmico Completo",
    description: "D".repeat(160),
    rules: "Reglas claras y estrictas para el torneo.",
    fileFormat: "zip, link",
    status: "DRAFT",
    submissionDeadline: new Date(now + 7 * 24 * 60 * 60 * 1000),
    votingDeadline: new Date(now + 14 * 24 * 60 * 60 * 1000),
    metrics: [
      { id: "m1", name: "Eficiencia", weight: 50, maxValue: 5 },
      { id: "m2", name: "Claridad", weight: 50, maxValue: 5 },
    ],
    participants: [
      { userId: "host-user-1", role: "HOST", user: { id: "host-user-1", username: "host_pro" } },
    ],
  };

  describe("Procedimiento: activate", () => {
    it("rechaza si el usuario no ha iniciado sesión", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.activate({ id: "comp-draft-1" })
      ).rejects.toThrowError(
        new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para activar la competencia.",
        })
      );
    });

    it("rechaza si el usuario no es el HOST de la competencia", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => validDraftComp,
          },
          user: {
            findFirst: async () => null,
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "not-the-host" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.activate({ id: "comp-draft-1" })
      ).rejects.toThrowError(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el host de la competencia puede activarla.",
        })
      );
    });

    it("rechaza la activación si la competencia ya se encuentra activa", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => ({
              ...validDraftComp,
              status: "ACTIVE",
            }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "host-user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.activate({ id: "comp-draft-1" })
      ).rejects.toThrowError(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "La competencia ya se encuentra activa.",
        })
      );
    });

    it("rechaza la activación si la descripción es menor a 150 caracteres", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => ({
              ...validDraftComp,
              description: "Descripción corta",
            }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "host-user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.activate({ id: "comp-draft-1" })
      ).rejects.toThrowError(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "No se puede activar la competencia: La descripción debe tener al menos 150 caracteres.",
        })
      );
    });

    it("activa exitosamente la competencia cambiando su estado a ACTIVE", async () => {
      let updatedStatus: string | null = null;

      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => validDraftComp,
            update: async ({ data }: { data: { status: string } }) => {
              updatedStatus = data.status;
              return { ...validDraftComp, status: data.status };
            },
          },
          competitionParticipant: {
            create: async () => ({}),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "host-user-1" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.activate({ id: "comp-draft-1" });

      expect(res.success).toBe(true);
      expect(updatedStatus).toBe("ACTIVE");
    });
  });

  describe("Procedimiento: inviteMod", () => {
    it("rechaza si el host intenta invitarse a sí mismo", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => validDraftComp,
          },
          user: {
            findFirst: async () => ({ id: "host-user-1", username: "host_pro" }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "host-user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.inviteMod({
          competitionId: "comp-draft-1",
          username: "host_pro",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "No puedes invitarte a ti mismo como moderador.",
        })
      );
    });

    it("rechaza si el usuario invitado ya participa con rol DEV", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => ({
              ...validDraftComp,
              participants: [
                ...validDraftComp.participants,
                { userId: "dev-contestant-id", role: "DEV", user: { id: "dev-contestant-id", username: "dev_contestant" } },
              ],
            }),
          },
          user: {
            findFirst: async () => ({ id: "dev-contestant-id", username: "dev_contestant" }),
          },
          project: {
            findFirst: async () => null,
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "host-user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.inviteMod({
          competitionId: "comp-draft-1",
          username: "dev_contestant",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "El usuario @dev_contestant ya participa como dev en esta competencia y no puede ser moderador.",
        })
      );
    });

    it("rechaza si el usuario ya tiene una invitación pendiente", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => validDraftComp,
          },
          user: {
            findFirst: async () => ({ id: "candidate-id", username: "candidate_user" }),
          },
          project: {
            findFirst: async () => null,
          },
          modInvitation: {
            findUnique: async () => ({ status: "PENDING" }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "host-user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.inviteMod({
          competitionId: "comp-draft-1",
          username: "candidate_user",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Ya existe una solicitud pendiente enviada a @candidate_user.",
        })
      );
    });

    it("crea exitosamente la invitación a moderador", async () => {
      let createdInvitation: unknown = null;
      let notificationCreated: unknown = null;

      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => validDraftComp,
          },
          user: {
            findFirst: async () => ({ id: "candidate-id", username: "candidate_user" }),
          },
          project: {
            findFirst: async () => null,
          },
          modInvitation: {
            findUnique: async () => null,
            upsert: async ({ create }: { create: unknown }) => {
              createdInvitation = create;
              return {
                id: "inv-created-1",
                create,
                invitedUser: { id: "candidate-id", username: "candidate_user" },
              };
            },
          },
          notification: {
            create: async ({ data }: { data: unknown }) => {
              notificationCreated = data;
              return data;
            },
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "host-user-1" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.inviteMod({
        competitionId: "comp-draft-1",
        username: "candidate_user",
      });

      expect(res.success).toBe(true);
      expect(createdInvitation).toEqual({
        competitionId: "comp-draft-1",
        inviterId: "host-user-1",
        invitedUserId: "candidate-id",
        status: "PENDING",
      });
      expect(notificationCreated).toBeDefined();
    });
  });

  describe("Procedimiento: removeModerator", () => {
    it("rechaza si el usuario objetivo no es un moderador activo", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => validDraftComp,
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "host-user-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.removeModerator({
          competitionId: "comp-draft-1",
          targetUserId: "host-user-1",
          reason: "Motivo cualquiera",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "El usuario especificado no es un moderador activo en esta competencia.",
        })
      );
    });

    it("destituye exitosamente a un MOD y emite notificación formal", async () => {
      let deletedParticipant = false;
      let deletedInvitations = false;
      let notificationCreated: unknown = null;

      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => ({
              ...validDraftComp,
              participants: [
                { userId: "host-user-1", role: "HOST", user: { id: "host-user-1", username: "host_pro" } },
                { userId: "mod-user-1", role: "MOD", user: { id: "mod-user-1", username: "mod_one" } },
              ],
            }),
          },
          competitionParticipant: {
            delete: async () => {
              deletedParticipant = true;
              return {};
            },
          },
          modInvitation: {
            deleteMany: async () => {
              deletedInvitations = true;
              return { count: 1 };
            },
          },
          notification: {
            create: async ({ data }: { data: unknown }) => {
              notificationCreated = data;
              return data;
            },
          },
          $transaction: async (ops: Promise<unknown>[]) => {
            return Promise.all(ops);
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "host-user-1" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.removeModerator({
        competitionId: "comp-draft-1",
        targetUserId: "mod-user-1",
        reason: "Falta de actividad y no responder a evaluaciones pendientes.",
      });

      expect(res.success).toBe(true);
      expect(res.destitutedUsername).toBe("mod_one");
      expect(deletedParticipant).toBe(true);
      expect(deletedInvitations).toBe(true);
      expect(notificationCreated).toBeDefined();
    });
  });
});
