import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { CompetitionStatus, MetricType } from "@devbattle/db";
import { updateCompetitionStatuses } from "../services/cron.service";

const statusEnum = z.enum(["active", "vote", "completed"]);
const difficulty = z.enum(["EASY", "MEDIUM", "HARD"]);

const listInputSchema = z.object({
  status: statusEnum.optional(),
  format: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(50).default(6),
});

const metricInputSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(MetricType),
  maxValue: z.number().positive(),
  weight: z.number().min(0),
});

const editCompetitionSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(120).optional(),
  description: z.string().min(1).optional(),
  rules: z.string().optional(),
  fileFormat: z.string().optional(),
  tags: z.array(z.string()).optional(),
  submissionDeadline: z.date().optional(),
  votingDeadline: z.date().optional(),
  metrics: z.array(metricInputSchema).optional(),
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

  edit: protectedProcedure
    .input(editCompetitionSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Debes iniciar sesión" });
      }

      const competition = await ctx.prisma.competition.findUnique({
        where: { id: input.id },
        include: {
          participants: {
            where: { userId: userId, role: "HOST" },
          },
        },
      });

      if (!competition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Competencia no encontrada" });
      }
      if (competition.participants.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acceso denegado: No eres el host de esta competencia" });
      }

      const { status } = competition;

      if (status === CompetitionStatus.COMPLETED) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No se puede editar una competencia finalizada" });
      }

      const isTitleChanged = input.title !== undefined && input.title !== competition.title;
      const isRulesChanged = input.rules !== undefined && input.rules !== competition.rules;
      const isFormatChanged = input.fileFormat !== undefined && input.fileFormat !== competition.fileFormat;
      const isTagsChanged = input.tags !== undefined && JSON.stringify(input.tags) !== JSON.stringify(competition.tags);
      const isSubDateChanged = input.submissionDeadline !== undefined && input.submissionDeadline.getTime() !== competition.submissionDeadline.getTime();
      const isMetricsChanged = input.metrics !== undefined;

      if (status === CompetitionStatus.ACTIVE) {
        if (isTitleChanged || isRulesChanged || isFormatChanged || isTagsChanged) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "En estado ACTIVE solo puedes modificar descripción, métricas y fechas.",
          });
        }
      }

      if (status === CompetitionStatus.VOTING) {
        if (
          isTitleChanged ||
          isRulesChanged ||
          isFormatChanged ||
          isTagsChanged ||
          isSubDateChanged ||
          isMetricsChanged
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "En estado VOTING solo puedes modificar la descripción y la fecha de votación.",
          });
        }
      }

      const newSubDate = input.submissionDeadline ?? competition.submissionDeadline;
      const newVoteDate = input.votingDeadline ?? competition.votingDeadline;

      if (newVoteDate <= newSubDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La fecha de votación debe ser estrictamente posterior a la de recepción.",
        });
      }

      if (input.metrics && input.metrics.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Debe haber al menos una métrica definida." });
      }

      const isVoteDateChanged =
        input.votingDeadline !== undefined &&
        input.votingDeadline.getTime() !== competition.votingDeadline.getTime();

      const updatedCompetition = await ctx.prisma.competition.update({
        where: { id: input.id },
        data: {
          title: input.title,
          description: input.description,
          rules: input.rules,
          fileFormat: input.fileFormat,
          tags: input.tags,
          submissionDeadline: input.submissionDeadline,
          votingDeadline: input.votingDeadline,
          ...(input.metrics && {
            metrics: {
              deleteMany: {},
              create: input.metrics.map((m) => ({
                name: m.name,
                type: m.type,
                maxValue: m.maxValue,
                weight: m.weight,
              })),
            },
          }),
        },
        include: {
          metrics: true,
        },
      });

      if (
        (status === CompetitionStatus.ACTIVE || status === CompetitionStatus.VOTING) &&
        (isSubDateChanged || isVoteDateChanged || isMetricsChanged)
      ) {
        const otherParticipants = await ctx.prisma.competitionParticipant.findMany({
          where: {
            competitionId: updatedCompetition.id,
            userId: { not: userId },
          },
          select: { userId: true },
        });

        if (otherParticipants.length > 0) {
          let changeDetail = "las fechas";
          if (isMetricsChanged && (isSubDateChanged || isVoteDateChanged)) {
            changeDetail = "las fechas y criterios de evaluación";
          } else if (isMetricsChanged) {
            changeDetail = "las métricas de evaluación";
          }

          await ctx.prisma.notification.createMany({
            data: otherParticipants.map((p) => ({
              userId: p.userId,
              content: `Se han actualizado ${changeDetail} de la competencia "${updatedCompetition.title}".`,
              type: "STATE_CHANGE",
            })),
          });
        }
      }

      return updatedCompetition;
    }),

});