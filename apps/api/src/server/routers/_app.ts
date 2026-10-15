import { createCallerFactory, createTRPCRouter } from "../trpc";
import { challengeRouter } from "./challenge";
import { healthRouter } from "./health";
import { authRouter } from "./auth";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  health: healthRouter,
  challenge: challengeRouter,
});


export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
