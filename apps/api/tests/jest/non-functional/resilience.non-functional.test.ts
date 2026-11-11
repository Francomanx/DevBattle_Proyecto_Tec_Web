import { computeRanking, average, type RankingMetric, type RankingProject } from "../../../src/server/back/ranking";
import { triggerPusherEvent, pusherServer, getChatChannelName } from "../../../src/server/services/pusher.service";

describe("Pruebas No Funcionales: Resiliencia, Inmutabilidad y Determinismo", () => {
  describe("Tolerancia a Fallos en Servicios Externos (Pusher)", () => {
    it("captura excepciones de red y retorna false sin interrumpir la ejecucion cuando Pusher falla", async () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      jest.spyOn(pusherServer, "trigger").mockRejectedValue(new Error("Connection timeout (ETIMEDOUT)"));

      const result = await triggerPusherEvent("canal-test", "evento-test", { datos: 123 });

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("No se pudo emitir evento")
      );

      consoleWarnSpy.mockRestore();
    });

    it("maneja errores no convencionales (strings o tipos no Error) con fallback seguro", async () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      jest.spyOn(pusherServer, "trigger").mockRejectedValue("Error generico de socket");

      const result = await triggerPusherEvent("canal-test", "evento-test", {});

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error desconocido al emitir evento Pusher")
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("Inmutabilidad de Datos de Entrada", () => {
    it("no muta el arreglo original de proyectos ni sus objetos internos durante el calculo de ranking", () => {
      const metrics: RankingMetric[] = [
        { id: "m1", name: "Metrica A" },
        { id: "m2", name: "Metrica B" },
      ];

      const originalProjects: RankingProject[] = [
        {
          id: "p1",
          title: "Proyecto 1",
          submissionDate: new Date("2026-01-01T10:00:00Z"),
          isDisqualified: false,
          votes: [
            { metricId: "m1", score: 4 },
            { metricId: "m2", score: 5 },
          ],
        },
        {
          id: "p2",
          title: "Proyecto 2",
          submissionDate: new Date("2026-01-02T10:00:00Z"),
          isDisqualified: false,
          votes: [
            { metricId: "m1", score: 3 },
            { metricId: "m2", score: 2 },
          ],
        },
      ];

      const frozenClone = JSON.parse(JSON.stringify(originalProjects));

      computeRanking(originalProjects, metrics);

      // Comprobar que los arreglos y objetos originales no sufrieron mutaciones
      expect(originalProjects).toHaveLength(2);
      expect(originalProjects[0].id).toBe(frozenClone[0].id);
      expect(originalProjects[0].votes).toHaveLength(frozenClone[0].votes.length);
      expect((originalProjects[0] as RankingProject & { position?: number }).position).toBeUndefined();
      expect((originalProjects[0] as RankingProject & { totalScore?: number }).totalScore).toBeUndefined();
    });

    it("no muta el arreglo de metricas provisto", () => {
      const metrics: RankingMetric[] = Object.freeze([
        Object.freeze({ id: "m1", name: "M1" }),
        Object.freeze({ id: "m2", name: "M2" }),
      ]) as unknown as RankingMetric[];

      expect(() => {
        computeRanking(
          [
            {
              id: "p",
              title: "P",
              submissionDate: new Date(),
              isDisqualified: false,
              votes: [],
            },
          ],
          metrics
        );
      }).not.toThrow();
    });
  });

  describe("Determinismo e Idempotencia", () => {
    it("produce resultados estrictamente identicos al ejecutar multiples calculos con las mismas entradas", () => {
      const metrics: RankingMetric[] = [
        { id: "m1", name: "A" },
        { id: "m2", name: "B" },
      ];

      const projects: RankingProject[] = [
        {
          id: "a",
          title: "A",
          submissionDate: new Date("2026-01-01T10:00:00Z"),
          isDisqualified: false,
          votes: [{ metricId: "m1", score: 4 }],
        },
        {
          id: "b",
          title: "B",
          submissionDate: new Date("2026-01-01T11:00:00Z"),
          isDisqualified: false,
          votes: [{ metricId: "m1", score: 4 }],
        },
      ];

      const firstResult = computeRanking(projects, metrics);

      for (let i = 0; i < 50; i++) {
        const nextResult = computeRanking(projects, metrics);
        expect(nextResult).toEqual(firstResult);
      }
    });

    it("mantiene determinismo matematico en la funcion average", () => {
      const sample = [1.5, 2.5, 3.5, 4.5];
      const initialAvg = average(sample);

      for (let i = 0; i < 100; i++) {
        expect(average(sample)).toBe(initialAvg);
      }
    });

    it("mantiene determinismo en la funcion getChatChannelName", () => {
      const u1 = "user-abc-123";
      const u2 = "user-xyz-789";

      const expected = "private-chat-user-abc-123-user-xyz-789";

      for (let i = 0; i < 50; i++) {
        expect(getChatChannelName(u1, u2)).toBe(expected);
        expect(getChatChannelName(u2, u1)).toBe(expected);
      }
    });
  });
});
