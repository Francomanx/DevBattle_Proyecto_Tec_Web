import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const projectRouter = createTRPCRouter({
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        include: {
          author: {
            select: { id: true, username: true },
          },
          competition: {
            select: {
              id: true,
              title: true,
              participants: {
                select: { userId: true, role: true },
              },
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proyecto no encontrado",
        });
      }

      return project;
    }),

  disqualify: publicProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        reason: z
          .string()
          .trim()
          .min(5, "Debes proporcionar un motivo para la descalificación (mínimo 5 caracteres)."),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUserId = ctx.session?.user?.id ?? input.userId;
      if (!currentUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para descalificar un proyecto.",
        });
      }

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          competition: {
            include: {
              participants: true,
            },
          },
          author: {
            select: { id: true, username: true },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proyecto no encontrado.",
        });
      }

      const callerParticipant = project.competition.participants.find(
        (p) => p.userId === currentUserId
      );

      const isHost = callerParticipant?.role === "HOST";
      const isMod = callerParticipant?.role === "MOD";

      if (!isHost && !isMod) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el anfitrión o un moderador de la competencia pueden descalificar proyectos.",
        });
      }

      if (project.isDisqualified) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este proyecto ya se encuentra descalificado.",
        });
      }

      const roleLabel = isHost ? "el anfitrión" : "un moderador";

      const [updatedProject] = await ctx.prisma.$transaction([
        ctx.prisma.project.update({
          where: { id: project.id },
          data: {
            isDisqualified: true,
            disqualificationReason: input.reason,
          },
        }),
        ctx.prisma.notification.create({
          data: {
            userId: project.authorId,
            content: `Tu proyecto "${project.title}" en la competencia "${project.competition.title}" ha sido descalificado por ${roleLabel}. Motivo: "${input.reason}".`,
            type: "DISQUALIFICATION",
          },
        }),
      ]);

      return {
        success: true,
        message: `El proyecto "${project.title}" ha sido descalificado exitosamente.`,
        project: updatedProject,
      };
    }),
});