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
import {
  competitionRouter,
  validateCompetitionForActivation,
} from "./competition";
import { createCallerFactory, type Context } from "../trpc";

describe("Validaciones de Cronograma y Fechas en Competencia", () => {
  const now = Date.now();

  describe("validateCompetitionForActivation", () => {
    const baseValidComp = {
      title: "Competencia de Prueba",
      description: "A".repeat(160),
      rules: "Reglas de la competencia",
      fileFormat: "zip",
      metrics: [
        { name: "Criterio 1", weight: 50, maxValue: 5 },
        { name: "Criterio 2", weight: 50, maxValue: 5 },
      ],
      submissionDeadline: new Date(now + 7 * 24 * 60 * 60 * 1000),
      votingDeadline: new Date(now + 14 * 24 * 60 * 60 * 1000),
    };

    it("pasa validacion cuando las fechas son futuras y consistentes", () => {
      const errors = validateCompetitionForActivation(baseValidComp);
      expect(errors).toEqual([]);
    });

    it("detecta error si submissionDeadline es anterior a la fecha actual", () => {
      const pastDate = new Date(now - 2 * 24 * 60 * 60 * 1000);
      const errors = validateCompetitionForActivation({
        ...baseValidComp,
        submissionDeadline: pastDate,
      });
      expect(
        errors.some((e) =>
          e.includes("recepción de soluciones no puede ser anterior a la fecha")
        )
      ).toBe(true);
    });

    it("detecta error si votingDeadline es anterior a la fecha actual", () => {
      const pastDate = new Date(now - 1 * 24 * 60 * 60 * 1000);
      const errors = validateCompetitionForActivation({
        ...baseValidComp,
        votingDeadline: pastDate,
      });
      expect(
        errors.some((e) =>
          e.includes("votación no puede ser anterior a la fecha")
        )
      ).toBe(true);
    });

    it("detecta error si votingDeadline es anterior o igual a submissionDeadline", () => {
      const sub = new Date(now + 10 * 24 * 60 * 60 * 1000);
      const vote = new Date(now + 5 * 24 * 60 * 60 * 1000);
      const errors = validateCompetitionForActivation({
        ...baseValidComp,
        submissionDeadline: sub,
        votingDeadline: vote,
      });
      expect(
        errors.some((e) =>
          e.includes("votación debe ser posterior a la fecha límite de recepción")
        )
      ).toBe(true);
    });
  });

  describe("competitionRouter.create", () => {
    const createCaller = createCallerFactory(competitionRouter);

    it("rechaza la creacion si submissionDeadline es en el pasado", async () => {
      const mockPrisma = {
        user: {
          findUnique: async () => ({ id: "host-1", username: "host_user" }),
          findFirst: async () => ({ id: "host-1", username: "host_user" }),
        },
      };

      const caller = createCaller({
        prisma: mockPrisma as unknown as Context["prisma"],
        session: {
          user: { id: "host-1" },
          expires: "",
        },
        headers: new Headers(),
      });

      const pastSub = new Date(now - 3600000);
      const futureVote = new Date(now + 86400000);

      await expect(
        caller.create({
          title: "Competencia con fecha pasada",
          description: "D".repeat(160),
          rules: "Reglas",
          submissionDeadline: pastSub,
          votingDeadline: futureVote,
          status: "DRAFT",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "BAD_REQUEST",
          message:
            "La fecha límite de recepción de soluciones no puede ser anterior a la fecha y hora actual.",
        })
      );
    });

    it("rechaza la creacion si votingDeadline es anterior o igual a submissionDeadline", async () => {
      const mockPrisma = {
        user: {
          findUnique: async () => ({ id: "host-1", username: "host_user" }),
          findFirst: async () => ({ id: "host-1", username: "host_user" }),
        },
      };

      const caller = createCaller({
        prisma: mockPrisma as unknown as Context["prisma"],
        session: {
          user: { id: "host-1" },
          expires: "",
        },
        headers: new Headers(),
      });

      const futureSub = new Date(now + 86400000 * 5);
      const invalidVote = new Date(now + 86400000 * 2);

      await expect(
        caller.create({
          title: "Competencia con fechas invertidas",
          description: "D".repeat(160),
          rules: "Reglas",
          submissionDeadline: futureSub,
          votingDeadline: invalidVote,
          status: "DRAFT",
        })
      ).rejects.toThrowError(
        new TRPCError({
          code: "BAD_REQUEST",
          message:
            "La fecha límite de votación debe ser posterior a la fecha límite de recepción de proyectos.",
        })
      );
    });
  });
});
