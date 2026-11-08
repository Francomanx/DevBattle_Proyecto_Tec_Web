//archivo relacionado a la vista de perfil de usuario
import { TRPCError } from "@trpc/server";
//zod valida el nombre de usuario que envia la pagina
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
//con esto podemos consultar y obtener la informacion del perfil de suuario sin iniciar sesion
export const profileRouter = createTRPCRouter({
  byUsername: publicProcedure
    .input(
      z.object({
        username: z.string().trim().min(1).max(80),
        currentUserId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { username: input.username },
        select: {
          id: true,
          username: true,
          description: true,
          githubUrl: true,
          competitionParticipants: {
            where: {
              role: {
                in: ["HOST", "DEV", "MOD"],
              },
            },
            select: {
              role: true,
              competition: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                },
              },
            },
          },
          projects: {
            orderBy: {
              submissionDate: "desc",
            },
            select: {
              id: true,
              title: true,
              competitionId: true,
              competition: {
                select: {
                  title: true,
                  fileFormat: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario no encontrado",
        });
      }

      const isOwner =
        ctx.session?.user?.id === user.id ||
        input.currentUserId === user.id ||
        input.currentUserId === user.username;

      const hostedCompetitions = user.competitionParticipants
        .filter((participation) => participation.role === "HOST")
        .map((participation) => participation.competition)
        .filter((comp) => isOwner || comp.status !== "DRAFT");

      const devCompetitions = user.competitionParticipants
        .filter((participation) => participation.role === "DEV")
        .map((participation) => participation.competition)
        .filter((comp) => isOwner || comp.status !== "DRAFT");

      const modCompetitions = user.competitionParticipants
        .filter((participation) => participation.role === "MOD")
        .map((participation) => participation.competition)
        .filter((comp) => isOwner || comp.status !== "DRAFT");

      const receivedModInvitations = isOwner
        ? await ctx.prisma.modInvitation.findMany({
            where: {
              invitedUserId: user.id,
            },
            include: {
              competition: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                },
              },
              inviter: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : [];

      const notifications = isOwner
        ? await ctx.prisma.notification.findMany({
            where: {
              userId: user.id,
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          })
        : [];

      return {
        user: {
          id: user.id,
          username: user.username,
          description: user.description,
          githubUrl: user.githubUrl,
        },
        stats: {
          hostedCompetitions: hostedCompetitions.length,
          devCompetitions: devCompetitions.length,
          modCompetitions: modCompetitions.length,
        },
        hostedCompetitions,
        devCompetitions,
        modCompetitions,
        receivedModInvitations,
        notifications,
        projects: user.projects.map((project) => ({
          id: project.id,
          title: project.title,
          competitionId: project.competitionId,
          competitionTitle: project.competition.title,
          fileFormat: project.competition.fileFormat,
        })),
      };
    }),

  searchUsers: publicProcedure
    .input(
      z.object({
        query: z.string().trim().max(80),
        limit: z.number().min(1).max(20).optional().default(8),
      })
    )
    .query(async ({ ctx, input }) => {
      const cleanQuery = input.query.replace(/^@+/, "").trim();
      if (!cleanQuery) return [];

      return ctx.prisma.user.findMany({
        where: {
          username: {
            contains: cleanQuery,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          username: true,
          description: true,
        },
        take: input.limit,
        orderBy: { username: "asc" },
      });
    }),
});