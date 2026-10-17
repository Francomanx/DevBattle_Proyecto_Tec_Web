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
        title: z.string().min(1).max(150),
        description: z.string().min(1),
        rules: z.string().min(1),
        fileFormat: z.string().optional(),
        submissionDeadline: z.coerce.date(),
        votingDeadline: z.coerce.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.competition.create({
        data: {
          ...input,
          status: "ACTIVE",
        },
      });
    }),
});
