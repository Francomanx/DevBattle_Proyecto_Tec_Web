import { prisma } from "@devbattle/db";
import { getUserChannelName, triggerPusherEvent } from "./pusher.service";

interface UpsertMessageNotificationParams {
  senderId: string;
  senderUsername: string;
  receiverId: string;
}

/**
 * Registra o actualiza una notificacion de mensaje para el receptor asegurando
 * que solo exista una unica notificacion no leida por amigo para evitar saturar
 * la bandeja de notificaciones.
 */
export async function upsertMessageNotification({
  senderId,
  senderUsername,
  receiverId,
}: UpsertMessageNotificationParams) {
  const prefix = `Tu amigo @${senderUsername} `;

  // Buscar si ya existe una notificacion no leida de este amigo
  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId: receiverId,
      type: "MESSAGE",
      isRead: false,
      content: {
        startsWith: prefix,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let notification;
  if (existingNotification) {
    // Actualizar la notificacion existente y actualizar la fecha para posicionarla al inicio
    notification = await prisma.notification.update({
      where: { id: existingNotification.id },
      data: {
        content: `Tu amigo @${senderUsername} te ha enviado nuevos mensajes.`,
        createdAt: new Date(),
      },
    });
  } else {
    // Crear una unica notificacion no leida para este amigo
    notification = await prisma.notification.create({
      data: {
        userId: receiverId,
        content: `Tu amigo @${senderUsername} te ha enviado un mensaje.`,
        type: "MESSAGE",
        isRead: false,
      },
    });
  }

  // Notificar al receptor en tiempo real por su canal privado de Pusher
  await triggerPusherEvent(
    getUserChannelName(receiverId),
    "notification-received",
    {
      id: notification.id,
      type: notification.type,
      content: notification.content,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      senderUsername,
      senderId,
    }
  );

  return notification;
}

/**
 * Marca como leidas las notificaciones de mensajes correspondientes a un amigo especifico
 * cuando el usuario abre la conversacion.
 */
export async function markFriendMessageNotificationsAsRead(
  userId: string,
  friendUsername: string
) {
  const prefix = `Tu amigo @${friendUsername} `;

  return prisma.notification.updateMany({
    where: {
      userId,
      type: "MESSAGE",
      isRead: false,
      content: {
        startsWith: prefix,
      },
    },
    data: {
      isRead: true,
    },
  });
}
