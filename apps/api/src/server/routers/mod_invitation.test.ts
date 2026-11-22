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
import { competitionRouter } from "./competition";
import { createCallerFactory, type Context } from "../trpc";

describe("competitionRouter.respondModInvitation", () => {
  const createCaller = createCallerFactory(competitionRouter);

  const mockInvitation = {
    id: "inv-1",
    competitionId: "comp-1",
    inviterId: "host-1",
    invitedUserId: "user-dev-1",
    status: "PENDING" as const,
    competition: {
      id: "comp-1",
      title: "Competencia de Prueba",
    },
    invitedUser: {
      id: "user-dev-1",
      username: "user_dev",
    },
    inviter: {
      id: "host-1",
      username: "host_user",
    },
  };

  it("rechaza la aceptacion si el usuario invitado ya es participante con rol DEV", async () => {
    const mockPrisma = {
      modInvitation: {
        findUnique: async () => mockInvitation,
      },
      competitionParticipant: {
        findFirst: async ({ where }: { where: { role?: string } }) => {
          if (where.role === "DEV") {
            return { userId: "user-dev-1", competitionId: "comp-1", role: "DEV" };
          }
          return null;
        },
      },
      project: {
        findFirst: async () => null,
      },
    };

    const caller = createCaller({
      prisma: mockPrisma as unknown as Context["prisma"],
      session: {
        user: { id: "user-dev-1" },
        expires: "",
      },
      headers: new Headers(),
    });

    await expect(
      caller.respondModInvitation({
        invitationId: "inv-1",
        accept: true,
      })
    ).rejects.toThrowError(
      new TRPCError({
        code: "BAD_REQUEST",
        message: "Un usuario con estado dev no puede ser moderador de la misma competencia.",
      })
    );
  });

  it("rechaza la aceptacion si el usuario invitado ha postulado un proyecto", async () => {
    const mockPrisma = {
      modInvitation: {
        findUnique: async () => mockInvitation,
      },
      competitionParticipant: {
        findFirst: async () => null,
      },
      project: {
        findFirst: async () => ({
          id: "proj-1",
          authorId: "user-dev-1",
          competitionId: "comp-1",
        }),
      },
    };

    const caller = createCaller({
      prisma: mockPrisma as unknown as Context["prisma"],
      session: {
        user: { id: "user-dev-1" },
        expires: "",
      },
      headers: new Headers(),
    });

    await expect(
      caller.respondModInvitation({
        invitationId: "inv-1",
        accept: true,
      })
    ).rejects.toThrowError(
      new TRPCError({
        code: "BAD_REQUEST",
        message: "Un usuario con estado dev no puede ser moderador de la misma competencia.",
      })
    );
  });

  it("rechaza la aceptacion si el usuario es host de la competencia", async () => {
    const mockPrisma = {
      modInvitation: {
        findUnique: async () => mockInvitation,
      },
      competitionParticipant: {
        findFirst: async ({ where }: { where: { role?: string } }) => {
          if (where.role === "HOST") {
            return { userId: "user-dev-1", competitionId: "comp-1", role: "HOST" };
          }
          return null;
        },
      },
      project: {
        findFirst: async () => null,
      },
    };

    const caller = createCaller({
      prisma: mockPrisma as unknown as Context["prisma"],
      session: {
        user: { id: "user-dev-1" },
        expires: "",
      },
      headers: new Headers(),
    });

    await expect(
      caller.respondModInvitation({
        invitationId: "inv-1",
        accept: true,
      })
    ).rejects.toThrowError(
      new TRPCError({
        code: "BAD_REQUEST",
        message: "El host de la competencia no puede ser moderador de la misma competencia.",
      })
    );
  });

  it("permite rechazar la invitacion incluso si el usuario postulo un proyecto", async () => {
    const mockPrisma = {
      modInvitation: {
        findUnique: async () => mockInvitation,
        update: async ({ data }: { data: { status: string } }) => {
          return { ...mockInvitation, ...data };
        },
      },
      notification: {
        create: async ({ data }: { data: { userId: string; content: string; type: string } }) => {
          return { id: "notif-1", ...data };
        },
      },
      $transaction: async (operations: Promise<unknown>[]) => {
        return Promise.all(operations);
      },
    };

    const caller = createCaller({
      prisma: mockPrisma as unknown as Context["prisma"],
      session: {
        user: { id: "user-dev-1" },
        expires: "",
      },
      headers: new Headers(),
    });

    const result = await caller.respondModInvitation({
      invitationId: "inv-1",
      accept: false,
    });

    expect(result.status).toBe("REJECTED");
    expect(result.success).toBe(true);
  });

  it("permite aceptar la invitacion si el usuario no es dev, no es host y no tiene proyectos", async () => {
    const mockPrisma = {
      modInvitation: {
        findUnique: async () => mockInvitation,
        update: async ({ data }: { data: { status: string } }) => ({ ...mockInvitation, ...data }),
      },
      competitionParticipant: {
        findFirst: async () => null,
        upsert: async ({ create }: { create: { userId: string; competitionId: string; role: string } }) => ({
          ...create,
        }),
      },
      project: {
        findFirst: async () => null,
      },
      notification: {
        create: async ({ data }: { data: { userId: string; content: string; type: string } }) => ({
          id: "notif-1",
          ...data,
        }),
      },
      $transaction: async (operations: Promise<unknown>[]) => {
        return Promise.all(operations);
      },
    };

    const caller = createCaller({
      prisma: mockPrisma as unknown as Context["prisma"],
      session: {
        user: { id: "user-dev-1" },
        expires: "",
      },
      headers: new Headers(),
    });

    const result = await caller.respondModInvitation({
      invitationId: "inv-1",
      accept: true,
    });

    expect(result.status).toBe("ACCEPTED");
    expect(result.success).toBe(true);
  });
});
