export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 32 }}>
      <h1>DevBattle API</h1>
      <p>
        Endpoint tRPC: <code>/api/trpc</code>
      </p>
      <p>
        <a href="/api/trpc/health.check">/api/trpc/health.check</a>
      </p>
    </main>
  );
}
