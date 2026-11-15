import { describe, expect, it, vi } from "vitest";

vi.mock("@devbattle/db", () => ({ prisma: {} }));
vi.mock("../../auth", () => ({ auth: vi.fn() }));

import { createCallerFactory, type Context } from "../trpc";
import { projectRouter } from "./project";

type ParticipantRole = "HOST" | "MOD" | "DEV";

function createCaller({
  role = "HOST",
  status = "ACTIVE",
  isDisqualified = false,
  sessionUserId = "moderator-1",
  updateCount = 1,
  projectExists = true,
}: {
  role?: ParticipantRole;
  status?: string;
  isDisqualified?: boolean;
  sessionUserId?: string | null;
  updateCount?: number;
  projectExists?: boolean;
} = {}) {
  let projectRecord = {
    id: "project-1",
    title: "Proyecto de prueba",
    authorId: "developer-1",
    isDisqualified,
    disqualificationReason: isDisqualified ? "Motivo previo" : null,
    disqualifiedById: isDisqualified ? "moderator-previo" : null,
    competition: {
      title: "Competencia de prueba",
      status,
      participants:
        role === "HOST"
          ? [{ userId: "moderator-1", role: "HOST" }]
          : [
              { userId: "host-1", role: "HOST" },
              { userId: "moderator-1", role },
            ],
    },
  };
  const updatedByIds: Array<string | null> = [];
  const createNotifications = vi.fn(
    async ({
      data,
    }: {
      data: Array<{ userId: string; content: string; type: string }>;
    }) => ({ count: data.length })
  );
  const transaction = {
    project: {
      findUnique: vi.fn(async () => (projectExists ? projectRecord : null)),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (updateCount !== 1 || projectRecord.isDisqualified) {
          return { count: 0 };
        }
        projectRecord = { ...projectRecord, ...data } as typeof projectRecord;
        updatedByIds.push(projectRecord.disqualifiedById);
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async () => projectRecord),
    },
    notification: { createMany: createNotifications },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction)
    ),
  };
  const context = {
    prisma,
    headers: new Headers(),
    session: sessionUserId ? { user: { id: sessionUserId } } : null,
  } as unknown as Context;

  return {
    caller: createCallerFactory(projectRouter)(context),
    createNotifications,
    transaction,
    updatedByIds,
  };
}

describe("project.disqualify", () => {
  it.each(["HOST", "MOD"] as const)(
    "permite al rol %s y registra quién descalificó",
    async (role) => {
      const { caller, createNotifications, updatedByIds } = createCaller({ role });

      const result = await caller.disqualify({
        projectId: "project-1",
        reason: "No cumple las reglas",
      });

      expect(result.success).toBe(true);
      expect(result.project.isDisqualified).toBe(true);
      expect(result.project.disqualificationReason).toBe("No cumple las reglas");
      expect(updatedByIds).toEqual(["moderator-1"]);
      expect(createNotifications).toHaveBeenCalledOnce();
      expect(
        createNotifications.mock.calls[0][0].data.map(
          (notification) => notification.userId
        )
      ).toEqual(
        role === "HOST"
          ? ["developer-1", "moderator-1"]
          : ["developer-1", "host-1"]
      );
    }
  );

  it("rechaza a usuarios sin rol de host o moderador", async () => {
    const { caller } = createCaller({ role: "DEV" });

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "No cumple las reglas" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requiere una sesión autenticada", async () => {
    const { caller } = createCaller({ sessionUserId: null });

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "No cumple las reglas" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rechaza una competencia finalizada", async () => {
    const { caller } = createCaller({ status: "COMPLETED" });

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "No cumple las reglas" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rechaza motivos vacíos", async () => {
    const { caller, transaction } = createCaller();

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "   " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(transaction.project.findUnique).not.toHaveBeenCalled();
  });

  it("devuelve conflicto si el proyecto ya fue descalificado", async () => {
    const { caller } = createCaller({ isDisqualified: true });

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "No cumple las reglas" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("devuelve conflicto si otro moderador ganó el intento concurrente", async () => {
    const { caller, createNotifications } = createCaller({ updateCount: 0 });

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "No cumple las reglas" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(createNotifications).not.toHaveBeenCalled();
  });

  it("devuelve not found cuando el proyecto no existe", async () => {
    const { caller } = createCaller({ projectExists: false });

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "No cumple las reglas" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
