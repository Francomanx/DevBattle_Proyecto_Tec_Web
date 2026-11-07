import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { CompetitionStatus } from "@devbattle/db";
import { updateCompetitionStatuses } from "../services/cron.service";

const statusEnum = z.enum(["active", "vote", "completed"]);
const difficulty = z.enum(["EASY", "MEDIUM", "HARD"]);

const listInputSchema = z.object({
  status: statusEnum.optional(),
  format: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(50).default(6),
});

const statusToPrismaMap: Record<"active" | "vote" | "completed", CompetitionStatus> = {
  active: CompetitionStatus.ACTIVE,
  vote: CompetitionStatus.VOTING,
  completed: CompetitionStatus.COMPLETED,
};

export const challengeRouter = createTRPCRouter({
  getAvailableFilters: publicProcedure.query(async ({ ctx }) => {
    const competitions = await ctx.prisma.competition.findMany({
      select: { status: true, fileFormat: true },
    });

    const statusSet = new Set<string>();
    const formatSet = new Set<string>();

    competitions.forEach((c) => {
      if (c.status === CompetitionStatus.ACTIVE) statusSet.add("active");
      else if (c.status === CompetitionStatus.VOTING) statusSet.add("vote");
      else if (c.status === CompetitionStatus.COMPLETED) statusSet.add("completed");

      if (c.fileFormat) {
        c.fileFormat
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean)
          .forEach((f) => formatSet.add(f));
      }
    });

    if (statusSet.size === 0) {
      statusSet.add("active");
      statusSet.add("vote");
      statusSet.add("completed");
    }
    if (formatSet.size === 0) {
      formatSet.add("link");
      formatSet.add("zip");
      formatSet.add("archivo");
    }

    return {
      statuses: Array.from(statusSet),
      formats: Array.from(formatSet),
    };
  }),

  list: publicProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      const prismaStatus = input.status ? statusToPrismaMap[input.status] : undefined;

      const whereCondition = {
        ...(prismaStatus && { status: prismaStatus }),
        ...(input.format && {
          fileFormat: {
            contains: input.format,
            mode: "insensitive" as const,
          },
        }),
      };

      const [totalCount, competitions] = await Promise.all([
        ctx.prisma.competition.count({ where: whereCondition }),
        ctx.prisma.competition.findMany({
          where: whereCondition,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
          include: {
            participants: {
              include: {
                user: {
                  select: { id: true, username: true },
                },
              },
            },
            _count: {
              select: { participants: true, projects: true },
            },
          },
        }),
      ]);

      const formattedChallenges = competitions.map((comp) => {
        let deadline: Date | null = null;
        let frontendStatus: "active" | "vote" | "completed" = "active";

        if (comp.status === CompetitionStatus.ACTIVE) {
          frontendStatus = "active";
          deadline = comp.submissionDeadline;
        } else if (comp.status === CompetitionStatus.VOTING) {
          frontendStatus = "vote";
          deadline = comp.votingDeadline;
        } else if (comp.status === CompetitionStatus.COMPLETED) {
          frontendStatus = "completed";
          deadline = comp.votingDeadline;
        }

        const hostParticipant = comp.participants.find((p) => p.role === "HOST");
        const hostName = hostParticipant?.user.username ?? "DevBattle";

        const parsedFormats = comp.fileFormat
          ? comp.fileFormat
              .split(",")
              .map((f) => f.trim())
              .filter(Boolean)
          : ["link"];

        return {
          id: comp.id,
          title: comp.title,
          description: comp.description,
          difficulty: "MEDIUM" as const,
          status: frontendStatus,
          formats: parsedFormats,
          tags: comp.tags,
          deadline: deadline,
          host: hostName,
          participantCount: comp._count.participants,
        };
      });

      return {
        items: formattedChallenges,
        meta: {
          total: totalCount,
          currentPage: input.page,
          totalPages: Math.ceil(totalCount / input.limit) || 1,
        },
      };
    }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const comp = await ctx.prisma.competition.findUnique({
        where: { id: input.slug },
      });
      if (!comp) throw new TRPCError({ code: "NOT_FOUND" });
      return comp;
    }),

  create: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
        title: z.string().min(1).max(120),
        description: z.string().min(1),
        difficulty: difficulty.default("EASY"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.competition.create({
        data: {
          title: input.title,
          description: input.description,
          rules: "Reglas generales del reto",
          submissionDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          votingDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
    }),

  triggerCronJob: publicProcedure.mutation(async ({ ctx }) => {
    await updateCompetitionStatuses(ctx.prisma);
    return { success: true, message: "Cron job ejecutado manualmente" };
  }),

});