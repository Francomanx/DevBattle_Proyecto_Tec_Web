import { describe, expect, it, vi } from "vitest";

vi.mock("@devbattle/db", () => ({
  prisma: {},
  CompetitionStatus: {
    ACTIVE: "ACTIVE",
    VOTING: "VOTING",
    COMPLETED: "COMPLETED",
  },
  MetricType: {
    NUMERIC: "NUMERIC",
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

vi.mock("../services/cron.service", () => ({
  updateCompetitionStatuses: vi.fn().mockResolvedValue(undefined),
}));

import { TRPCError } from "@trpc/server";
import { challengeRouter } from "./challenge";
import { createCallerFactory, type Context } from "../trpc";
import { updateCompetitionStatuses } from "../services/cron.service";

describe("challengeRouter - Pruebas Exhaustivas", () => {
  const createCaller = createCallerFactory(challengeRouter);

  describe("Procedimiento: getAvailableFilters", () => {
    it("extrae estados y formatos únicos de las competencias existentes", async () => {
      const mockCompetitions = [
        { status: "ACTIVE", fileFormat: "link, zip" },
        { status: "VOTING", fileFormat: "zip, archivo" },
        { status: "COMPLETED", fileFormat: "link" },
      ];

      const caller = createCaller({
        prisma: {
          competition: {
            findMany: async () => mockCompetitions,
          },
        } as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      const filters = await caller.getAvailableFilters();

      expect(filters.statuses).toContain("active");
      expect(filters.statuses).toContain("vote");
      expect(filters.statuses).toContain("completed");
      expect(filters.formats).toContain("link");
      expect(filters.formats).toContain("zip");
      expect(filters.formats).toContain("archivo");
    });
  });

  describe("Procedimiento: list", () => {
    it("retorna las competencias paginadas y mapeadas al formato del frontend", async () => {
      const subDeadline = new Date("2026-06-01T12:00:00Z");
      const voteDeadline = new Date("2026-06-15T12:00:00Z");

      const mockCompetitions = [
        {
          id: "comp-active",
          title: "Desafío Frontend React",
          description: "Crea una UI moderna",
          status: "ACTIVE",
          submissionDeadline: subDeadline,
          votingDeadline: voteDeadline,
          fileFormat: "link, zip",
          tags: ["react", "frontend"],
          participants: [
            { role: "HOST", user: { id: "host-1", username: "master_host" } },
          ],
          _count: { participants: 15, projects: 5 },
        },
        {
          id: "comp-vote",
          title: "Desafío Backend",
          description: "Crea una API en Node",
          status: "VOTING",
          submissionDeadline: subDeadline,
          votingDeadline: voteDeadline,
          fileFormat: "archivo",
          tags: ["node", "api"],
          participants: [],
          _count: { participants: 8, projects: 8 },
        },
      ];

      const caller = createCaller({
        prisma: {
          competition: {
            count: async () => 2,
            findMany: async () => mockCompetitions,
          },
        } as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      const res = await caller.list({ page: 1, limit: 10 });

      expect(res.meta.total).toBe(2);
      expect(res.meta.currentPage).toBe(1);
      expect(res.meta.totalPages).toBe(1);
      expect(res.items).toHaveLength(2);

      const item1 = res.items[0];
      expect(item1.status).toBe("active");
      expect(item1.deadline).toEqual(subDeadline);
      expect(item1.host).toBe("master_host");
      expect(item1.formats).toEqual(["link", "zip"]);

      const item2 = res.items[1];
      expect(item2.status).toBe("vote");
      expect(item2.deadline).toEqual(voteDeadline);
      expect(item2.host).toBe("DevBattle"); // Fallback cuando no hay host explícito
      expect(item2.formats).toEqual(["archivo"]);
    });
  });

  describe("Procedimiento: bySlug", () => {
    it("retorna la competencia si existe", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => ({ id: "reto-algoritmo", title: "Reto" }),
          },
        } as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      const comp = await caller.bySlug({ slug: "reto-algoritmo" });
      expect(comp.id).toBe("reto-algoritmo");
    });

    it("lanza NOT_FOUND si la competencia no existe", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => null,
          },
        } as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(caller.bySlug({ slug: "inexistente" })).rejects.toThrowError(
        new TRPCError({ code: "NOT_FOUND" })
      );
    });
  });

  describe("Procedimiento: triggerCronJob", () => {
    it("invoca exitosamente updateCompetitionStatuses y responde con confirmación", async () => {
      const caller = createCaller({
        prisma: {} as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      const res = await caller.triggerCronJob();
      expect(res.success).toBe(true);
      expect(updateCompetitionStatuses).toHaveBeenCalled();
    });
  });
});
