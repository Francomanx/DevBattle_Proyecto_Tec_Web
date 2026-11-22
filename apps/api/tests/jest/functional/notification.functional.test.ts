import {
  upsertMessageNotification,
  markFriendMessageNotificationsAsRead,
} from "../../../src/server/services/notification.service";
import { prisma } from "@devbattle/db";
import * as pusherService from "../../../src/server/services/pusher.service";

jest.mock("@devbattle/db", () => ({
  prisma: {
    notification: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("../../../src/server/services/pusher.service", () => ({
  getUserChannelName: jest.fn((id: string) => `private-user-${id}`),
  triggerPusherEvent: jest.fn(() => Promise.resolve(true)),
}));

describe("Pruebas Funcionales: Consolidacion de Notificaciones de Mensajeria", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("crea una unica notificacion no leida cuando un amigo envia su primer mensaje", async () => {
    (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.notification.create as jest.Mock).mockResolvedValue({
      id: "notif-1",
      userId: "user-receiver",
      content: "Tu amigo @matias te ha enviado un mensaje.",
      type: "MESSAGE",
      isRead: false,
      createdAt: new Date(),
    });

    const result = await upsertMessageNotification({
      senderId: "user-sender-1",
      senderUsername: "matias",
      receiverId: "user-receiver",
    });

    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-receiver",
          type: "MESSAGE",
          isRead: false,
          content: {
            startsWith: "Tu amigo @matias ",
          },
        },
      })
    );
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-receiver",
        content: "Tu amigo @matias te ha enviado un mensaje.",
        type: "MESSAGE",
        isRead: false,
      },
    });
    expect(prisma.notification.update).not.toHaveBeenCalled();
    expect(pusherService.triggerPusherEvent).toHaveBeenCalledWith(
      "private-user-user-receiver",
      "notification-received",
      expect.objectContaining({
        id: "notif-1",
        senderUsername: "matias",
      })
    );
    expect(result.content).toBe("Tu amigo @matias te ha enviado un mensaje.");
  });

  it("actualiza la notificacion existente y no crea una nueva si el amigo envia multiples mensajes (anti-saturacion)", async () => {
    const existingNotif = {
      id: "notif-existente",
      userId: "user-receiver",
      content: "Tu amigo @matias te ha enviado un mensaje.",
      type: "MESSAGE",
      isRead: false,
      createdAt: new Date("2026-01-01T10:00:00Z"),
    };

    (prisma.notification.findFirst as jest.Mock).mockResolvedValue(existingNotif);
    (prisma.notification.update as jest.Mock).mockResolvedValue({
      ...existingNotif,
      content: "Tu amigo @matias te ha enviado nuevos mensajes.",
      createdAt: new Date("2026-01-01T10:05:00Z"),
    });

    const result = await upsertMessageNotification({
      senderId: "user-sender-1",
      senderUsername: "matias",
      receiverId: "user-receiver",
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "notif-existente" },
      data: {
        content: "Tu amigo @matias te ha enviado nuevos mensajes.",
        createdAt: expect.any(Date),
      },
    });
    expect(result.content).toBe("Tu amigo @matias te ha enviado nuevos mensajes.");
  });

  it("marca como leidas las notificaciones unicamente del amigo especificado", async () => {
    (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const res = await markFriendMessageNotificationsAsRead("user-receiver", "matias");

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-receiver",
        type: "MESSAGE",
        isRead: false,
        content: {
          startsWith: "Tu amigo @matias ",
        },
      },
      data: {
        isRead: true,
      },
    });
    expect(res.count).toBe(1);
  });
});
