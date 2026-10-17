import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const statusEnum = z.enum(["active", "vote", "completed"]);
const difficulty = z.enum(["EASY", "MEDIUM", "HARD"]);

const listInputSchema = z.object({
  status: statusEnum.optional(),
  format: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(50).default(6),
});

export const challengeRouter = createTRPCRouter({

  getAvailableFilters: publicProcedure.query(async ({ ctx }) => {
    const existingStatuses = await ctx.prisma.challenge.findMany({
      select: { status: true },
      distinct: ['status'],
    });

    const existingFormats = await ctx.prisma.format.findMany({
      select: { name: true },
      distinct: ['name'],
    });

    return {
      statuses: existingStatuses.map((s) => s.status),
      formats: existingFormats.map((f) => f.name),
    };
  }),

  list: publicProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      
      const whereCondition = {
        ...(input.status && { status: input.status }),
        ...(input.format && { formats: { some: { name: input.format } } }),
      };

      const [totalCount, challenges] = await Promise.all([
        ctx.prisma.challenge.count({ where: whereCondition }),
        ctx.prisma.challenge.findMany({
          where: whereCondition,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
          include: {
            formats: { select: { name: true } },
          },
        }),
      ]);

      const formattedChallenges = challenges.map((challenge) => {
        let deadline = null;
        if (challenge.status === "active") deadline = challenge.activeDeadLine;
        else if (challenge.status === "vote") deadline = challenge.voteDeadLine;
        else if (challenge.status === "completed") deadline = challenge.completedAt;

        return {
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          difficulty: challenge.difficulty,
          status: challenge.status,
          formats: challenge.formats.map((f) => f.name),
          deadline: deadline,
          
          host: "Host Pendiente", 
          participantCount: 120, 
        };
      });

      return {
        items: formattedChallenges,
        meta: {
          total: totalCount,
          currentPage: input.page,
          totalPages: Math.ceil(totalCount / input.limit),
        },
      };
    }),

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
      })
    )
    .mutation(({ ctx, input }) => 
      ctx.prisma.challenge.create({ 
        data: {
          ...input,
          hostId: "host-temporal-123",
        } 
      })
    ),
});