import { CompetitionStatus, NotificationType, PrismaClient } from "@devbattle/db";

export async function updateCompetitionStatuses(prisma: PrismaClient) {
  console.log(`[Cron] Iniciando revisión de estados de competencias - ${new Date().toISOString()}`);
  const now = new Date();

  try {
    // 1. Transicion de ACTIVE a VOTING
    const competitionsToVote = await prisma.competition.findMany({
      where: {
        status: CompetitionStatus.ACTIVE,
        submissionDeadline: { lte: now },
      },
      select: {
        id: true,
        title: true,
        participants: {
          select: { userId: true, role: true },
        },
        projects: {
          select: { authorId: true },
        },
      },
    });

    if (competitionsToVote.length > 0) {
      const compIds = competitionsToVote.map((c) => c.id);

      await prisma.competition.updateMany({
        where: { id: { in: compIds } },
        data: { status: CompetitionStatus.VOTING },
      });

      console.log(`[Cron] Éxito: ${competitionsToVote.length} competencias pasaron de ACTIVE a VOTING.`);

      const voteNotifications: Array<{
        userId: string;
        content: string;
        type: NotificationType;
      }> = [];

      for (const comp of competitionsToVote) {
        const evaluators = comp.participants
          .filter((p) => p.role === "HOST" || p.role === "MOD")
          .map((p) => p.userId);

        for (const evaluatorId of evaluators) {
          voteNotifications.push({
            userId: evaluatorId,
            content: `La competencia "${comp.title}" ha entrado en fase de evaluación (VOTING). Ya puedes calificar los proyectos participantes.`,
            type: NotificationType.STATE_CHANGE,
          });
        }

        const evaluatorSet = new Set(evaluators);
        const contestants = new Set<string>();

        comp.participants
          .filter((p) => p.role === "DEV")
          .forEach((p) => contestants.add(p.userId));

        comp.projects.forEach((prj) => {
          if (prj.authorId && !evaluatorSet.has(prj.authorId)) {
            contestants.add(prj.authorId);
          }
        });

        for (const contestantId of contestants) {
          voteNotifications.push({
            userId: contestantId,
            content: `La fase de recepción de proyectos para la competencia "${comp.title}" ha finalizado. El certamen se encuentra en fase de evaluación.`,
            type: NotificationType.STATE_CHANGE,
          });
        }
      }

      if (voteNotifications.length > 0) {
        await prisma.notification.createMany({
          data: voteNotifications,
        });
      }
    }

    // 2. Transicion de VOTING a COMPLETED
    const competitionsToComplete = await prisma.competition.findMany({
      where: {
        status: CompetitionStatus.VOTING,
        votingDeadline: { lte: now },
      },
      select: {
        id: true,
        title: true,
        participants: {
          select: { userId: true },
        },
        projects: {
          select: { authorId: true },
        },
      },
    });

    if (competitionsToComplete.length > 0) {
      const compIds = competitionsToComplete.map((c) => c.id);

      await prisma.competition.updateMany({
        where: { id: { in: compIds } },
        data: { status: CompetitionStatus.COMPLETED },
      });

      console.log(`[Cron] Éxito: ${competitionsToComplete.length} competencias pasaron de VOTING a COMPLETED.`);

      const completionNotifications: Array<{
        userId: string;
        content: string;
        type: NotificationType;
      }> = [];

      for (const comp of competitionsToComplete) {
        console.log(`[Cron] Preparando cálculo de ranking para la competencia: ${comp.title}`);

        const recipientIds = new Set<string>();
        comp.participants.forEach((p) => recipientIds.add(p.userId));
        comp.projects.forEach((prj) => {
          if (prj.authorId) recipientIds.add(prj.authorId);
        });

        for (const recipientId of recipientIds) {
          completionNotifications.push({
            userId: recipientId,
            content: `La competencia "${comp.title}" ha finalizado. La fase de evaluación ha concluido y el ranking final ya se encuentra disponible.`,
            type: NotificationType.STATE_CHANGE,
          });
        }
      }

      if (completionNotifications.length > 0) {
        await prisma.notification.createMany({
          data: completionNotifications,
        });
      }
    }
  } catch (error) {
    console.error("[Cron] Error actualizando estados de competencias:", error);
  }
}