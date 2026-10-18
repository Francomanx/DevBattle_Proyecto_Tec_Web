import { ChallengeList } from "@/components/challenge-list";
import { AuthGate } from "@/components/auth-gate";
export default function Home() {
  //return <AuthGate />; 
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">DevBattle</h1>
      <p className="mt-2 mb-10 text-zinc-600 dark:text-zinc-400">
        Plataforma de retos de programación.
      </p>
      <ChallengeList />
    </main>
  );
}
