//archivo relacionado a la vista de perfil de usuario
import { TRPCError } from "@trpc/server";
import { hash } from "bcryptjs";
//zod valida el nombre de usuario que envia la pagina
import { z } from "zod";
import {
  createPasswordChangeCode,
  passwordChangeCodeMatches,
  sendPasswordChangeCodeEmail,
} from "../password-change";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
//con esto podemos consultar y obtener la informacion del perfil de suuario sin iniciar sesion
const passwordChangeFieldsSchema = z.object({
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

const requestPasswordChangeCodeInputSchema = passwordChangeFieldsSchema.refine(
  passwordsMatch,
  passwordMismatchMessage
);
const changePasswordInputSchema = passwordChangeFieldsSchema
  .extend({
    code: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos."),
  })
  .refine(passwordsMatch, passwordMismatchMessage);

export const profileRouter = createTRPCRouter({
  byUsername: publicProcedure
    .input(
      z.object({
        username: z.string().trim().min(1).max(80),
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

  requestPasswordChangeCode: protectedProcedure
    .input(requestPasswordChangeCodeInputSchema)
    .mutation(async ({ ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado." });
      }

      if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "El envío de correo no está configurado en el servidor.",
        });
      }

      const now = new Date();
      const latestCode = await ctx.prisma.passwordChangeCode.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      if (latestCode && now.getTime() - latestCode.createdAt.getTime() < 60_000) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Espera un minuto antes de solicitar otro código.",
        });
      }

      const { code, codeHash } = createPasswordChangeCode(userId);
      await ctx.prisma.passwordChangeCode.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: now },
      });

      const codeRecord = await ctx.prisma.passwordChangeCode.create({
        data: {
          userId,
          codeHash,
          expiresAt: new Date(now.getTime() + 10 * 60_000),
        },
        select: { id: true },
      });

      try {
        await sendPasswordChangeCodeEmail(user.email, code);
      } catch (error) {
        await ctx.prisma.passwordChangeCode.update({
          where: { id: codeRecord.id },
          data: { consumedAt: new Date() },
        });
        console.error("Could not send password-change code email:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo enviar el código. Inténtalo más tarde.",
        });
      }

      return { success: true, expiresInSeconds: 600 };
    }),

  changePassword: protectedProcedure
    .input(changePasswordInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const now = new Date();
      const codeRecord = await ctx.prisma.passwordChangeCode.findFirst({
        where: {
          userId,
          consumedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: 5 },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!codeRecord) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El código es inválido o expiró. Solicita uno nuevo.",
        });
      }

      if (!passwordChangeCodeMatches(userId, input.code, codeRecord.codeHash)) {
        const nextAttempts = codeRecord.attempts + 1;
        await ctx.prisma.passwordChangeCode.updateMany({
          where: {
            id: codeRecord.id,
            consumedAt: null,
            attempts: { lt: 5 },
          },
          data: {
            attempts: { increment: 1 },
            ...(nextAttempts >= 5 ? { consumedAt: now } : {}),
          },
        });

        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            nextAttempts >= 5
              ? "Se agotaron los intentos. Solicita un nuevo código."
              : "El código ingresado no es válido.",
        });
      }

      const passwordHash = await hash(input.newPassword, 12);
      await ctx.prisma.$transaction(async (transaction) => {
        const consumed = await transaction.passwordChangeCode.updateMany({
          where: {
            id: codeRecord.id,
            userId,
            consumedAt: null,
            expiresAt: { gt: new Date() },
            attempts: { lt: 5 },
          },
          data: { consumedAt: new Date() },
        });

        if (consumed.count !== 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "El código es inválido o expiró. Solicita uno nuevo.",
          });
        }

        await transaction.user.update({
          where: { id: userId },
          data: { passwordHash },
        });
        await transaction.passwordChangeCode.updateMany({
          where: { userId, id: { not: codeRecord.id }, consumedAt: null },
          data: { consumedAt: new Date() },
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