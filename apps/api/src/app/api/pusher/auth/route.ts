import { NextResponse } from "next/server";
import { prisma } from "@devbattle/db";
import { auth } from "../../../../auth";
import { preflight, withCors } from "../../../../server/cors";
import { pusherServer } from "../../../../server/services/pusher.service";

export const OPTIONS = preflight;

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return withCors(
        req,
        NextResponse.json({ error: "No autorizado." }, { status: 401 })
      );
    }

    const currentUserId = session.user.id;

    let socketId: string | null = null;
    let channelName: string | null = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      socketId = formData.get("socket_id") as string | null;
      channelName = formData.get("channel_name") as string | null;
    } else {
      const json = await req.json().catch(() => null);
      if (json) {
        socketId = json.socket_id;
        channelName = json.channel_name;
      }
    }

    if (!socketId || !channelName) {
      return withCors(
        req,
        NextResponse.json(
          { error: "Parámetros socket_id y channel_name requeridos." },
          { status: 400 }
        )
      );
    }

    if (channelName.startsWith("private-user-")) {
      const targetUserId = channelName.replace("private-user-", "");
      if (targetUserId !== currentUserId) {
        return withCors(
          req,
          NextResponse.json(
            { error: "No tienes permiso para acceder a este canal de usuario." },
            { status: 403 }
          )
        );
      }
    } else if (channelName.startsWith("private-chat-")) {
      const parts = channelName.replace("private-chat-", "").split("-");
      if (parts.length < 2) {
        return withCors(
          req,
          NextResponse.json({ error: "Formato de canal inválido." }, { status: 400 })
        );
      }

      const [userA, userB] = parts;
      if (currentUserId !== userA && currentUserId !== userB) {
        return withCors(
          req,
          NextResponse.json(
            { error: "No eres participante de este canal de chat." },
            { status: 403 }
          )
        );
      }

      const otherUserId = currentUserId === userA ? userB : userA;
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { user1Id: currentUserId, user2Id: otherUserId },
            { user1Id: otherUserId, user2Id: currentUserId },
          ],
        },
      });

      if (!friendship) {
        return withCors(
          req,
          NextResponse.json(
            { error: "Solo los amigos pueden suscribirse a este canal de chat." },
            { status: 403 }
          )
        );
      }
    } else {
      return withCors(
        req,
        NextResponse.json(
          { error: "Tipo de canal privado no reconocido." },
          { status: 403 }
        )
      );
    }

    const authResponse = pusherServer.authorizeChannel(socketId, channelName);
    return withCors(req, NextResponse.json(authResponse));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno en autorización Pusher";
    return withCors(
      req,
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}
