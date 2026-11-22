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

vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: class {
      send = vi.fn().mockResolvedValue({});
    },
    PutObjectCommand: class {},
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.mocked-url.com/upload"),
}));

import { TRPCError } from "@trpc/server";
import { projectRouter, submitProjectSchema } from "./project";
import { createCallerFactory, type Context } from "../trpc";

type ParticipantRole = "HOST" | "MOD" | "DEV";

function createDisqualifyCaller({
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
      const { caller, createNotifications, updatedByIds } = createDisqualifyCaller({ role });

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
    const { caller } = createDisqualifyCaller({ role: "DEV" });

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "No cumple las reglas" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requiere una sesión autenticada", async () => {
    const { caller } = createDisqualifyCaller({ sessionUserId: null });

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "No cumple las reglas" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rechaza una competencia finalizada", async () => {
    const { caller } = createDisqualifyCaller({ status: "COMPLETED" });

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "No cumple las reglas" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rechaza motivos vacíos", async () => {
    const { caller, transaction } = createDisqualifyCaller();

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "   " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(transaction.project.findUnique).not.toHaveBeenCalled();
  });

  it("devuelve conflicto si el proyecto ya fue descalificado", async () => {
    const { caller } = createDisqualifyCaller({ isDisqualified: true });

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "No cumple las reglas" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("devuelve conflicto si otro moderador ganó el intento concurrente", async () => {
    const { caller, createNotifications } = createDisqualifyCaller({ updateCount: 0 });

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "No cumple las reglas" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(createNotifications).not.toHaveBeenCalled();
  });

  it("devuelve not found cuando el proyecto no existe", async () => {
    const { caller } = createDisqualifyCaller({ projectExists: false });

    await expect(
      caller.disqualify({ projectId: "project-1", reason: "No cumple las reglas" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("projectRouter & submitProjectSchema - Pruebas Exhaustivas", () => {
  const createCaller = createCallerFactory(projectRouter);
  const validCuid = "c123456789012345678901234";

  describe("Validación de Esquema: submitProjectSchema", () => {
    const validBaseInput = {
      competitionId: validCuid,
      title: "Proyecto de Inteligencia Artificial",
      description: "A".repeat(220),
      deliverableType: "link",
      deliverableContent: "https://github.com/developer/my-project",
    };

    it("aprueba un entregable tipo link con URL https válida", () => {
      const result = submitProjectSchema.safeParse(validBaseInput);
      expect(result.success).toBe(true);
    });

    it("aprueba un entregable tipo link con URL http válida", () => {
      const result = submitProjectSchema.safeParse({
        ...validBaseInput,
        deliverableContent: "http://example.com/project",
      });
      expect(result.success).toBe(true);
    });

    it("rechaza un entregable tipo link con URL inválida o esquema no http/https", () => {
      const result = submitProjectSchema.safeParse({
        ...validBaseInput,
        deliverableContent: "ftp://example.com/repo",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes("requiere http/https")
          )
        ).toBe(true);
      }
    });

    it("aprueba un entregable tipo zip que termina con .zip", () => {
      const result = submitProjectSchema.safeParse({
        ...validBaseInput,
        deliverableType: "zip",
        deliverableContent: "solution_final.zip",
      });
      expect(result.success).toBe(true);
    });

    it("rechaza un entregable tipo zip si el archivo no termina en .zip", () => {
      const result = submitProjectSchema.safeParse({
        ...validBaseInput,
        deliverableType: "zip",
        deliverableContent: "solution_final.tar.gz",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes("debe tener extensión .zip")
          )
        ).toBe(true);
      }
    });

    it("aprueba un entregable tipo archivo con extensiones de código permitidas", () => {
      const allowedSamples = [
        "app.py",
        "index.js",
        "main.ts",
        "Solution.java",
        "query.sql",
        "script.cpp",
        "readme.md",
      ];
      for (const file of allowedSamples) {
        const result = submitProjectSchema.safeParse({
          ...validBaseInput,
          deliverableType: "archivo",
          deliverableContent: file,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rechaza un entregable tipo archivo con extensiones potencialmente peligrosas", () => {
      const bannedSamples = [
        "malware.exe",
        "script.bat",
        "payload.sh",
        "installer.msi",
        "macro.vbs",
      ];
      for (const file of bannedSamples) {
        const result = submitProjectSchema.safeParse({
          ...validBaseInput,
          deliverableType: "archivo",
          deliverableContent: file,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(
            result.error.issues.some((i) =>
              i.message.includes("Extensión de archivo no permitida")
            )
          ).toBe(true);
        }
      }
    });

    it("rechaza proyectos con descripción menor a 200 caracteres", () => {
      const result = submitProjectSchema.safeParse({
        ...validBaseInput,
        description: "Descripción demasiado corta que no alcanza el mínimo.",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes("al menos 200 caracteres")
          )
        ).toBe(true);
      }
    });

    it("rechaza proyectos con título vacío o que supere 120 caracteres", () => {
      const emptyTitleResult = submitProjectSchema.safeParse({
        ...validBaseInput,
        title: "",
      });
      expect(emptyTitleResult.success).toBe(false);

      const longTitleResult = submitProjectSchema.safeParse({
        ...validBaseInput,
        title: "T".repeat(125),
      });
      expect(longTitleResult.success).toBe(false);
    });

    it("rechaza formatos de entregable no soportados", () => {
      const result = submitProjectSchema.safeParse({
        ...validBaseInput,
        deliverableType: "torrent",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Procedimiento: byId", () => {
    it("devuelve el proyecto si existe", async () => {
      const mockProject = {
        id: "proj-123",
        title: "Proyecto 123",
        author: { id: "user-1", username: "dev_user" },
        competition: { id: "comp-1", title: "Comp 1", status: "ACTIVE" },
        votes: [],
      };

      const caller = createCaller({
        prisma: {
          project: {
            findUnique: async () => mockProject,
          },
        } as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      const res = await caller.byId({ id: "proj-123" });
      expect(res.id).toBe("proj-123");
      expect(res.title).toBe("Proyecto 123");
    });

    it("lanza NOT_FOUND si el proyecto no existe", async () => {
      const caller = createCaller({
        prisma: {
          project: {
            findUnique: async () => null,
          },
        } as unknown as Context["prisma"],
        session: null,
        headers: new Headers(),
      });

      await expect(caller.byId({ id: "non-existent" })).rejects.toThrowError(
        new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" })
      );
    });
  });



  describe("Procedimiento: submitToCompetition", () => {
    const validSubmissionInput = {
      competitionId: validCuid,
      title: "Solución de Rendimiento Máximo",
      description: "D".repeat(220),
      deliverableType: "link",
      deliverableContent: "https://github.com/contestant/repo",
    };

    it("rechaza el envío si la competencia no existe", async () => {
      const caller = createCaller({
        prisma: {
          competition: { findUnique: async () => null },
        } as unknown as Context["prisma"],
        session: { user: { id: "dev-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.submitToCompetition(validSubmissionInput)
      ).rejects.toThrowError(
        new TRPCError({
          code: "NOT_FOUND",
          message: "La competencia no existe.",
        })
      );
    });

    it("rechaza el envío si la competencia no está en estado ACTIVE", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => ({
              id: validCuid,
              status: "VOTING",
              submissionDeadline: new Date(Date.now() + 86400000),
              fileFormat: "link,zip",
            }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "dev-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.submitToCompetition(validSubmissionInput)
      ).rejects.toThrowError(
        new TRPCError({
          code: "FORBIDDEN",
          message:
            "La competencia no acepta proyectos (Estado actual: VOTING).",
        })
      );
    });

    it("rechaza el envío si la fecha límite de recepción ya pasó", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => ({
              id: validCuid,
              status: "ACTIVE",
              submissionDeadline: new Date(Date.now() - 3600000), // Hace 1 hora
              fileFormat: "link",
            }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "dev-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.submitToCompetition(validSubmissionInput)
      ).rejects.toThrowError(
        new TRPCError({
          code: "FORBIDDEN",
          message: "La fecha límite de recepción de proyectos ya ha pasado.",
        })
      );
    });

    it("rechaza si el formato no coincide con los formatos permitidos de la competencia", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => ({
              id: validCuid,
              status: "ACTIVE",
              submissionDeadline: new Date(Date.now() + 86400000),
              fileFormat: "zip", // Solo zip
            }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "dev-1" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.submitToCompetition(validSubmissionInput) // deliverableType: "link"
      ).rejects.toThrowError(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "La competencia no acepta el formato: link",
        })
      );
    });

    it("rechaza si el usuario ya es HOST de la competencia", async () => {
      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => ({
              id: validCuid,
              status: "ACTIVE",
              submissionDeadline: new Date(Date.now() + 86400000),
              fileFormat: "link",
            }),
          },
          competitionParticipant: {
            findUnique: async () => ({
              role: "HOST",
            }),
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "host-user" }, expires: "" },
        headers: new Headers(),
      });

      await expect(
        caller.submitToCompetition(validSubmissionInput)
      ).rejects.toThrowError(
        new TRPCError({
          code: "FORBIDDEN",
          message:
            "El host de la competencia no puede participar como dev en la misma competencia.",
        })
      );
    });

    it("crea exitosamente el proyecto y registra la participación DEV", async () => {
      let createdProject: unknown = null;
      let participantCreated: unknown = null;

      const caller = createCaller({
        prisma: {
          competition: {
            findUnique: async () => ({
              id: validCuid,
              status: "ACTIVE",
              submissionDeadline: new Date(Date.now() + 86400000),
              fileFormat: "link",
            }),
          },
          competitionParticipant: {
            findUnique: async () => null,
            create: async ({ data }: { data: unknown }) => {
              participantCreated = data;
              return data;
            },
          },
          project: {
            findFirst: async () => null,
            create: async ({ data }: { data: Record<string, unknown> }) => {
              createdProject = data;
              return { id: "new-proj-id", ...data };
            },
          },
          $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
            return cb({
              project: {
                create: async ({ data }: { data: Record<string, unknown> }) => {
                  createdProject = data;
                  return { id: "new-proj-id", ...data };
                },
              },
              competitionParticipant: {
                upsert: async ({ create }: { create: unknown }) => {
                  participantCreated = create;
                  return create;
                },
              },
            });
          },
        } as unknown as Context["prisma"],
        session: { user: { id: "new-dev-user" }, expires: "" },
        headers: new Headers(),
      });

      const res = await caller.submitToCompetition(validSubmissionInput);

      expect(res.success).toBe(true);
      expect(res.projectId).toBe("new-proj-id");
      expect(createdProject).toBeDefined();
      expect(participantCreated).toEqual({
        userId: "new-dev-user",
        competitionId: validCuid,
        role: "DEV",
      });
    });
  });
});
