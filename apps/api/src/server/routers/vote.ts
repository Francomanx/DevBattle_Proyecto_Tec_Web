import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const voteRouter = createTRPCRouter({
  voteForProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        scores: z.array(
          z.object({
            metricId: z.string().min(1),
            score: z.number().int().min(1).max(5),
          })
        ).min(1, "Debes enviar al menos una calificación"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          competition: {
            include: {
              metrics: true, 
            },
          },
          votes: {
            where: {
              voterId: userId,
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "El proyecto especificado no existe.",
        });
      }

      if (project.competition.status !== "VOTING") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "La competencia no se encuentra en periodo de votación.",
        });
      }

      if (project.isDisqualified) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "El proyecto ha sido descalificado y no puede recibir votos.",
        });
      }

      if (project.authorId === userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No puedes votar por tu propio proyecto.",
        });
      }

      if (project.votes.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya has emitido un voto para este proyecto previamente.",
        });
      }

      const competitionMetricIds = project.competition.metrics.map((m) => m.id);
      const inputMetricIds = input.scores.map((s) => s.metricId);

      if (
        competitionMetricIds.length !== inputMetricIds.length ||
        !competitionMetricIds.every((id) => inputMetricIds.includes(id))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debes asignar una calificación para todas y cada una de las métricas de la competencia.",
        });
      }

      const votesToInsert = input.scores.map((scoreObj) => ({
        projectId: input.projectId,
        metricId: scoreObj.metricId,
        voterId: userId,
        score: scoreObj.score,
      }));

      await ctx.prisma.vote.createMany({
        data: votesToInsert,
      });

      return {
        success: true,
        message: "¡Voto registrado exitosamente!",
        count: votesToInsert.length,
      };
    }),
});