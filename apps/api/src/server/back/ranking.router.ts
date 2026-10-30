import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { getCompetitionRanking } from "./ranking.service";

export const rankingRouter = createTRPCRouter({
  byCompetition: publicProcedure
    .input(z.object({ competitionId: z.string().min(1) }))
    .query(({ ctx, input }) => getCompetitionRanking(ctx.prisma, input.competitionId)),
});
