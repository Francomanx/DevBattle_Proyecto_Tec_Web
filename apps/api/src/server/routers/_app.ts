import { createCallerFactory, createTRPCRouter } from "../trpc";
import { competitionRouter } from "./competition";
import { healthRouter } from "./health";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  competition: competitionRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
