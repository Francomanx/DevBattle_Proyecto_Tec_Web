import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const notificationRouter = createTRPCRouter({
  getUnreadCount: publicProcedure
    .input(
      z
        .object({
          userId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const targetUserId = ctx.session?.user?.id ?? input?.userId;
      if (!targetUserId) {
        return {
          total: 0,
          unreadNotifications: 0,
          pendingInvitations: 0,
        };
      }

      const [unreadNotifications, pendingInvitations] = await Promise.all([
        ctx.prisma.notification.count({
          where: {
            userId: targetUserId,
            isRead: false,
          },
        }),
        ctx.prisma.modInvitation.count({
          where: {
            invitedUserId: targetUserId,
            status: "PENDING",
          },
        }),
      ]);

      return {
        total: unreadNotifications + pendingInvitations,
        unreadNotifications,
        pendingInvitations,
      };
    }),

  list: publicProcedure
    .input(
      z
        .object({
          userId: z.string().optional(),
          limit: z.number().min(1).max(50).optional().default(20),
          filter: z.enum(["all", "unread", "invitations"]).optional().default("all"),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const targetUserId = ctx.session?.user?.id ?? input?.userId;
      if (!targetUserId) {
        return {
          notifications: [],
          pendingInvitations: [],
          unreadCount: 0,
        };
      }

      const filter = input?.filter ?? "all";
      const limit = input?.limit ?? 20;

      const [notifications, pendingInvitations, unreadCount] = await Promise.all([
        filter === "invitations"
          ? []
          : ctx.prisma.notification.findMany({
              where: {
                userId: targetUserId,
                ...(filter === "unread" ? { isRead: false } : {}),
              },
              orderBy: { createdAt: "desc" },
              take: limit,
            }),
        filter === "unread"
          ? []
          : ctx.prisma.modInvitation.findMany({
              where: {
                invitedUserId: targetUserId,
                status: "PENDING",
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
            }),
        ctx.prisma.notification.count({
          where: {
            userId: targetUserId,
            isRead: false,
          },
        }),
      ]);

      return {
        notifications,
        pendingInvitations,
        unreadCount: unreadCount + pendingInvitations.length,
      };
    }),

  markAsRead: publicProcedure
    .input(
      z.object({
        id: z.string().optional(),
        all: z.boolean().optional(),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const targetUserId = ctx.session?.user?.id ?? input.userId;
      if (!targetUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para marcar notificaciones como leídas.",
        });
      }

      if (input.all) {
        const result = await ctx.prisma.notification.updateMany({
          where: {
            userId: targetUserId,
            isRead: false,
          },
          data: {
            isRead: true,
          },
        });
        return {
          success: true,
          markedCount: result.count,
        };
      }

      if (!input.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debes especificar el ID de la notificación o indicar 'all: true'.",
        });
      }

      const notification = await ctx.prisma.notification.findFirst({
        where: {
          id: input.id,
          userId: targetUserId,
        },
      });

      if (!notification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notificación no encontrada.",
        });
      }

      await ctx.prisma.notification.update({
        where: { id: input.id },
        data: { isRead: true },
      });

      return {
        success: true,
        markedCount: 1,
      };
    }),

  delete: publicProcedure
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
          message: "Debes iniciar sesión para eliminar notificaciones.",
        });
      }

      const notification = await ctx.prisma.notification.findFirst({
        where: {
          id: input.id,
          userId: targetUserId,
        },
      });

      if (!notification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notificación no encontrada.",
        });
      }

      await ctx.prisma.notification.delete({
        where: { id: input.id },
      });

      return {
        success: true,
        message: "Notificación eliminada correctamente.",
      };
    }),
});
