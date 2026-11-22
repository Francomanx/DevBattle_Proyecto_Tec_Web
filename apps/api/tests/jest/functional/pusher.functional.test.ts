import {
  getChatChannelName,
  getUserChannelName,
  triggerPusherEvent,
  pusherServer,
} from "../../../src/server/services/pusher.service";

describe("Pruebas Funcionales: Canales y Mensajeria Pusher", () => {
  describe("Generacion Determinista de Canales", () => {
    it("genera el mismo nombre de canal privado de chat independientemente del orden de los identificadores", () => {
      const channel1 = getChatChannelName("user-alpha", "user-beta");
      const channel2 = getChatChannelName("user-beta", "user-alpha");

      expect(channel1).toBe(channel2);
      expect(channel1).toBe("private-chat-user-alpha-user-beta");
    });

    it("ordena alfanumericamente los IDs de usuarios para garantizar consistencia", () => {
      const channel = getChatChannelName("z-user-999", "a-user-001");
      expect(channel).toBe("private-chat-a-user-001-z-user-999");
    });

    it("genera el canal privado personal con el prefijo correcto", () => {
      const userChannel = getUserChannelName("usuario-12345");
      expect(userChannel).toBe("private-user-usuario-12345");
    });
  });
  describe("Emision de Eventos Pusher", () => {
    it("emite exitosamente el evento y retorna true cuando Pusher responde correctamente", async () => {
      jest
        .spyOn(pusherServer, "trigger")
        .mockResolvedValue({} as unknown as Awaited<ReturnType<typeof pusherServer.trigger>>);

      const result = await triggerPusherEvent("private-chat-a-b", "new-message", {
        id: "msg-1",
        content: "Hola mundo",
      });

      expect(result).toBe(true);
      expect(pusherServer.trigger).toHaveBeenCalledWith(
        "private-chat-a-b",
        "new-message",
        expect.objectContaining({ content: "Hola mundo" })
      );
    });
  });
});
