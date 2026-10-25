import { createCallerFactory, createTRPCRouter } from "../trpc";
import { competitionRouter } from "./competition";
import { challengeRouter } from "./challenge";
import { healthRouter } from "./health";
import { authRouter } from "./auth";
import { projectRouter } from "./project";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  health: healthRouter,
  competition: competitionRouter,
  challenge: challengeRouter,
  project: projectRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
