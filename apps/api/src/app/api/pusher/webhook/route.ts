import { NextResponse } from "next/server";
import { prisma } from "@devbattle/db";
import {
  getUserChannelName,
  pusherServer,
  triggerPusherEvent,
} from "../../../../server/services/pusher.service";
import { upsertMessageNotification } from "../../../../server/services/notification.service";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    const headers: Record<string, string> = {
      "content-type": req.headers.get("content-type") || "application/json",
      "x-pusher-key": req.headers.get("x-pusher-key") || "",
      "x-pusher-signature": req.headers.get("x-pusher-signature") || "",
    };

    const webhook = pusherServer.webhook({
      headers,
      rawBody,
    });

    if (!webhook.isValid()) {
      return NextResponse.json(
        { error: "Firma de webhook inválida." },
        { status: 401 }
      );
    }

    const events = webhook.getEvents();
    let processedCount = 0;

    for (const event of events) {
      if (event.name === "client_event") {
        let payload: { content?: string; receiverId?: string; senderId?: string } = {};
        try {
          payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        } catch {
          continue;
        }

        const content = payload.content?.trim();
        let receiverId = payload.receiverId?.trim();
        const eventWithUserId = event as typeof event & { user_id?: string };
        let senderId = eventWithUserId.user_id || payload.senderId?.trim();

        if (event.channel.startsWith("private-chat-")) {
          const parts = event.channel.replace("private-chat-", "").split("-");
          if (parts.length >= 2) {
            const [userA, userB] = parts;
            if (senderId && !receiverId) {
              receiverId = senderId === userA ? userB : userA;
            } else if (receiverId && !senderId) {
              senderId = receiverId === userA ? userB : userA;
            }
          }
        }

        if (content && senderId && receiverId) {
          const friendship = await prisma.friendship.findFirst({
            where: {
              status: "ACCEPTED",
              OR: [
                { user1Id: senderId, user2Id: receiverId },
                { user1Id: receiverId, user2Id: senderId },
              ],
            },
          });

          if (friendship) {
            // Verificar si el mensaje ya fue persistido recientemente por la mutacion tRPC
            const recentDuplicate = await prisma.message.findFirst({
              where: {
                senderId,
                receiverId,
                content,
                createdAt: {
                  gte: new Date(Date.now() - 3000),
                },
              },
            });

            if (recentDuplicate) {
              processedCount++;
              continue;
            }

            const savedMessage = await prisma.message.create({
              data: {
                senderId,
                receiverId,
                content,
              },
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

            await triggerPusherEvent(
              event.channel,
              "message-persisted",
              savedMessage
            );

            await triggerPusherEvent(
              getUserChannelName(receiverId),
              "new-message-notification",
              {
                messageId: savedMessage.id,
                senderId: savedMessage.senderId,
                senderUsername: savedMessage.sender.username,
                content: savedMessage.content,
                createdAt: savedMessage.createdAt,
              }
            );

            // Registrar o actualizar notificacion unificada por amigo para no saturar la bandeja
            await upsertMessageNotification({
              senderId,
              senderUsername: savedMessage.sender.username,
              receiverId,
            });

            processedCount++;
          }
        }
      } else if (event.name === "channel_occupied") {
        console.log(`[Pusher Webhook] Canal ocupado: ${event.channel}`);
        processedCount++;
      } else if (event.name === "channel_vacated") {
        console.log(`[Pusher Webhook] Canal desocupado: ${event.channel}`);
        processedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      processedEvents: processedCount,
      totalEvents: events.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno procesando webhook Pusher";
    console.error(`[Pusher Webhook Error] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
