import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const competitionStatus = z.enum([
  "DRAFT",
  "ACTIVE",
  "VOTING",
  "COMPLETED"
]);

export function validateCompetitionForActivation(competition: {
  title?: string | null;
  description?: string | null;
  rules?: string | null;
  fileFormat?: string | null;
  metrics?: Array<{ name: string; maxValue?: number }> | null;
  submissionDeadline?: Date | null;
  votingDeadline?: Date | null;
}): string[] {
  const errors: string[] = [];

  if (!competition.title || !competition.title.trim()) {
    errors.push("El título de la competencia no puede estar vacío.");
  }
  if (!competition.description || competition.description.trim().length < 150) {
    errors.push("La descripción debe tener al menos 150 caracteres.");
  }
  if (!competition.rules || !competition.rules.trim()) {
    errors.push("Debes especificar las reglas y restricciones.");
  }
  if (!competition.fileFormat || !competition.fileFormat.trim()) {
    errors.push("Debes seleccionar al menos un formato de recepción.");
  }
  if (!competition.metrics || competition.metrics.length === 0) {
    errors.push("Debes definir al menos una métrica de evaluación.");
  } else {
    const validMetrics = competition.metrics.filter(
      (m) => m.name && m.name.trim().length > 0
    );
    if (validMetrics.length === 0) {
      errors.push("Debes definir al menos una métrica de evaluación con su nombre.");
    }
  }

  if (
    !competition.submissionDeadline ||
    isNaN(new Date(competition.submissionDeadline).getTime())
  ) {
    errors.push("Debes definir la fecha límite de recepción de soluciones.");
  }
  if (
    !competition.votingDeadline ||
    isNaN(new Date(competition.votingDeadline).getTime())
  ) {
    errors.push("Debes definir la fecha límite de votación.");
  }

  if (
    competition.submissionDeadline &&
    competition.votingDeadline &&
    !isNaN(new Date(competition.submissionDeadline).getTime()) &&
    !isNaN(new Date(competition.votingDeadline).getTime())
  ) {
    const subTime = new Date(competition.submissionDeadline).getTime();
    const voteTime = new Date(competition.votingDeadline).getTime();
    if (subTime >= voteTime) {
      errors.push(
        "La fecha límite de votación debe ser posterior a la fecha límite de recepción de proyectos."
      );
    }
  }

  return errors;
}

export const competitionRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ status: competitionStatus.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const targetStatus = input?.status;
      const whereCondition: Record<string, unknown> = {};

      if (targetStatus) {
        whereCondition.status = targetStatus;
        if (targetStatus === "DRAFT") {
          const currentUserId = ctx.session?.user?.id;
          if (currentUserId) {
            whereCondition.participants = {
              some: {
                userId: currentUserId,
                role: "HOST",
              },
            };
          } else {
            whereCondition.id = "no-drafts-for-guests";
          }
        }
      } else {
        whereCondition.status = { in: ["ACTIVE", "VOTING", "COMPLETED"] };
      }

      return ctx.prisma.competition.findMany({
        where: whereCondition,
        include: {
          metrics: true,
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
          _count: {
            select: {
              participants: true,
              projects: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string().min(1), userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const competition = await ctx.prisma.competition.findUnique({
        where: { id: input.id },
        include: {
          metrics: true,
          projects: {
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  githubUrl: true,
                },
              },
              votes: true,
            },
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      if (!competition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Competencia no encontrada" });
      }

      // Proteger el acceso a competencias en estado DRAFT:
      // Solo el host de la competencia creada tiene permiso para acceder a su detalle.
      if (competition.status === "DRAFT") {
        const currentUserId = ctx.session?.user?.id ?? input.userId;
        const hostParticipant = competition.participants.find((p) => p.role === "HOST");

        let isHost = false;
        if (currentUserId && hostParticipant) {
          if (
            hostParticipant.userId === currentUserId ||
            hostParticipant.user.username === currentUserId
          ) {
            isHost = true;
          } else {
            const reqUser = await ctx.prisma.user.findFirst({
              where: {
                OR: [{ id: currentUserId }, { username: currentUserId }],
              },
            });
            if (reqUser && hostParticipant.userId === reqUser.id) {
              isHost = true;
            }
          }
        }

        if (!isHost) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Solo el host de la competencia puede acceder al detalle de una competencia en estado borrador.",
          });
        }
      }

      return competition;
    }),

  activate: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const targetUserId = ctx.session?.user?.id ?? input.userId;
      if (!targetUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para activar la competencia.",
        });
      }

      const competition = await ctx.prisma.competition.findUnique({
        where: { id: input.id },
        include: {
          metrics: true,
          participants: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!competition) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Competencia no encontrada.",
        });
      }

      if (competition.status === "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La competencia ya se encuentra activa.",
        });
      }

      if (competition.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No se puede activar una competencia en estado ${competition.status}.`,
        });
      }

      // Validar que el usuario que activa sea el HOST de la competencia
      const hostParticipant = competition.participants.find(
        (p) => p.role === "HOST"
      );

      let isHost = false;
      if (hostParticipant) {
        if (
          hostParticipant.userId === targetUserId ||
          hostParticipant.user.username === targetUserId
        ) {
          isHost = true;
        } else {
          const reqUser = await ctx.prisma.user.findFirst({
            where: {
              OR: [{ id: targetUserId }, { username: targetUserId }],
            },
          });
          if (reqUser && hostParticipant.userId === reqUser.id) {
            isHost = true;
          }
        }
      }

      if (!isHost) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el host de la competencia puede activarla.",
        });
      }

      // Validar que la competencia tenga todos los campos obligatorios completos antes de activarla
      const validationErrors = validateCompetitionForActivation(competition);
      if (validationErrors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No se puede activar la competencia: ${validationErrors.join(" ")}`,
        });
      }

      const updated = await ctx.prisma.competition.update({
        where: { id: input.id },
        data: {
          status: "ACTIVE",
        },
      });

      return {
        success: true,
        competitionId: updated.id,
        status: updated.status,
        title: updated.title,
        message: "Competencia activada con éxito.",
      };
    }),

  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1, "El título no puede estar vacío").max(150),
        description: z.string().min(150, "La descripción debe tener al menos 150 caracteres"),
        rules: z.string().min(1, "Las reglas no pueden estar vacías"),
        fileFormat: z.string().optional(),
        tags: z.array(z.string()).optional(),
        submissionDeadline: z.coerce.date(),
        votingDeadline: z.coerce.date(),
        metrics: z
          .union([
            z.record(z.string(), z.any()),
            z.array(
              z.object({
                name: z.string(),
                type: z.enum(["OBJECTIVE", "SUBJECTIVE"]).optional(),
                maxValue: z.number().optional(),
                weight: z.number().optional(),
              })
            ),
          ])
          .optional(),
        userId: z.string().optional(),
        status: z.enum(["DRAFT", "ACTIVE"]).optional().default("DRAFT"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Priorizar la sesión autenticada; permitir input.userId si se proporciona explícitamente
      const targetUserId = ctx.session?.user?.id ?? input.userId;
      if (!targetUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para crear una competencia.",
        });
      }

      let hostUser = await ctx.prisma.user.findUnique({
        where: { id: targetUserId },
      });
      if (!hostUser) {
        hostUser = await ctx.prisma.user.findFirst({
          where: { username: targetUserId },
        });
      }

      if (!hostUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario creador no encontrado.",
        });
      }

      // Preparar métricas asociadas
      const metricRecords: Array<{
        name: string;
        type: "OBJECTIVE" | "SUBJECTIVE";
        maxValue: number;
      }> = [];

      if (input.metrics) {
        if (Array.isArray(input.metrics)) {
          for (const m of input.metrics) {
            if (m && m.name && m.name.trim()) {
              metricRecords.push({
                name: m.name.trim(),
                type: m.type === "SUBJECTIVE" ? "SUBJECTIVE" : "OBJECTIVE",
                maxValue: typeof m.maxValue === "number" ? m.maxValue : 5,
              });
            }
          }
        } else if (typeof input.metrics === "object") {
          for (const [key, val] of Object.entries(input.metrics)) {
            if (!val) continue;
            if (typeof val === "object" && val !== null) {
              const v = val as {
                name?: string;
                type?: string;
                maxValue?: number;
                weight?: number;
              };
              const metricName = (v.name || key).trim();
              if (metricName) {
                metricRecords.push({
                  name: metricName,
                  type: v.type === "SUBJECTIVE" ? "SUBJECTIVE" : "OBJECTIVE",
                  maxValue: typeof v.maxValue === "number" ? v.maxValue : 5,
                });
              }
            } else {
              const metricName = key.trim();
              if (metricName) {
                metricRecords.push({
                  name: metricName,
                  type: "OBJECTIVE",
                  maxValue: typeof val === "number" ? val : 5,
                });
              }
            }
          }
        }
      }

      const targetStatus = input.status === "ACTIVE" ? "ACTIVE" : "DRAFT";

      // Si se activa/publica de inmediato (Caso 2), validar todos los campos obligatorios antes de activarla
      if (targetStatus === "ACTIVE") {
        const validationErrors = validateCompetitionForActivation({
          title: input.title,
          description: input.description,
          rules: input.rules,
          fileFormat: input.fileFormat,
          metrics: metricRecords,
          submissionDeadline: input.submissionDeadline,
          votingDeadline: input.votingDeadline,
        });

        if (validationErrors.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `No se puede publicar la competencia: ${validationErrors.join(" ")}`,
          });
        }
      }

      // Ejecutar creación atómica en base de datos asignando el rol de HOST al creador
      const competition = await ctx.prisma.$transaction(async (tx) => {
        const comp = await tx.competition.create({
          data: {
            title: input.title,
            description: input.description,
            rules: input.rules,
            fileFormat: input.fileFormat,
            tags: input.tags ?? [],
            submissionDeadline: input.submissionDeadline,
            votingDeadline: input.votingDeadline,
            status: targetStatus,
          },
        });

        if (metricRecords.length > 0) {
          await tx.metric.createMany({
            data: metricRecords.map((m) => ({
              competitionId: comp.id,
              name: m.name,
              type: m.type,
              maxValue: m.maxValue,
            })),
          });
        }

        await tx.competitionParticipant.create({
          data: {
            userId: hostUser.id,
            competitionId: comp.id,
            role: "HOST",
          },
        });

        return comp;
      });

      return {
        success: true,
        competitionId: competition.id,
        status: competition.status === "ACTIVE" ? ("active" as const) : ("draft" as const),
        id: competition.id,
        title: competition.title,
        host: hostUser.username,
      };
    }),
});
