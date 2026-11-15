import { describe, expect, it, vi } from "vitest";

vi.mock("@devbattle/db", () => ({ prisma: {} }));
vi.mock("../../auth", () => ({ auth: vi.fn() }));

import { createCallerFactory, type Context } from "../trpc";
import { voteRouter } from "./vote";

describe("vote.voteForProject", () => {
  it("rechaza un proyecto descalificado durante la votación", async () => {
    const createVotes = vi.fn();
    const prisma = {
      project: {
        findUnique: vi.fn(async () => ({
          id: "project-1",
          authorId: "author-1",
          isDisqualified: true,
          competition: {
            status: "VOTING",
            metrics: [{ id: "metric-1" }],
          },
          votes: [],
        })),
      },
      vote: { createMany: createVotes },
    };
    const context = {
      prisma,
      headers: new Headers(),
      session: { user: { id: "voter-1" } },
    } as unknown as Context;
    const caller = createCallerFactory(voteRouter)(context);

    await expect(
      caller.voteForProject({
        projectId: "project-1",
        scores: [{ metricId: "metric-1", score: 5 }],
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "El proyecto ha sido descalificado y no puede recibir votos.",
    });
    expect(createVotes).not.toHaveBeenCalled();
  });
});
