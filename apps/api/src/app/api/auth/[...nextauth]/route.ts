import type { NextRequest } from "next/server";
import { handlers } from "../../../../auth";
import { preflight, withCors } from "../../../../server/cors";

const handler = async (req: NextRequest) => {
  const response =
    req.method === "GET" ? await handlers.GET(req) : await handlers.POST(req);
  return withCors(req, response);
};

export { handler as GET, handler as POST };
export const OPTIONS = preflight;