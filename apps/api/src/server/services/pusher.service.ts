import Pusher from "pusher";

const appId = process.env.PUSHER_APP_ID || "null";
const key = process.env.PUSHER_KEY || "null";
const secret = process.env.PUSHER_SECRET || "null";
const cluster = process.env.PUSHER_CLUSTER || "null";

export const pusherServer = new Pusher({
  appId,
  key,
  secret,
  cluster,
  useTLS: true,
});

export function getChatChannelName(userIdA: string, userIdB: string): string {
  const sortedIds = [userIdA, userIdB].sort();
  return `private-chat-${sortedIds[0]}-${sortedIds[1]}`;
}

export function getUserChannelName(userId: string): string {
  return `private-user-${userId}`;
}

export async function triggerPusherEvent(
  channel: string,
  event: string,
  data: unknown
): Promise<boolean> {
  try {
    await pusherServer.trigger(channel, event, data);
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido al emitir evento Pusher";
    console.warn(`[Pusher] No se pudo emitir evento "${event}" en canal "${channel}": ${message}`);
    return false;
  }
}
