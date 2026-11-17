import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const authorSelect = {
  id: true,
  username: true,
} as const;

export const commentRouter = createTRPCRouter({
  listByProject: publicProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.comment.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
        include: { author: { select: authorSelect } },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        content: z
          .string()
          .trim()
          .min(1, "El comentario no puede estar vacío.")
          .max(500, "El comentario no puede superar los 500 caracteres."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Debes iniciar sesión" });
      }

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "El proyecto especificado no existe.",
        });
      }

      return ctx.prisma.comment.create({
        data: {
          projectId: input.projectId,
          authorId: userId,
          content: input.content,
        },
        include: { author: { select: authorSelect } },
      });
    }),
});
