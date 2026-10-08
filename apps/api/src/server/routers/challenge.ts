import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const difficulty = z.enum(["EASY", "MEDIUM", "HARD"]);

export const challengeRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ difficulty: difficulty.optional() }).optional())
    .query(({ ctx, input }) =>
      ctx.prisma.challenge.findMany({
        where: { difficulty: input?.difficulty },
        orderBy: { createdAt: "desc" },
      }),
    ),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const challenge = await ctx.prisma.challenge.findUnique({
        where: { slug: input.slug },
      });
      if (!challenge) throw new TRPCError({ code: "NOT_FOUND" });
      return challenge;
    }),

  create: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
        title: z.string().min(1).max(120),
        description: z.string().min(1),
        difficulty: difficulty.default("EASY"),
      }),
    )
    .mutation(({ ctx, input }) => ctx.prisma.challenge.create({ data: input })),
});
