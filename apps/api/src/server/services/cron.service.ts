import { CompetitionStatus } from "@devbattle/db";

export async function updateCompetitionStatuses(prisma: any) {
  console.log(`[Cron] Iniciando revisión de estados de competencias - ${new Date().toISOString()}`);
  const now = new Date();

  try {
    const activeToVoting = await prisma.competition.updateMany({
      where: {
        status: CompetitionStatus.ACTIVE,
        submissionDeadline: { lte: now },
      },
      data: {
        status: CompetitionStatus.VOTING,
      },
    });

    if (activeToVoting.count > 0) {
      console.log(`[Cron] Éxito: ${activeToVoting.count} competencias pasaron de ACTIVE a VOTING.`);
    }

    const competitionsToComplete = await prisma.competition.findMany({
      where: {
        status: CompetitionStatus.VOTING,
        votingDeadline: { lte: now },
      },
      select: { id: true, title: true },
    });

    if (competitionsToComplete.length > 0) {
      const compIds = competitionsToComplete.map((c: any) => c.id);

      await prisma.competition.updateMany({
        where: { id: { in: compIds } },
        data: { status: CompetitionStatus.COMPLETED },
      });

      console.log(`[Cron] Éxito: ${competitionsToComplete.length} competencias pasaron de VOTING a COMPLETED.`);

      for (const comp of competitionsToComplete) {
        console.log(`[Cron] Preparando cálculo de ranking para la competencia: ${comp.title}`);
      }
    }
  } catch (error) {
    console.error("[Cron] Error actualizando estados de competencias:", error);
  }
}