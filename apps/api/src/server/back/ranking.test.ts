import { describe, expect, it } from "vitest";
import { average, computeRanking, type RankingMetric, type RankingProject } from "./ranking";
import { getCompetitionRanking, type RankingDb } from "./ranking.service";

const metrics: RankingMetric[] = [
  { id: "m1", name: "Optimización" },
  { id: "m2", name: "Rejugabilidad" },
  { id: "m3", name: "Legibilidad" },
];

const votes = (m1: number[], m2: number[], m3: number[]) => [
  ...m1.map((score) => ({ metricId: "m1", score })),
  ...m2.map((score) => ({ metricId: "m2", score })),
  ...m3.map((score) => ({ metricId: "m3", score })),
];

const project = (id: string, date: string, v: RankingProject["votes"], isDisqualified = false) => ({
  id,
  title: `Proyecto ${id}`,
  submissionDate: new Date(date),
  isDisqualified,
  votes: v,
});

const fakeDb = (competition: Awaited<ReturnType<RankingDb["competition"]["findUnique"]>>): RankingDb => ({
  competition: { findUnique: async () => competition },
});

describe("promedios", () => {
  it("votos 4 y 2 dan promedio 3", () => {
    expect(average([4, 2])).toBe(3);
  });

  it("sin votos el promedio es 0", () => {
    expect(average([])).toBe(0);
  });

  it("ejemplo del enunciado suma 12.5", () => {
    const [entry] = computeRanking(
      [project("p1", "2026-01-01", votes([3, 5], [5, 5], [2, 5]))],
      metrics,
    );
    expect(entry.metrics.map((m) => m.average)).toEqual([4, 5, 3.5]);
    expect(entry.totalScore).toBe(12.5);
  });
});

describe("computeRanking", () => {
  it("ordena de mayor a menor puntaje", () => {
    const ranking = computeRanking(
      [
        project("bajo", "2026-01-01", votes([1], [1], [1])),
        project("alto", "2026-01-02", votes([5], [5], [5])),
        project("medio", "2026-01-03", votes([3], [3], [3])),
      ],
      metrics,
    );
    expect(ranking.map((r) => r.projectId)).toEqual(["alto", "medio", "bajo"]);
    expect(ranking.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it("en empate gana el proyecto enviado primero", () => {
    const ranking = computeRanking(
      [
        project("tarde", "2026-01-05T10:00:00Z", votes([4], [4], [4])),
        project("temprano", "2026-01-05T09:00:00Z", votes([4], [4], [4])),
      ],
      metrics,
    );
    expect(ranking.map((r) => r.projectId)).toEqual(["temprano", "tarde"]);
  });

  it("excluye los proyectos descalificados", () => {
    const ranking = computeRanking(
      [
        project("ok", "2026-01-01", votes([1], [1], [1])),
        project("dq", "2026-01-02", votes([5], [5], [5]), true),
      ],
      metrics,
    );
    expect(ranking.map((r) => r.projectId)).toEqual(["ok"]);
  });

  it("no incluye proyectos descalificados en las posiciones del ranking", () => {
    const ranking = computeRanking(
      [
        project("dq", "2026-01-01", votes([5], [5], [5]), true),
        project("ok", "2026-01-02", votes([3], [3], [3])),
      ],
      metrics,
    );

    expect(ranking.map((entry) => [entry.projectId, entry.position])).toEqual([
      ["ok", 1],
    ]);
  });
});

describe("getCompetitionRanking", () => {
  const completed = (projects: RankingProject[]) => ({
    id: "c1",
    title: "Competencia",
    status: "COMPLETED",
    metrics,
    projects,
  });

  it("devuelve el ranking de una competencia con votos", async () => {
    const result = await getCompetitionRanking(
      fakeDb(
        completed([
          project("a", "2026-01-01", votes([1], [1], [1])),
          project("b", "2026-01-02", votes([5], [5], [5])),
        ]),
      ),
      "c1",
    );
    expect(result.hasVotes).toBe(true);
    expect(result.message).toBeNull();
    expect(result.ranking.map((r) => r.projectId)).toEqual(["b", "a"]);
  });

  it("el ranking devuelto por la competencia omite proyectos descalificados", async () => {
    const result = await getCompetitionRanking(
      fakeDb(
        completed([
          project("dq", "2026-01-01", votes([5], [5], [5]), true),
          project("ok", "2026-01-02", votes([3], [3], [3])),
        ]),
      ),
      "c1",
    );

    expect(result.ranking.map((entry) => entry.projectId)).toEqual(["ok"]);
    expect(result.hasVotes).toBe(true);
  });

  it("sin votos todos tienen 0 puntos y se avisa", async () => {
    const result = await getCompetitionRanking(
      fakeDb(
        completed([project("a", "2026-01-02", []), project("b", "2026-01-01", [])]),
      ),
      "c1",
    );
    expect(result.hasVotes).toBe(false);
    expect(result.message).toBeTruthy();
    expect(result.ranking.map((r) => [r.projectId, r.totalScore])).toEqual([
      ["b", 0],
      ["a", 0],
    ]);
  });

  it("falla si la competencia no está completed", async () => {
    const db = fakeDb({ ...completed([]), status: "VOTING" });
    await expect(getCompetitionRanking(db, "c1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("falla si la competencia no existe", async () => {
    await expect(getCompetitionRanking(fakeDb(null), "nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
