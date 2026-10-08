const allowedOrigins = () =>
  (process.env.WEB_URL ?? "http://localhost:3000").split(",").map((o) => o.trim());

function resolveOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (process.env.NODE_ENV !== "production" && origin) return origin;
  if (origin && allowedOrigins().includes(origin)) return origin;
  return allowedOrigins()[0];
}

const corsHeaders = (req: Request): Record<string, string> => ({
  "Access-Control-Allow-Origin": resolveOrigin(req),
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, trpc-accept, x-trpc-source",
  "Access-Control-Allow-Credentials": "true",
  Vary: "Origin",
});

export function preflight(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function withCors(req: Request, res: Response) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(req))) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
