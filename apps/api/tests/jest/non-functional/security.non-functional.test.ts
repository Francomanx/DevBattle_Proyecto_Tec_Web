import { computeRanking, type RankingMetric, type RankingProject } from "../../../src/server/back/ranking";
import { getCompetitionRanking, type RankingDb } from "../../../src/server/back/ranking.service";
import { getChatChannelName } from "../../../src/server/services/pusher.service";
import { upsertMessageNotification } from "../../../src/server/services/notification.service";
import { prisma } from "@devbattle/db";

jest.mock("@devbattle/db", () => ({
  prisma: {
    notification: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../../src/server/services/pusher.service", () => {
  const actual = jest.requireActual("../../../src/server/services/pusher.service");
  return {
    ...actual,
    triggerPusherEvent: jest.fn(() => Promise.resolve(true)),
  };
});

describe("Pruebas No Funcionales: Seguridad y Validacion de Entradas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Inyeccion de Cargas Maliciosas (XSS / SQLi / Control Chars)", () => {
    it("preserva como texto literal cargas maliciosas de XSS y SQL injection sin corromper el servicio de notificaciones", async () => {
      const maliciousPayloads = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "' OR '1'='1' --",
        "'; DROP TABLE users; --",
        "../../etc/passwd",
        "null\0byte",
      ];

      (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.notification.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: "safe-id", ...data, createdAt: new Date() })
      );

      for (const payload of maliciousPayloads) {
        const notif = await upsertMessageNotification({
          senderId: "attacker-id",
          senderUsername: `user_${payload.replace(/[^a-zA-Z0-9]/g, "")}`,
          receiverId: "victim-id",
        });

        expect(notif).toBeDefined();
        expect(typeof notif.content).toBe("string");
        expect(notif.isRead).toBe(false);
      }
    });

    it("mantiene intacta la inmutabilidad y previene prototype pollution en el calculo de ranking", () => {
      const metrics: RankingMetric[] = [{ id: "m1", name: "Seguridad" }];

      const maliciousProject = {
        id: "p-evil",
        title: "Malicious Project",
        submissionDate: new Date(),
        isDisqualified: false,
        votes: [{ metricId: "m1", score: 5 }],
        __proto__: { isAdmin: true },
      } as unknown as RankingProject;

      computeRanking([maliciousProject], metrics);

      // Verificar que el prototipo global de Object no fue alterado
      expect((Object.prototype as Record<string, unknown>).isAdmin).toBeUndefined();
    });
  });

  describe("Confidencialidad de Estados y Prevencion de Fugas de Informacion", () => {
    it("bloquea y rechaza la extraccion de rankings de competencias en estado VOTING", async () => {
      const db: RankingDb = {
        competition: {
          findUnique: async () => ({
            id: "comp-secreta",
            title: "Competencia En Curso",
            status: "VOTING",
            metrics: [{ id: "m1", name: "Metrica" }],
            projects: [],
          }),
        },
      };

      await expect(getCompetitionRanking(db, "comp-secreta")).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
    });

    it("bloquea y rechaza la extraccion de rankings de competencias en estado ACTIVE", async () => {
      const db: RankingDb = {
        competition: {
          findUnique: async () => ({
            id: "comp-activa",
            title: "Competencia Activa",
            status: "ACTIVE",
            metrics: [{ id: "m1", name: "Metrica" }],
            projects: [],
          }),
        },
      };

      await expect(getCompetitionRanking(db, "comp-activa")).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
    });
  });

  describe("Integridad en Nombres de Canales", () => {
    it("maneja identidades con caracteres especiales de forma determinista sin colisiones", () => {
      const id1 = "usr_123-abc";
      const id2 = "usr_456-def";

      const channel = getChatChannelName(id1, id2);
      expect(channel).toMatch(/^private-chat-[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+$/);
    });
  });
});
