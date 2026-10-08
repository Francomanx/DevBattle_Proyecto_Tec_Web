import { createCallerFactory, createTRPCRouter } from "../trpc";
import { challengeRouter } from "./challenge";
import { healthRouter } from "./health";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  challenge: challengeRouter,
});


export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
