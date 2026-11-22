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

import { competitionRouter } from "./competition";
import { createCallerFactory, type Context } from "../trpc";

describe("Transiciones automáticas de estado al abrir una competencia (byId)", () => {
  const createCaller = createCallerFactory(competitionRouter);
  const now = Date.now();

  it("cambia el estado de ACTIVE a VOTING cuando vence submissionDeadline", async () => {
    let updatedStatus: string | null = null;

    const mockCompetition = {
      id: "comp-1",
      title: "Competencia en transición a VOTING",
      status: "ACTIVE",
      submissionDeadline: new Date(now - 1000 * 60 * 60), // hace 1 hora
      votingDeadline: new Date(now + 1000 * 60 * 60 * 24), // en 24 horas
      metrics: [],
      projects: [],
      participants: [
        {
          userId: "user-host",
          role: "HOST",
          user: { id: "user-host", username: "host_user" },
        },
      ],
    };

    const mockPrisma = {
      competition: {
        findMany: async () => [],
        findUnique: async () => ({ ...mockCompetition }),
        update: async ({ data }: { data: { status: string } }) => {
          updatedStatus = data.status;
          return { ...mockCompetition, status: data.status };
        },
      },
    };

    const caller = createCaller({
      prisma: mockPrisma as unknown as Context["prisma"],
      session: {
        user: { id: "user-host" },
        expires: "",
      },
      headers: new Headers(),
    });

    const result = await caller.byId({ id: "comp-1" });

    expect(result.status).toBe("VOTING");
    expect(updatedStatus).toBe("VOTING");
  });

  it("cambia el estado de ACTIVE a COMPLETED cuando vence votingDeadline", async () => {
    let updatedStatus: string | null = null;

    const mockCompetition = {
      id: "comp-2",
      title: "Competencia finalizada",
      status: "ACTIVE",
      submissionDeadline: new Date(now - 1000 * 60 * 60 * 48), // hace 48 horas
      votingDeadline: new Date(now - 1000 * 60 * 60), // hace 1 hora
      metrics: [],
      projects: [],
      participants: [
        {
          userId: "user-host",
          role: "HOST",
          user: { id: "user-host", username: "host_user" },
        },
      ],
    };

    const mockPrisma = {
      competition: {
        findMany: async () => [],
        findUnique: async () => ({ ...mockCompetition }),
        update: async ({ data }: { data: { status: string } }) => {
          updatedStatus = data.status;
          return { ...mockCompetition, status: data.status };
        },
      },
    };

    const caller = createCaller({
      prisma: mockPrisma as unknown as Context["prisma"],
      session: {
        user: { id: "user-host" },
        expires: "",
      },
      headers: new Headers(),
    });

    const result = await caller.byId({ id: "comp-2" });

    expect(result.status).toBe("COMPLETED");
    expect(updatedStatus).toBe("COMPLETED");
  });

  it("cambia el estado de VOTING a COMPLETED cuando vence votingDeadline", async () => {
    let updatedStatus: string | null = null;

    const mockCompetition = {
      id: "comp-3",
      title: "Competencia de votación a finalizada",
      status: "VOTING",
      submissionDeadline: new Date(now - 1000 * 60 * 60 * 24),
      votingDeadline: new Date(now - 1000 * 60 * 30), // hace 30 minutos
      metrics: [],
      projects: [],
      participants: [
        {
          userId: "user-host",
          role: "HOST",
          user: { id: "user-host", username: "host_user" },
        },
      ],
    };

    const mockPrisma = {
      competition: {
        findMany: async () => [],
        findUnique: async () => ({ ...mockCompetition }),
        update: async ({ data }: { data: { status: string } }) => {
          updatedStatus = data.status;
          return { ...mockCompetition, status: data.status };
        },
      },
    };

    const caller = createCaller({
      prisma: mockPrisma as unknown as Context["prisma"],
      session: {
        user: { id: "user-host" },
        expires: "",
      },
      headers: new Headers(),
    });

    const result = await caller.byId({ id: "comp-3" });

    expect(result.status).toBe("COMPLETED");
    expect(updatedStatus).toBe("COMPLETED");
  });

  it("mantiene estado ACTIVE si aún no vence submissionDeadline", async () => {
    let updateCalled = false;

    const mockCompetition = {
      id: "comp-4",
      title: "Competencia en curso",
      status: "ACTIVE",
      submissionDeadline: new Date(now + 1000 * 60 * 60 * 24), // mañana
      votingDeadline: new Date(now + 1000 * 60 * 60 * 48), // pasado mañana
      metrics: [],
      projects: [],
      participants: [
        {
          userId: "user-host",
          role: "HOST",
          user: { id: "user-host", username: "host_user" },
        },
      ],
    };

    const mockPrisma = {
      competition: {
        findMany: async () => [],
        findUnique: async () => ({ ...mockCompetition }),
        update: async () => {
          updateCalled = true;
          return mockCompetition;
        },
      },
    };

    const caller = createCaller({
      prisma: mockPrisma as unknown as Context["prisma"],
      session: {
        user: { id: "user-host" },
        expires: "",
      },
      headers: new Headers(),
    });

    const result = await caller.byId({ id: "comp-4" });

    expect(result.status).toBe("ACTIVE");
    expect(updateCalled).toBe(false);
  });

  it("no realiza transicion automatica si la competencia está en DRAFT", async () => {
    let updateCalled = false;

    const mockCompetition = {
      id: "comp-draft",
      title: "Competencia borrador",
      status: "DRAFT",
      submissionDeadline: new Date(now - 1000 * 60 * 60),
      votingDeadline: new Date(now - 1000 * 60 * 30),
      metrics: [],
      projects: [],
      participants: [
        {
          userId: "user-host",
          role: "HOST",
          user: { id: "user-host", username: "host_user" },
        },
      ],
    };

    const mockPrisma = {
      competition: {
        findMany: async () => [],
        findUnique: async () => ({ ...mockCompetition }),
        update: async () => {
          updateCalled = true;
          return mockCompetition;
        },
      },
    };

    const caller = createCaller({
      prisma: mockPrisma as unknown as Context["prisma"],
      session: {
        user: { id: "user-host" },
        expires: "",
      },
      headers: new Headers(),
    });

    const result = await caller.byId({ id: "comp-draft" });

    expect(result.status).toBe("DRAFT");
    expect(updateCalled).toBe(false);
  });
});
