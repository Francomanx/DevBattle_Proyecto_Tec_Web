import { createCallerFactory, createTRPCRouter } from "../trpc";
import { competitionRouter } from "./competition";
import { challengeRouter } from "./challenge";
import { healthRouter } from "./health";
import { authRouter } from "./auth";
import { projectRouter } from "./project";
import { profileRouter } from "./profile";
import { rankingRouter } from "../back/ranking.router";
import { notificationRouter } from "./notification";
import { chatRouter } from "./chat";
import { voteRouter } from "./vote";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  health: healthRouter,
  competition: competitionRouter,
  challenge: challengeRouter,
  project: projectRouter,
  profile: profileRouter,
  ranking: rankingRouter,
  notification: notificationRouter,
  chat: chatRouter,
  vote: voteRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
