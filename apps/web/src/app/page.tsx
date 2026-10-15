import { CompetitionList } from "@/components/competition-list";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          DevBattle
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
          Plataforma web de retos y competencias de programación para desarrolladores de todo el mundo.
        </p>
      </header>
      <section>
        <h2 className="text-xl font-semibold mb-6 text-zinc-800 dark:text-zinc-200">
          Competencias Disponibles
        </h2>
        <CompetitionList />
      </section>
    </main>
  );
}
