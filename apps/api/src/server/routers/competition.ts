import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const competitionStatus = z.enum([
  "DRAFT",
  "ACTIVE",
  "VOTING",
  "COMPLETED"
]);

export function validateCompetitionForActivation(competition: {
  title?: string | null;
  description?: string | null;
  rules?: string | null;
  fileFormat?: string | null;
  metrics?: Array<{ name: string; maxValue?: number; weight?: number }> | null;
  submissionDeadline?: Date | null;
  votingDeadline?: Date | null;
}): string[] {
  const errors: string[] = [];

  if (!competition.title || !competition.title.trim()) {
    errors.push("El título de la competencia no puede estar vacío.");
  }
  if (!competition.description || competition.description.trim().length < 150) {
    errors.push("La descripción debe tener al menos 150 caracteres.");
  }
  if (!competition.rules || !competition.rules.trim()) {
    errors.push("Debes especificar las reglas y restricciones.");
  }
  if (!competition.fileFormat || !competition.fileFormat.trim()) {
    errors.push("Debes seleccionar al menos un formato de recepción.");
  }
  if (!competition.metrics || competition.metrics.length === 0) {
    errors.push("Debes definir al menos una métrica de evaluación.");
  } else {
    const validMetrics = competition.metrics.filter(
      (m) => m.name && m.name.trim().length > 0
    );
    if (validMetrics.length === 0) {
      errors.push("Debes definir al menos una métrica de evaluación con su nombre.");
    } else {
      const totalWeight = validMetrics.reduce((sum, m) => sum + (Number(m.weight) || 0), 0);
      if (totalWeight > 0 && totalWeight !== 100) {
        errors.push(`La suma de las ponderaciones de las métricas debe ser exactamente 100% (actualmente suma ${totalWeight}%).`);
      }
    }
  }

  if (
    !competition.submissionDeadline ||
    isNaN(new Date(competition.submissionDeadline).getTime())
  ) {
    errors.push("Debes definir la fecha límite de recepción de soluciones.");
  }
  if (
    !competition.votingDeadline ||
    isNaN(new Date(competition.votingDeadline).getTime())
  ) {
    errors.push("Debes definir la fecha límite de votación.");
  }

  if (
    competition.submissionDeadline &&
    competition.votingDeadline &&
    !isNaN(new Date(competition.submissionDeadline).getTime()) &&
    !isNaN(new Date(competition.votingDeadline).getTime())
  ) {
    const subTime = new Date(competition.submissionDeadline).getTime();
    const voteTime = new Date(competition.votingDeadline).getTime();
    if (subTime >= voteTime) {
      errors.push(
        "La fecha límite de votación debe ser posterior a la fecha límite de recepción de proyectos."
      );
    }
  }

  return errors;
}

export const competitionRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ status: competitionStatus.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const targetStatus = input?.status;
      const whereCondition: Record<string, unknown> = {};

      if (targetStatus) {
        whereCondition.status = targetStatus;
        if (targetStatus === "DRAFT") {
          const currentUserId = ctx.session?.user?.id;
          if (currentUserId) {
            whereCondition.participants = {
              some: {
                userId: currentUserId,
                role: "HOST",
              },
            };
          } else {
            whereCondition.id = "no-drafts-for-guests";
          }
        }
      } else {
        whereCondition.status = { in: ["ACTIVE", "VOTING", "COMPLETED"] };
      }

      return ctx.prisma.competition.findMany({
        where: whereCondition,
        include: {
          metrics: true,
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
    .input(z.object({ id: z.string().min(1), userId: z.string().optional() }))
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

      // Proteger el acceso a competencias en estado DRAFT:
      // Solo el host de la competencia creada tiene permiso para acceder a su detalle.
      if (competition.status === "DRAFT") {
        const currentUserId = ctx.session?.user?.id ?? input.userId;
        const hostParticipant = competition.participants.find((p) => p.role === "HOST");

        let isHost = false;
        if (currentUserId && hostParticipant) {
          if (
            hostParticipant.userId === currentUserId ||
            hostParticipant.user.username === currentUserId
          ) {
            isHost = true;
          } else {
            const reqUser = await ctx.prisma.user.findFirst({
              where: {
                OR: [{ id: currentUserId }, { username: currentUserId }],
              },
            });
            if (reqUser && hostParticipant.userId === reqUser.id) {
              isHost = true;
            }
          }
        }

        if (!isHost) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Solo el host de la competencia puede acceder al detalle de una competencia en estado borrador.",
          });
        }
      }

      return competition;
    }),

  activate: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const targetUserId = ctx.session?.user?.id ?? input.userId;
      if (!targetUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para activar la competencia.",
        });
      }

      const competition = await ctx.prisma.competition.findUnique({
        where: { id: input.id },
        include: {
          metrics: true,
          participants: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!competition) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Competencia no encontrada.",
        });
      }

      if (competition.status === "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La competencia ya se encuentra activa.",
        });
      }

      if (competition.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No se puede activar una competencia en estado ${competition.status}.`,
        });
      }

      // Validar que el usuario que activa sea el HOST de la competencia
      const hostParticipant = competition.participants.find(
        (p) => p.role === "HOST"
      );

      let isHost = false;
      if (hostParticipant) {
        if (
          hostParticipant.userId === targetUserId ||
          hostParticipant.user.username === targetUserId
        ) {
          isHost = true;
        } else {
          const reqUser = await ctx.prisma.user.findFirst({
            where: {
              OR: [{ id: targetUserId }, { username: targetUserId }],
            },
          });
          if (reqUser && hostParticipant.userId === reqUser.id) {
            isHost = true;
          }
        }
      }

      if (!isHost) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el host de la competencia puede activarla.",
        });
      }

      // Validar que la competencia tenga todos los campos obligatorios completos antes de activarla
      const validationErrors = validateCompetitionForActivation(competition);
      if (validationErrors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No se puede activar la competencia: ${validationErrors.join(" ")}`,
        });
      }

      const updated = await ctx.prisma.competition.update({
        where: { id: input.id },
        data: {
          status: "ACTIVE",
        },
      });

      const modParticipants = competition.participants.filter((p) => p.role === "MOD");
      if (modParticipants.length > 0) {
        await ctx.prisma.notification.createMany({
          data: modParticipants.map((mod) => ({
            userId: mod.userId,
            content: `La competencia "${competition.title}" en la que eres moderador ha sido activada y se encuentra abierta.`,
            type: "STATE_CHANGE",
          })),
        });
      }

      return {
        success: true,
        competitionId: updated.id,
        status: updated.status,
        title: updated.title,
        message: "Competencia activada con éxito.",
      };
    }),

  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1, "El título no puede estar vacío").max(150),
        description: z.string().min(150, "La descripción debe tener al menos 150 caracteres"),
        rules: z.string().min(1, "Las reglas no pueden estar vacías"),
        fileFormat: z.string().optional(),
        tags: z.array(z.string()).optional(),
        submissionDeadline: z.coerce.date(),
        votingDeadline: z.coerce.date(),
        metrics: z
          .union([
            z.record(z.string(), z.any()),
            z.array(
              z.object({
                name: z.string(),
                type: z.enum(["OBJECTIVE", "SUBJECTIVE"]).optional(),
                maxValue: z.number().optional(),
                weight: z.number().optional(),
              })
            ),
          ])
          .optional(),
        userId: z.string().optional(),
        status: z.enum(["DRAFT", "ACTIVE"]).optional().default("DRAFT"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Priorizar la sesión autenticada; permitir input.userId si se proporciona explícitamente
      const targetUserId = ctx.session?.user?.id ?? input.userId;
      if (!targetUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para crear una competencia.",
        });
      }

      let hostUser = await ctx.prisma.user.findUnique({
        where: { id: targetUserId },
      });
      if (!hostUser) {
        hostUser = await ctx.prisma.user.findFirst({
          where: { username: targetUserId },
        });
      }

      if (!hostUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario creador no encontrado.",
        });
      }

      // Preparar métricas asociadas
      const metricRecords: Array<{
        name: string;
        type: "OBJECTIVE" | "SUBJECTIVE";
        maxValue: number;
        weight: number;
      }> = [];

      if (input.metrics) {
        if (Array.isArray(input.metrics)) {
          for (const m of input.metrics) {
            if (m && m.name && m.name.trim()) {
              metricRecords.push({
                name: m.name.trim(),
                type: m.type === "SUBJECTIVE" ? "SUBJECTIVE" : "OBJECTIVE",
                maxValue: typeof m.maxValue === "number" ? m.maxValue : 5,
                weight: typeof m.weight === "number" && m.weight > 0 ? m.weight : 0,
              });
            }
          }
        } else if (typeof input.metrics === "object") {
          for (const [key, val] of Object.entries(input.metrics)) {
            if (!val) continue;
            if (typeof val === "object" && val !== null) {
              const v = val as {
                name?: string;
                type?: string;
                maxValue?: number;
                weight?: number;
              };
              const metricName = (v.name || key).trim();
              if (metricName) {
                metricRecords.push({
                  name: metricName,
                  type: v.type === "SUBJECTIVE" ? "SUBJECTIVE" : "OBJECTIVE",
                  maxValue: typeof v.maxValue === "number" ? v.maxValue : 5,
                  weight: typeof v.weight === "number" && v.weight > 0 ? v.weight : 0,
                });
              }
            } else {
              const metricName = key.trim();
              if (metricName) {
                metricRecords.push({
                  name: metricName,
                  type: "OBJECTIVE",
                  maxValue: typeof val === "number" ? val : 5,
                  weight: 0,
                });
              }
            }
          }
        }
      }

      // Si las métricas no traen peso o suman 0, distribuir 100% equitativamente
      const currentTotalWeight = metricRecords.reduce((sum, m) => sum + m.weight, 0);
      if (metricRecords.length > 0 && currentTotalWeight === 0) {
        const base = Math.floor(100 / metricRecords.length);
        const remainder = 100 - base * metricRecords.length;
        metricRecords.forEach((m, idx) => {
          m.weight = base + (idx === 0 ? remainder : 0);
        });
      }

      const targetStatus = input.status === "ACTIVE" ? "ACTIVE" : "DRAFT";

      // Si se activa/publica de inmediato (Caso 2), validar todos los campos obligatorios antes de activarla
      if (targetStatus === "ACTIVE") {
        const validationErrors = validateCompetitionForActivation({
          title: input.title,
          description: input.description,
          rules: input.rules,
          fileFormat: input.fileFormat,
          metrics: metricRecords,
          submissionDeadline: input.submissionDeadline,
          votingDeadline: input.votingDeadline,
        });

        if (validationErrors.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `No se puede publicar la competencia: ${validationErrors.join(" ")}`,
          });
        }
      }

      // Ejecutar creación atómica en base de datos asignando el rol de HOST al creador
      const competition = await ctx.prisma.$transaction(async (tx) => {
        const comp = await tx.competition.create({
          data: {
            title: input.title,
            description: input.description,
            rules: input.rules,
            fileFormat: input.fileFormat,
            tags: input.tags ?? [],
            submissionDeadline: input.submissionDeadline,
            votingDeadline: input.votingDeadline,
            status: targetStatus,
          },
        });

        if (metricRecords.length > 0) {
          await tx.metric.createMany({
            data: metricRecords.map((m) => ({
              competitionId: comp.id,
              name: m.name,
              type: m.type,
              maxValue: m.maxValue,
              weight: m.weight,
            })),
          });
        }

        await tx.competitionParticipant.create({
          data: {
            userId: hostUser.id,
            competitionId: comp.id,
            role: "HOST",
          },
        });

        return comp;
      });

      return {
        success: true,
        competitionId: competition.id,
        status: competition.status === "ACTIVE" ? ("active" as const) : ("draft" as const),
        id: competition.id,
        title: competition.title,
        host: hostUser.username,
      };
    }),

  getLeaderboard: publicProcedure
    .input(z.object({ competitionId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const competition = await ctx.prisma.competition.findUnique({
        where: { id: input.competitionId },
        include: {
          metrics: true,
          participants: {
            include: { user: { select: { id: true, username: true } } },
          },
          projects: {
            where: { isDisqualified: false },
            include: {
              author: { select: { id: true, username: true } },
              votes: {
                include: {
                  metric: true,
                },
              },
            },
          },
        },
      });

      if (!competition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Competencia no encontrada" });
      }

      const now = new Date();
      const isVotingClosed =
        competition.status === "COMPLETED" ||
        now.getTime() >= new Date(competition.votingDeadline).getTime();

      // Si la fecha límite de votación aún no finaliza, no se calcula ni expone el TOP
      if (!isVotingClosed) {
        return {
          competitionId: competition.id,
          competitionTitle: competition.title,
          status: competition.status,
          metrics: competition.metrics,
          isVotingClosed: false,
          votingDeadline: competition.votingDeadline,
          leaderboard: [],
          message:
            "La fecha límite de votación aún no ha finalizado. El TOP y cálculo de puntajes se realizará al concluir la votación.",
        };
      }

      // Si la votación ya finalizó, sincronizamos el estado en base de datos si estaba en ACTIVE/VOTING
      if (competition.status !== "COMPLETED" && competition.status !== "DRAFT") {
        await ctx.prisma.competition.update({
          where: { id: competition.id },
          data: { status: "COMPLETED" },
        });
        competition.status = "COMPLETED";
      }

      // Suma total de ponderación para normalizar
      const totalWeight =
        competition.metrics.reduce((acc, m) => acc + (m.weight || 0), 0) || 100;

      // Identificar jurados oficiales (HOST y MOD)
      const jurorUserIds = new Set(
        competition.participants
          .filter((p) => p.role === "HOST" || p.role === "MOD")
          .map((p) => p.userId)
      );

      // Calcular puntuación ponderada para cada proyecto
      const rankedProjects = competition.projects.map((project) => {
        // Separar votos del jurado si existen
        const jurorVotes = project.votes.filter((v) => jurorUserIds.has(v.voterId));
        const effectiveVotes = jurorVotes.length > 0 ? jurorVotes : project.votes;

        const metricBreakdown: Array<{
          metricId: string;
          name: string;
          weight: number;
          averageScore: number;
          weightedScore: number;
          voteCount: number;
        }> = [];

        let totalWeightedScore = 0;

        for (const metric of competition.metrics) {
          const metricVotes = effectiveVotes.filter((v) => v.metricId === metric.id);
          const avgScore =
            metricVotes.length > 0
              ? metricVotes.reduce((sum, v) => sum + v.score, 0) / metricVotes.length
              : 0;

          const weightNormalized = (metric.weight || 0) / totalWeight;
          const weightedScore = avgScore * weightNormalized;

          totalWeightedScore += weightedScore;

          metricBreakdown.push({
            metricId: metric.id,
            name: metric.name,
            weight: metric.weight,
            averageScore: Math.round(avgScore * 100) / 100,
            weightedScore: Math.round(weightedScore * 100) / 100,
            voteCount: metricVotes.length,
          });
        }

        const scoreOutOf100 = Math.round((totalWeightedScore / 5) * 1000) / 10;
        const scoreOutOf5 = Math.round(totalWeightedScore * 100) / 100;

        return {
          projectId: project.id,
          title: project.title,
          description: project.description,
          author: project.author,
          submissionDate: project.submissionDate,
          scoreOutOf5,
          scoreOutOf100,
          totalVotes: effectiveVotes.length,
          hasJurorVotes: jurorVotes.length > 0,
          metricBreakdown,
        };
      });

      // Orden descendente por puntaje; en empate, fecha de entrega más temprana
      rankedProjects.sort((a, b) => {
        if (b.scoreOutOf100 !== a.scoreOutOf100) {
          return b.scoreOutOf100 - a.scoreOutOf100;
        }
        return new Date(a.submissionDate).getTime() - new Date(b.submissionDate).getTime();
      });

      const leaderboard = rankedProjects.map((p, idx) => ({
        rank: idx + 1,
        ...p,
      }));

      return {
        competitionId: competition.id,
        competitionTitle: competition.title,
        status: competition.status,
        metrics: competition.metrics,
        isVotingClosed: true,
        votingDeadline: competition.votingDeadline,
        leaderboard,
      };
    }),

  searchCandidateMods: publicProcedure
    .input(
      z.object({
        competitionId: z.string().min(1),
        query: z.string().trim().max(80),
        limit: z.number().min(1).max(20).optional().default(6),
      })
    )
    .query(async ({ ctx, input }) => {
      const cleanQuery = input.query.replace(/^@+/, "").trim();
      if (!cleanQuery) return [];

      const competition = await ctx.prisma.competition.findUnique({
        where: { id: input.competitionId },
        include: {
          participants: {
            include: { user: { select: { id: true, username: true } } },
          },
          modInvitations: {
            where: { status: "PENDING" },
            include: { invitedUser: { select: { id: true, username: true } } },
          },
        },
      });

      if (!competition) return [];

      const hostParticipant = competition.participants.find((p) => p.role === "HOST");
      const modUserIds = new Set(
        competition.participants
          .filter((p) => p.role === "MOD")
          .map((p) => p.userId)
      );
      const pendingInvitedUserIds = new Set(
        competition.modInvitations.map((inv) => inv.invitedUserId)
      );

      const users = await ctx.prisma.user.findMany({
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

      return users.map((u) => ({
        id: u.id,
        username: u.username,
        description: u.description,
        isHost: hostParticipant?.userId === u.id,
        isMod: modUserIds.has(u.id),
        isPendingInvite: pendingInvitedUserIds.has(u.id),
      }));
    }),

  inviteMod: publicProcedure
    .input(
      z.object({
        competitionId: z.string().min(1),
        username: z.string().trim().min(1),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUserId = ctx.session?.user?.id ?? input.userId;
      if (!currentUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para invitar moderadores.",
        });
      }

      const competition = await ctx.prisma.competition.findUnique({
        where: { id: input.competitionId },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!competition) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Competencia no encontrada.",
        });
      }

      const hostParticipant = competition.participants.find((p) => p.role === "HOST");
      let isHost = false;
      let hostUser = null;
      if (hostParticipant) {
        if (
          hostParticipant.userId === currentUserId ||
          hostParticipant.user.username === currentUserId
        ) {
          isHost = true;
          hostUser = hostParticipant.user;
        } else {
          const reqUser = await ctx.prisma.user.findFirst({
            where: {
              OR: [{ id: currentUserId }, { username: currentUserId }],
            },
          });
          if (reqUser && hostParticipant.userId === reqUser.id) {
            isHost = true;
            hostUser = reqUser;
          }
        }
      }

      if (!isHost || !hostUser) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el host de la competencia puede invitar moderadores.",
        });
      }

      const targetUsername = input.username.replace(/^@+/, "").trim();
      if (!targetUsername) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ingresa un nombre de usuario válido.",
        });
      }

      const targetUser = await ctx.prisma.user.findFirst({
        where: {
          username: {
            equals: targetUsername,
            mode: "insensitive",
          },
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `El usuario @${targetUsername} no existe.`,
        });
      }

      if (targetUser.id === hostUser.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No puedes invitarte a ti mismo como moderador.",
        });
      }

      const existingParticipant = competition.participants.find(
        (p) => p.userId === targetUser.id
      );

      if (existingParticipant?.role === "MOD") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `El usuario @${targetUser.username} ya es moderador de esta competencia.`,
        });
      }

      if (existingParticipant?.role === "HOST") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `El usuario @${targetUser.username} es el host de esta competencia.`,
        });
      }

      const existingInvitation = await ctx.prisma.modInvitation.findUnique({
        where: {
          competitionId_invitedUserId: {
            competitionId: competition.id,
            invitedUserId: targetUser.id,
          },
        },
      });

      if (existingInvitation && existingInvitation.status === "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ya existe una solicitud pendiente enviada a @${targetUser.username}.`,
        });
      }

      const invitation = await ctx.prisma.modInvitation.upsert({
        where: {
          competitionId_invitedUserId: {
            competitionId: competition.id,
            invitedUserId: targetUser.id,
          },
        },
        update: {
          status: "PENDING",
          inviterId: hostUser.id,
        },
        create: {
          competitionId: competition.id,
          inviterId: hostUser.id,
          invitedUserId: targetUser.id,
          status: "PENDING",
        },
        include: {
          invitedUser: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      await ctx.prisma.notification.create({
        data: {
          userId: targetUser.id,
          content: `El host @${hostUser.username} te ha enviado una solicitud para ser Moderador en la competencia "${competition.title}".`,
          type: "MESSAGE",
        },
      });

      return {
        success: true,
        message: `Solicitud de moderador enviada exitosamente a @${targetUser.username}.`,
        invitation,
      };
    }),

  getModInvitations: publicProcedure
    .input(
      z.object({
        competitionId: z.string().min(1),
        userId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const invitations = await ctx.prisma.modInvitation.findMany({
        where: { competitionId: input.competitionId },
        include: {
          invitedUser: {
            select: {
              id: true,
              username: true,
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
      });

      return invitations;
    }),

  cancelModInvitation: publicProcedure
    .input(
      z.object({
        invitationId: z.string().min(1),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUserId = ctx.session?.user?.id ?? input.userId;
      if (!currentUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para cancelar solicitudes.",
        });
      }

      const invitation = await ctx.prisma.modInvitation.findUnique({
        where: { id: input.invitationId },
        include: {
          competition: {
            include: {
              participants: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Solicitud no encontrada.",
        });
      }

      const hostParticipant = invitation.competition.participants.find(
        (p) => p.role === "HOST"
      );

      let isHost = false;
      if (hostParticipant) {
        if (
          hostParticipant.userId === currentUserId ||
          hostParticipant.userId === ctx.session?.user?.id
        ) {
          isHost = true;
        } else {
          const reqUser = await ctx.prisma.user.findFirst({
            where: {
              OR: [{ id: currentUserId }, { username: currentUserId }],
            },
          });
          if (reqUser && hostParticipant.userId === reqUser.id) {
            isHost = true;
          }
        }
      }

      if (!isHost && invitation.inviterId !== currentUserId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el host puede cancelar la solicitud.",
        });
      }

      await ctx.prisma.modInvitation.delete({
        where: { id: input.invitationId },
      });

      await ctx.prisma.notification.create({
        data: {
          userId: invitation.invitedUserId,
          content: `La solicitud para ser moderador en la competencia "${invitation.competition.title}" ha sido cancelada por el anfitrión.`,
          type: "MOD_REMOVAL",
        },
      });

      return {
        success: true,
        message: "Solicitud cancelada con éxito.",
      };
    }),

  respondModInvitation: publicProcedure
    .input(
      z.object({
        invitationId: z.string().min(1),
        accept: z.boolean(),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUserId = ctx.session?.user?.id ?? input.userId;
      if (!currentUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para responder la solicitud.",
        });
      }

      const invitation = await ctx.prisma.modInvitation.findUnique({
        where: { id: input.invitationId },
        include: {
          competition: true,
          invitedUser: true,
          inviter: true,
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Solicitud no encontrada.",
        });
      }

      const isTargetUser =
        invitation.invitedUserId === currentUserId ||
        invitation.invitedUser.username === currentUserId;

      if (!isTargetUser) {
        const reqUser = await ctx.prisma.user.findFirst({
          where: {
            OR: [{ id: currentUserId }, { username: currentUserId }],
          },
        });
        if (!reqUser || reqUser.id !== invitation.invitedUserId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No tienes permiso para responder a esta solicitud.",
          });
        }
      }

      if (invitation.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Esta solicitud ya ha sido ${invitation.status === "ACCEPTED" ? "aceptada" : "rechazada"}.`,
        });
      }

      if (input.accept) {
        await ctx.prisma.$transaction([
          ctx.prisma.modInvitation.update({
            where: { id: invitation.id },
            data: { status: "ACCEPTED" },
          }),
          ctx.prisma.competitionParticipant.upsert({
            where: {
              userId_competitionId: {
                userId: invitation.invitedUserId,
                competitionId: invitation.competitionId,
              },
            },
            update: {
              role: "MOD",
            },
            create: {
              userId: invitation.invitedUserId,
              competitionId: invitation.competitionId,
              role: "MOD",
            },
          }),
          ctx.prisma.notification.create({
            data: {
              userId: invitation.inviterId,
              content: `@${invitation.invitedUser.username} ha aceptado la solicitud para ser moderador en "${invitation.competition.title}".`,
              type: "MESSAGE",
            },
          }),
        ]);

        return {
          success: true,
          status: "ACCEPTED",
          message: `Has aceptado la solicitud. Ahora eres moderador en la competencia "${invitation.competition.title}".`,
        };
      } else {
        await ctx.prisma.$transaction([
          ctx.prisma.modInvitation.update({
            where: { id: invitation.id },
            data: { status: "REJECTED" },
          }),
          ctx.prisma.notification.create({
            data: {
              userId: invitation.inviterId,
              content: `@${invitation.invitedUser.username} ha rechazado la solicitud para ser moderador en "${invitation.competition.title}".`,
              type: "MESSAGE",
            },
          }),
        ]);

        return {
          success: true,
          status: "REJECTED",
          message: `Has rechazado la solicitud para ser moderador en la competencia "${invitation.competition.title}".`,
        };
      }
    }),
});
