import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const competitionStatus = z.enum([
  "DRAFT",
  "ACTIVE",
  "VOTING",
  "COMPLETED"
]);

export const competitionRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ status: competitionStatus.optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.competition.findMany({
        where: { status: input?.status },
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
    .input(z.object({ id: z.string().min(1) }))
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

      return competition;
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
            status: "DRAFT",
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
        status: "draft" as const,
        id: competition.id,
        title: competition.title,
        host: hostUser.username,
      };
    }),
});
