export type RankingMetric = { id: string; name: string };

export type RankingProject = {
  id: string;
  title: string;
  submissionDate: Date;
  isDisqualified: boolean;
  votes: Array<{ metricId: string; score: number }>;
};

export type RankingEntry = {
  position: number;
  projectId: string;
  title: string;
  submissionDate: Date;
  totalScore: number;
  metrics: Array<{ metricId: string; name: string; average: number; votes: number }>;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Promedio de una lista de calificaciones; sin calificaciones vale 0. */
export function average(scores: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * Puntaje de un proyecto: promedio por métrica (individual) y suma de esos promedios.
 * Una métrica sin votos aporta 0.
 */
export function scoreProject(project: RankingProject, metrics: RankingMetric[]) {
  const perMetric = metrics.map((metric) => {
    const scores = project.votes.filter((v) => v.metricId === metric.id).map((v) => v.score);
    return {
      metricId: metric.id,
      name: metric.name,
      average: average(scores),
      votes: scores.length,
    };
  });
  const total = perMetric.reduce((sum, m) => sum + m.average, 0);
  return { perMetric, total };
}

/**
 * Ranking de mayor a menor puntaje total. Excluye proyectos descalificados.
 * Desempate: gana el proyecto enviado primero (id como último recurso para ser determinista).
 */
export function computeRanking(
  projects: RankingProject[],
  metrics: RankingMetric[],
): RankingEntry[] {
  return projects
    .filter((p) => !p.isDisqualified)
    .map((p) => ({ project: p, ...scoreProject(p, metrics) }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        a.project.submissionDate.getTime() - b.project.submissionDate.getTime() ||
        a.project.id.localeCompare(b.project.id),
    )
    .map(({ project, perMetric, total }, index) => ({
      position: index + 1,
      projectId: project.id,
      title: project.title,
      submissionDate: project.submissionDate,
      totalScore: round2(total),
      metrics: perMetric.map((m) => ({ ...m, average: round2(m.average) })),
    }));
}
