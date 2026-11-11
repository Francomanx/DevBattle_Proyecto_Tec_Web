import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  getChatChannelName,
  getUserChannelName,
  triggerPusherEvent,
} from "../services/pusher.service";
import {
  upsertMessageNotification,
  markFriendMessageNotificationsAsRead,
} from "../services/notification.service";

export const chatRouter = createTRPCRouter({
  getFriends: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "No autenticado." });
    }

    const friendships = await ctx.prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            description: true,
          },
        },
        user2: {
          select: {
            id: true,
            username: true,
            description: true,
          },
        },
      },
    });

    const friendsWithLastMessage = await Promise.all(
      friendships.map(async (friendship) => {
        const friend = friendship.user1Id === userId ? friendship.user2 : friendship.user1;

        const lastMessage = await ctx.prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: friend.id },
              { senderId: friend.id, receiverId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            content: true,
            senderId: true,
            createdAt: true,
          },
        });

        return {
          id: friend.id,
          username: friend.username,
          description: friend.description,
          lastMessage,
        };
      })
    );

    return friendsWithLastMessage;
  }),

  getFriendRequests: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "No autenticado." });
    }

    const incoming = await ctx.prisma.friendship.findMany({
      where: {
        user2Id: userId,
        status: "PENDING",
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            description: true,
          },
        },
      },
    });

    const outgoing = await ctx.prisma.friendship.findMany({
      where: {
        user1Id: userId,
        status: "PENDING",
      },
      include: {
        user2: {
          select: {
            id: true,
            username: true,
            description: true,
          },
        },
      },
    });

    return {
      incoming: incoming.map((req) => ({
        id: req.user1.id,
        username: req.user1.username,
        description: req.user1.description,
      })),
      outgoing: outgoing.map((req) => ({
        id: req.user2.id,
        username: req.user2.username,
        description: req.user2.description,
      })),
    };
  }),

  sendFriendRequest: protectedProcedure
    .input(
      z.object({
        username: z.string().trim().min(1, "El nombre de usuario es requerido."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUserId = ctx.session?.user?.id;
      if (!currentUserId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No autenticado." });
      }

      const targetUser = await ctx.prisma.user.findUnique({
        where: { username: input.username },
        select: { id: true, username: true },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario no encontrado.",
        });
      }

      if (targetUser.id === currentUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No puedes enviarte una solicitud de amistad a ti mismo.",
        });
      }

      const existingFriendship = await ctx.prisma.friendship.findFirst({
        where: {
          OR: [
            { user1Id: currentUserId, user2Id: targetUser.id },
            { user1Id: targetUser.id, user2Id: currentUserId },
          ],
        },
      });

      if (existingFriendship) {
        if (existingFriendship.status === "ACCEPTED") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Ya son amigos actualmente.",
          });
        }
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya existe una solicitud de amistad pendiente con este usuario.",
        });
      }

      await ctx.prisma.friendship.create({
        data: {
          user1Id: currentUserId,
          user2Id: targetUser.id,
          status: "PENDING",
        },
      });

      await triggerPusherEvent(
        getUserChannelName(targetUser.id),
        "friend-request-received",
        {
          fromId: currentUserId,
          fromUsername: ctx.session?.user?.name ?? "Usuario",
        }
      );

      return {
        success: true,
        message: `Solicitud de amistad enviada a @${targetUser.username}.`,
      };
    }),

  respondFriendRequest: protectedProcedure
    .input(
      z.object({
        requesterId: z.string().min(1),
        action: z.enum(["ACCEPT", "REJECT"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUserId = ctx.session?.user?.id;
      if (!currentUserId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No autenticado." });
      }

      const friendship = await ctx.prisma.friendship.findFirst({
        where: {
          user1Id: input.requesterId,
          user2Id: currentUserId,
          status: "PENDING",
        },
        include: {
          user1: { select: { id: true, username: true } },
        },
      });

      if (!friendship) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No se encontro la solicitud de amistad pendiente.",
        });
      }

      if (input.action === "ACCEPT") {
        await ctx.prisma.friendship.update({
          where: {
            user1Id_user2Id: {
              user1Id: input.requesterId,
              user2Id: currentUserId,
            },
          },
          data: { status: "ACCEPTED" },
        });

        await triggerPusherEvent(
          getUserChannelName(input.requesterId),
          "friend-request-accepted",
          {
            friendId: currentUserId,
            friendUsername: ctx.session?.user?.name ?? "Usuario",
          }
        );

        return {
          success: true,
          message: `Ahora eres amigo de @${friendship.user1.username}.`,
        };
      }

      await ctx.prisma.friendship.delete({
        where: {
          user1Id_user2Id: {
            user1Id: input.requesterId,
            user2Id: currentUserId,
          },
        },
      });

      return {
        success: true,
        message: "Solicitud de amistad rechazada.",
      };
    }),

  getMessages: protectedProcedure
    .input(
      z.object({
        friendId: z.string().min(1),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const currentUserId = ctx.session?.user?.id;
      if (!currentUserId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No autenticado." });
      }

      const friendship = await ctx.prisma.friendship.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { user1Id: currentUserId, user2Id: input.friendId },
            { user1Id: input.friendId, user2Id: currentUserId },
          ],
        },
      });

      if (!friendship) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo puedes ver mensajes con usuarios que sean tus amigos.",
        });
      }

      const messages = await ctx.prisma.message.findMany({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: input.friendId },
            { senderId: input.friendId, receiverId: currentUserId },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: input.limit,
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          content: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              username: true,
            },
          },
          receiver: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      // Mark any unread message notifications from this friend as read when reading messages
      const friendUser = await ctx.prisma.user.findUnique({
        where: { id: input.friendId },
        select: { username: true },
      });
      if (friendUser) {
        await markFriendMessageNotificationsAsRead(currentUserId, friendUser.username);
      }

      return messages;
    }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        receiverId: z.string().min(1),
        content: z.string().trim().min(1, "El mensaje no puede estar vacio.").max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const senderId = ctx.session?.user?.id;
      if (!senderId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No autenticado." });
      }

      const friendship = await ctx.prisma.friendship.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { user1Id: senderId, user2Id: input.receiverId },
            { user1Id: input.receiverId, user2Id: senderId },
          ],
        },
      });

      if (!friendship) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo puedes enviar mensajes a usuarios que sean tus amigos.",
        });
      }

      const message = await ctx.prisma.message.create({
        data: {
          senderId,
          receiverId: input.receiverId,
          content: input.content,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
            },
          },
          receiver: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      const chatChannel = getChatChannelName(senderId, input.receiverId);
      const userChannel = getUserChannelName(input.receiverId);

      await triggerPusherEvent(chatChannel, "new-message", message);
      await triggerPusherEvent(userChannel, "new-message-notification", {
        messageId: message.id,
        senderId: message.senderId,
        senderUsername: message.sender?.username ?? "Usuario",
        content: message.content,
        createdAt: message.createdAt,
      });

      // Registrar o actualizar notificacion unificada por amigo para no saturar la bandeja
      await upsertMessageNotification({
        senderId,
        senderUsername: message.sender?.username ?? "Usuario",
        receiverId: input.receiverId,
      });

      return message;
    }),
});
