import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const projectRouter = createTRPCRouter({
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      
        // --- TRUCO TEMPORAL PARA VER UN ID EN LA TERMINAL ---
      const unProyecto = await ctx.prisma.project.findFirst();
      console.log("💡 USA ESTE ID PARA PROBAR:", unProyecto?.id);
      // ----------------------------------------------------

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        include: {
          author: {
            select: { id: true, username: true },
          },
          competition: {
            select: { id: true, title: true },
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
});