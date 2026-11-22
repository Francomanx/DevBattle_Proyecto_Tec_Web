import { describe, expect, it, vi } from "vitest";

vi.mock("@devbattle/db", () => ({
  prisma: {},
  CompetitionStatus: {
    ACTIVE: "ACTIVE",
    VOTING: "VOTING",
    COMPLETED: "COMPLETED",
  },
  NotificationType: {
    STATE_CHANGE: "STATE_CHANGE",
  },
}));

import { updateCompetitionStatuses } from "./cron.service";
import type { PrismaClient } from "@devbattle/db";

describe("cron.service.updateCompetitionStatuses - Pruebas Exhaustivas", () => {
  it("retorna sin error si el objeto prisma no contiene las funciones requeridas", async () => {
    const invalidPrisma = {} as unknown as PrismaClient;
    await expect(updateCompetitionStatuses(invalidPrisma)).resolves.toBeUndefined();
  });

  it("transiciona competencias de ACTIVE a VOTING y genera notificaciones para jurados y concursantes", async () => {
    let updatedCompetitionIds: string[] = [];
    let updatedData: unknown = null;
    let createdNotifications: unknown[] = [];

    const mockActiveComps = [
      {
        id: "comp-active-1",
        title: "Torneo Web",
        participants: [
          { userId: "host-1", role: "HOST" },
          { userId: "mod-1", role: "MOD" },
          { userId: "dev-1", role: "DEV" },
        ],
        projects: [
          { authorId: "dev-1" },
          { authorId: "dev-2" }, // Autor que no estaba en participants
        ],
      },
    ];

    const mockPrisma = {
      competition: {
        findMany: async ({ where }: { where: { status: string } }) => {
          if (where.status === "ACTIVE") {
            return mockActiveComps;
          }
          return [];
        },
        updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: unknown }) => {
          updatedCompetitionIds = where.id.in;
          updatedData = data;
          return { count: where.id.in.length };
        },
      },
      notification: {
        createMany: async ({ data }: { data: unknown[] }) => {
          createdNotifications = data;
          return { count: data.length };
        },
      },
    };

    await updateCompetitionStatuses(mockPrisma as unknown as PrismaClient);

    expect(updatedCompetitionIds).toEqual(["comp-active-1"]);
    expect(updatedData).toEqual({ status: "VOTING" });

    // Notificaciones para jurados (host-1, mod-1) y concursantes (dev-1, dev-2)
    expect(createdNotifications).toHaveLength(4);
    const notifiedUserIds = (createdNotifications as Array<{ userId: string }>).map((n) => n.userId);
    expect(notifiedUserIds).toContain("host-1");
    expect(notifiedUserIds).toContain("mod-1");
    expect(notifiedUserIds).toContain("dev-1");
    expect(notifiedUserIds).toContain("dev-2");
  });

  it("transiciona competencias de VOTING a COMPLETED y genera notificaciones de ranking", async () => {
    let updatedCompetitionIds: string[] = [];
    let updatedData: unknown = null;
    let createdNotifications: unknown[] = [];

    const mockVotingComps = [
      {
        id: "comp-vote-1",
        title: "Torneo Finalizado",
        participants: [
          { userId: "host-1" },
          { userId: "dev-1" },
        ],
        projects: [
          { authorId: "dev-1" },
          { authorId: "dev-3" },
        ],
      },
    ];

    const mockPrisma = {
      competition: {
        findMany: async ({ where }: { where: { status: string } }) => {
          if (where.status === "VOTING") {
            return mockVotingComps;
          }
          return [];
        },
        updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: unknown }) => {
          updatedCompetitionIds = where.id.in;
          updatedData = data;
          return { count: where.id.in.length };
        },
      },
      notification: {
        createMany: async ({ data }: { data: unknown[] }) => {
          createdNotifications = data;
          return { count: data.length };
        },
      },
    };

    await updateCompetitionStatuses(mockPrisma as unknown as PrismaClient);

    expect(updatedCompetitionIds).toEqual(["comp-vote-1"]);
    expect(updatedData).toEqual({ status: "COMPLETED" });

    // Participantes y autores reciben notificación de finalización (host-1, dev-1, dev-3)
    expect(createdNotifications).toHaveLength(3);
    const notifiedUserIds = (createdNotifications as Array<{ userId: string }>).map((n) => n.userId);
    expect(notifiedUserIds).toContain("host-1");
    expect(notifiedUserIds).toContain("dev-1");
    expect(notifiedUserIds).toContain("dev-3");
  });

  it("no realiza ninguna modificación si no hay competencias con plazos expirados", async () => {
    let updateCalled = false;

    const mockPrisma = {
      competition: {
        findMany: async () => [],
        updateMany: async () => {
          updateCalled = true;
          return { count: 0 };
        },
      },
      notification: {
        createMany: async () => ({ count: 0 }),
      },
    };

    await updateCompetitionStatuses(mockPrisma as unknown as PrismaClient);

    expect(updateCalled).toBe(false);
  });
});
