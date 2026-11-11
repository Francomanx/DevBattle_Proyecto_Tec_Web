import { average, computeRanking, type RankingMetric, type RankingProject } from "../../../src/server/back/ranking";
import { getCompetitionRanking, type RankingDb } from "../../../src/server/back/ranking.service";

describe("Pruebas Funcionales: Motor de Evaluacion y Ranking", () => {
  const metrics: RankingMetric[] = [
    { id: "m1", name: "Optimizacion" },
    { id: "m2", name: "Rejugabilidad" },
    { id: "m3", name: "Legibilidad" },
  ];

  const buildVotes = (m1: number[], m2: number[], m3: number[]) => [
    ...m1.map((score) => ({ metricId: "m1", score })),
    ...m2.map((score) => ({ metricId: "m2", score })),
    ...m3.map((score) => ({ metricId: "m3", score })),
  ];

  const buildProject = (
    id: string,
    submissionDate: string,
    votes: RankingProject["votes"],
    isDisqualified = false,
  ): RankingProject => ({
    id,
    title: `Proyecto ${id}`,
    submissionDate: new Date(submissionDate),
    isDisqualified,
    votes,
  });

  const fakeDb = (competition: Awaited<ReturnType<RankingDb["competition"]["findUnique"]>>): RankingDb => ({
    competition: { findUnique: async () => competition },
  });

  describe("Calculo de Promedios por Metrica", () => {
    it("calcula correctamente el promedio aritmetico con multiples votos", () => {
      expect(average([4, 2])).toBe(3);
      expect(average([5, 5, 5])).toBe(5);
      expect(average([1, 2, 3, 4, 5])).toBe(3);
    });

    it("retorna 0 si el arreglo de votos esta vacio", () => {
      expect(average([])).toBe(0);
    });

    it("mantiene la precision con decimales", () => {
      const avg = average([2, 5]);
      expect(avg).toBe(3.5);
    });
  });

  describe("Ordenamiento y Desempates en Ranking", () => {
    it("ordena proyectos de mayor a menor puntaje acumulado asignando posiciones secuenciales", () => {
      const pBajo = buildProject("bajo", "2026-01-01", buildVotes([1], [1], [1]));
      const pAlto = buildProject("alto", "2026-01-02", buildVotes([5], [5], [5]));
      const pMedio = buildProject("medio", "2026-01-03", buildVotes([3], [3], [3]));

      const ranking = computeRanking([pBajo, pAlto, pMedio], metrics);

      expect(ranking.map((r) => r.projectId)).toEqual(["alto", "medio", "bajo"]);
      expect(ranking.map((r) => r.position)).toEqual([1, 2, 3]);
      expect(ranking[0].totalScore).toBe(15);
      expect(ranking[1].totalScore).toBe(9);
      expect(ranking[2].totalScore).toBe(3);
    });

    it("aplica criterio de desempate por fecha de envio mas temprana ante puntajes identicos", () => {
      const pTarde = buildProject("tarde", "2026-01-05T12:00:00Z", buildVotes([4], [4], [4]));
      const pTemprano = buildProject("temprano", "2026-01-05T08:00:00Z", buildVotes([4], [4], [4]));

      const ranking = computeRanking([pTarde, pTemprano], metrics);

      expect(ranking.map((r) => r.projectId)).toEqual(["temprano", "tarde"]);
      expect(ranking[0].position).toBe(1);
      expect(ranking[1].position).toBe(2);
    });

    it("excluye de forma estricta los proyectos descalificados", () => {
      const pAprobado = buildProject("valido", "2026-01-01", buildVotes([2], [2], [2]), false);
      const pDescalificado = buildProject("tramposo", "2026-01-01", buildVotes([5], [5], [5]), true);

      const ranking = computeRanking([pAprobado, pDescalificado], metrics);

      expect(ranking).toHaveLength(1);
      expect(ranking[0].projectId).toBe("valido");
      expect(ranking.some((r) => r.projectId === "tramposo")).toBe(false);
    });
  });

  describe("Servicio de Consulta getCompetitionRanking", () => {
    it("retorna el ranking de una competencia completada con votos", async () => {
      const db = fakeDb({
        id: "comp-1",
        title: "Torneo Web",
        status: "COMPLETED",
        metrics,
        projects: [
          buildProject("p1", "2026-01-01", buildVotes([2], [2], [2])),
          buildProject("p2", "2026-01-02", buildVotes([4], [4], [4])),
        ],
      });

      const res = await getCompetitionRanking(db, "comp-1");

      expect(res.hasVotes).toBe(true);
      expect(res.message).toBeNull();
      expect(res.ranking[0].projectId).toBe("p2");
      expect(res.ranking[1].projectId).toBe("p1");
    });

    it("informa adecuadamente si la competencia finalizo sin votos registrados", async () => {
      const db = fakeDb({
        id: "comp-sin-votos",
        title: "Torneo Desierto",
        status: "COMPLETED",
        metrics,
        projects: [
          buildProject("p1", "2026-01-02", []),
          buildProject("p2", "2026-01-01", []),
        ],
      });

      const res = await getCompetitionRanking(db, "comp-sin-votos");

      expect(res.hasVotes).toBe(false);
      expect(res.message).toContain("no recibió votos");
      expect(res.ranking.every((r) => r.totalScore === 0)).toBe(true);
    });

    it("lanza error PRECONDITION_FAILED si la competencia aun esta en fase de votacion (VOTING)", async () => {
      const db = fakeDb({
        id: "comp-voting",
        title: "Torneo en Votacion",
        status: "VOTING",
        metrics,
        projects: [],
      });

      await expect(getCompetitionRanking(db, "comp-voting")).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
    });

    it("lanza error NOT_FOUND si la competencia consultada no existe", async () => {
      const db = fakeDb(null);

      await expect(getCompetitionRanking(db, "comp-inexistente")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });
});
