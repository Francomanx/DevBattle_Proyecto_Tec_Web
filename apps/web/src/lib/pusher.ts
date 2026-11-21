import Pusher from "pusher-js";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

let currentPusherUserId: string | null = null;
let pusherClientInstance: Pusher | null = null;

export function getPusherClient(userId?: string): Pusher {
  // If a specific userId is provided and differs from the current instance owner, reset
  if (userId && currentPusherUserId !== userId) {
    resetPusherClient();
    currentPusherUserId = userId;
  }

  if (!pusherClientInstance) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY || "devbattle-key";
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2";

    pusherClientInstance = new Pusher(key, {
      cluster,
      channelAuthorization: {
        endpoint: `${getApiBaseUrl()}/api/pusher/auth`,
        transport: "ajax",
      },
    });
  }

  return pusherClientInstance;
}

export function resetPusherClient(): void {
  if (pusherClientInstance) {
    try {
      pusherClientInstance.disconnect();
    } catch {
      // Ignorar errores al desconectar
    }
    pusherClientInstance = null;
  }
  currentPusherUserId = null;
}

export function getChatChannelName(userIdA: string, userIdB: string): string {
  const sortedIds = [userIdA, userIdB].sort();
  return `private-chat-${sortedIds[0]}-${sortedIds[1]}`;
}

export function getUserChannelName(userId: string): string {
  return `private-user-${userId}`;
}
