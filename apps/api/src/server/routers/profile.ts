//archivo relacionado a la vista de perfil de usuario
import { TRPCError } from "@trpc/server";
import { compare, hash } from "bcryptjs";
//zod valida el nombre de usuario que envia la pagina
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
//con esto podemos consultar y obtener la informacion del perfil de suuario sin iniciar sesion
const passwordChangeFieldsSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
  confirmPassword: z.string().min(8).max(72),
});
type PasswordChangeFields = z.infer<typeof passwordChangeFieldsSchema>;

const passwordsMatch = (input: PasswordChangeFields) =>
  input.newPassword === input.confirmPassword;
const passwordMismatchMessage = {
  path: ["confirmPassword"],
  message: "Las contraseñas no coinciden.",
};

const changePasswordInputSchema = passwordChangeFieldsSchema
  .refine(passwordsMatch, passwordMismatchMessage);

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

      const isOwner = ctx.session?.user?.id === user.id;

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

  updateProfile: protectedProcedure
    .input(
      z.object({
        username: z.string().trim().min(3).max(30),
        description: z.string().trim().max(500).nullable(),
        githubUrl: z
          .union([
            z
              .string()
              .trim()
              .url()
              .refine((value) => {
                const url = new URL(value);
                return (
                  url.protocol === "https:" &&
                  ["github.com", "www.github.com"].includes(url.hostname)
                );
              }, "Ingresa una URL válida de GitHub."),
            z.literal(""),
          ])
          .nullable()
          .transform((value) => value || null),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const duplicate = await ctx.prisma.user.findFirst({
        where: {
          username: { equals: input.username, mode: "insensitive" },
          NOT: { id: userId },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ese nombre de usuario ya está en uso.",
        });
      }

      try {
        return await ctx.prisma.user.update({
          where: { id: userId },
          data: {
            username: input.username,
            description: input.description || null,
            githubUrl: input.githubUrl,
          },
          select: {
            id: true,
            username: true,
            description: true,
            githubUrl: true,
          },
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Ese nombre de usuario ya está en uso.",
          });
        }
        throw error;
      }
    }),

  changePassword: protectedProcedure
    .input(changePasswordInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario no encontrado.",
        });
      }

      if (!(await compare(input.currentPassword, user.passwordHash))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La contraseña actual es incorrecta.",
        });
      }

      const passwordHash = await hash(input.newPassword, 12);
      await ctx.prisma.$transaction(async (transaction) => {
        await transaction.user.update({
          where: { id: userId },
          data: { passwordHash },
        });
        await transaction.notification.create({
          data: {
            userId,
            content: "Tu contraseña ha sido actualizada exitosamente.",
            type: "MESSAGE",
          },
        });
      });

      return { success: true };
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