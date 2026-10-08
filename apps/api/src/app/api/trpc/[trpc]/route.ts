import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { preflight, withCors } from "../../../../server/cors";
import { appRouter } from "../../../../server/routers/_app";
import { createTRPCContext } from "../../../../server/trpc";

const handler = async (req: Request) =>
  withCors(
    req,
    await fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext: () => createTRPCContext({ req }),
      onError:
        process.env.NODE_ENV === "development"
          ? ({ path, error }) =>
            console.error(`tRPC falló en ${path ?? "<no-path>"}: ${error.message}`)
          : undefined,
    }),
  );

export { handler as GET, handler as POST };
export const OPTIONS = preflight;
