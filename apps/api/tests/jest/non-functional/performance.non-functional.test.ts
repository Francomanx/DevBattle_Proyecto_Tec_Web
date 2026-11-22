import { computeRanking, type RankingMetric, type RankingProject } from "../../../src/server/back/ranking";

describe("Pruebas No Funcionales: Rendimiento y Escalabilidad (Performance)", () => {
  const metrics: RankingMetric[] = [
    { id: "m1", name: "Optimizacion" },
    { id: "m2", name: "Arquitectura" },
    { id: "m3", name: "Documentacion" },
    { id: "m4", name: "Seguridad" },
    { id: "m5", name: "Usabilidad" },
  ];

  it("calcula el ranking de 1,000 proyectos con 5 metricas en menos de 50 milisegundos", () => {
    const projectCount = 1000;
    const baseDate = new Date("2026-01-01T00:00:00Z").getTime();

    const projects: RankingProject[] = Array.from({ length: projectCount }, (_, i) => ({
      id: `proj-${i}`,
      title: `Proyecto de prueba ${i}`,
      submissionDate: new Date(baseDate + i * 1000),
      isDisqualified: i % 50 === 0, // 20 proyectos descalificados
      votes: [
        { metricId: "m1", score: ((i * 3) % 5) + 1 },
        { metricId: "m2", score: ((i * 7) % 5) + 1 },
        { metricId: "m3", score: ((i * 11) % 5) + 1 },
        { metricId: "m4", score: ((i * 13) % 5) + 1 },
        { metricId: "m5", score: ((i * 17) % 5) + 1 },
      ],
    }));

    const startTime = performance.now();
    const ranking = computeRanking(projects, metrics);
    const durationMs = performance.now() - startTime;

    expect(ranking).toHaveLength(projectCount - 20); // Excluyendo los 20 descalificados
    expect(ranking[0].position).toBe(1);
    expect(ranking[ranking.length - 1].position).toBe(ranking.length);
    expect(durationMs).toBeLessThan(50);
  });

  it("mantiene estabilidad y escalabilidad con 5,000 proyectos bajo 200 milisegundos", () => {
    const projectCount = 5000;
    const baseDate = new Date("2026-01-01T00:00:00Z").getTime();

    const projects: RankingProject[] = Array.from({ length: projectCount }, (_, i) => ({
      id: `proj-${i}`,
      title: `Proyecto Escala ${i}`,
      submissionDate: new Date(baseDate + (i % 500) * 1000), // Empates deliberados
      isDisqualified: false,
      votes: [
        { metricId: "m1", score: (i % 5) + 1 },
        { metricId: "m2", score: ((i + 1) % 5) + 1 },
        { metricId: "m3", score: ((i + 2) % 5) + 1 },
        { metricId: "m4", score: ((i + 3) % 5) + 1 },
        { metricId: "m5", score: ((i + 4) % 5) + 1 },
      ],
    }));

    const startTime = performance.now();
    const ranking = computeRanking(projects, metrics);
    const durationMs = performance.now() - startTime;

    expect(ranking).toHaveLength(projectCount);
    expect(durationMs).toBeLessThan(200);

    // Verificar que los puestos estan correctamente asignados
    for (let pos = 1; pos <= ranking.length; pos++) {
      expect(ranking[pos - 1].position).toBe(pos);
    }
  });

  it("no produce desbordamiento de pila (stack overflow) ni degradacion en colecciones vacias o unitarias", () => {
    expect(() => computeRanking([], metrics)).not.toThrow();
    const single = computeRanking(
      [
        {
          id: "solo",
          title: "Solo",
          submissionDate: new Date(),
          isDisqualified: false,
          votes: [{ metricId: "m1", score: 5 }],
        },
      ],
      metrics
    );
    expect(single).toHaveLength(1);
    expect(single[0].position).toBe(1);
  });
});
