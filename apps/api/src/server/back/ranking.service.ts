import { TRPCError } from "@trpc/server";
import { computeRanking, type RankingMetric, type RankingProject } from "./ranking";

/** Subconjunto de PrismaClient que necesita el servicio (facilita las pruebas). */
export type RankingDb = {
  competition: {
    findUnique(args: {
      where: { id: string };
      include: {
        metrics: true;
        projects: { include: { votes: { select: { metricId: true; score: true } } } };
      };
    }): Promise<{
      id: string;
      title: string;
      status: string;
      metrics: RankingMetric[];
      projects: RankingProject[];
    } | null>;
  };
};

export async function getCompetitionRanking(db: RankingDb, competitionId: string) {
  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    include: {
      metrics: true,
      projects: { include: { votes: { select: { metricId: true, score: true } } } },
    },
  });

  if (!competition) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Competencia no encontrada" });
  }
  if (competition.status !== "COMPLETED") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "El ranking solo puede calcularse cuando la competencia está en estado completed",
    });
  }

  const ranking = computeRanking(competition.projects, competition.metrics);
  const hasVotes = competition.projects.some((p) => !p.isDisqualified && p.votes.length > 0);

  return {
    competitionId: competition.id,
    title: competition.title,
    hasVotes,
    message: hasVotes ? null : "La competencia no recibió votos; todos los proyectos tienen 0 puntos",
    ranking,
  };
}
