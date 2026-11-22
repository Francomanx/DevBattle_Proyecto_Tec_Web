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
import { voteRouter } from "./vote";
import { createCallerFactory, type Context } from "../trpc";

describe("voteRouter.voteForProject - Pruebas Exhaustivas", () => {
  const createCaller = createCallerFactory(voteRouter);

  const baseProject = {
    id: "proj-100",
    title: "Proyecto de Evaluación",
    authorId: "author-user",
    isDisqualified: false,
    competition: {
      id: "comp-1",
      title: "Competencia de Votación",
      status: "VOTING",
      metrics: [
        { id: "m1", name: "Rendimiento" },
        { id: "m2", name: "Diseño UI" },
      ],
    },
    votes: [],
  };

  it("rechaza si el proyecto especificado no existe", async () => {
    const caller = createCaller({
      prisma: {
        project: { findUnique: async () => null },
      } as unknown as Context["prisma"],
      session: { user: { id: "juror-1" }, expires: "" },
      headers: new Headers(),
    });

    await expect(
      caller.voteForProject({
        projectId: "non-existent-proj",
        scores: [
          { metricId: "m1", score: 5 },
          { metricId: "m2", score: 4 },
        ],
      })
    ).rejects.toThrowError(
      new TRPCError({
        code: "NOT_FOUND",
        message: "El proyecto especificado no existe.",
      })
    );
  });

  it("rechaza si la competencia no se encuentra en periodo de votación", async () => {
    const caller = createCaller({
      prisma: {
        project: {
          findUnique: async () => ({
            ...baseProject,
            competition: {
              ...baseProject.competition,
              status: "ACTIVE", // Aún no en VOTING
            },
          }),
        },
      } as unknown as Context["prisma"],
      session: { user: { id: "juror-1" }, expires: "" },
      headers: new Headers(),
    });

    await expect(
      caller.voteForProject({
        projectId: "proj-100",
        scores: [
          { metricId: "m1", score: 5 },
          { metricId: "m2", score: 4 },
        ],
      })
    ).rejects.toThrowError(
      new TRPCError({
        code: "FORBIDDEN",
        message: "La competencia no se encuentra en periodo de votación.",
      })
    );
  });

  it("rechaza si el proyecto ha sido descalificado", async () => {
    const caller = createCaller({
      prisma: {
        project: {
          findUnique: async () => ({
            ...baseProject,
            isDisqualified: true,
          }),
        },
      } as unknown as Context["prisma"],
      session: { user: { id: "juror-1" }, expires: "" },
      headers: new Headers(),
    });

    await expect(
      caller.voteForProject({
        projectId: "proj-100",
        scores: [
          { metricId: "m1", score: 5 },
          { metricId: "m2", score: 4 },
        ],
      })
    ).rejects.toThrowError(
      new TRPCError({
        code: "FORBIDDEN",
        message: "El proyecto ha sido descalificado y no puede recibir votos.",
      })
    );
  });

  it("rechaza si el autor intenta votar por su propio proyecto", async () => {
    const caller = createCaller({
      prisma: {
        project: {
          findUnique: async () => ({
            ...baseProject,
            authorId: "author-user",
          }),
        },
      } as unknown as Context["prisma"],
      session: { user: { id: "author-user" }, expires: "" }, // Mismo ID que authorId
      headers: new Headers(),
    });

    await expect(
      caller.voteForProject({
        projectId: "proj-100",
        scores: [
          { metricId: "m1", score: 5 },
          { metricId: "m2", score: 5 },
        ],
      })
    ).rejects.toThrowError(
      new TRPCError({
        code: "FORBIDDEN",
        message: "No puedes votar por tu propio proyecto.",
      })
    );
  });

  it("rechaza si el jurado ya emitió un voto previo para el proyecto", async () => {
    const caller = createCaller({
      prisma: {
        project: {
          findUnique: async () => ({
            ...baseProject,
            votes: [{ id: "vote-prev", voterId: "juror-1" }],
          }),
        },
      } as unknown as Context["prisma"],
      session: { user: { id: "juror-1" }, expires: "" },
      headers: new Headers(),
    });

    await expect(
      caller.voteForProject({
        projectId: "proj-100",
        scores: [
          { metricId: "m1", score: 4 },
          { metricId: "m2", score: 4 },
        ],
      })
    ).rejects.toThrowError(
      new TRPCError({
        code: "CONFLICT",
        message: "Ya has emitido un voto para este proyecto previamente.",
      })
    );
  });

  it("rechaza si las notas enviadas no cubren todas las métricas de la competencia", async () => {
    const caller = createCaller({
      prisma: {
        project: {
          findUnique: async () => baseProject, // tiene métricas m1 y m2
        },
      } as unknown as Context["prisma"],
      session: { user: { id: "juror-1" }, expires: "" },
      headers: new Headers(),
    });

    // Solo enviamos nota para m1
    await expect(
      caller.voteForProject({
        projectId: "proj-100",
        scores: [{ metricId: "m1", score: 4 }],
      })
    ).rejects.toThrowError(
      new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Debes asignar una calificación para todas y cada una de las métricas de la competencia.",
      })
    );
  });

  it("crea exitosamente las calificaciones en base de datos si todo es válido", async () => {
    let insertedVotes: unknown[] = [];

    const caller = createCaller({
      prisma: {
        project: {
          findUnique: async () => baseProject,
        },
        vote: {
          createMany: async ({ data }: { data: unknown[] }) => {
            insertedVotes = data;
            return { count: data.length };
          },
        },
      } as unknown as Context["prisma"],
      session: { user: { id: "juror-1" }, expires: "" },
      headers: new Headers(),
    });

    const res = await caller.voteForProject({
      projectId: "proj-100",
      scores: [
        { metricId: "m1", score: 5 },
        { metricId: "m2", score: 4 },
      ],
    });

    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
    expect(insertedVotes).toEqual([
      {
        projectId: "proj-100",
        metricId: "m1",
        voterId: "juror-1",
        score: 5,
      },
      {
        projectId: "proj-100",
        metricId: "m2",
        voterId: "juror-1",
        score: 4,
      },
    ]);
  });
});
