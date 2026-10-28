//pagina de visualizacion de perfil de usuario
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useTRPC } from "@/trpc/client";

type ProfileTab = "host" | "dev" | "projects";
//estilos para los diferentes estados de la competencia 
const statusStyles: Record<string, string> = {
  DRAFT: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  ACTIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  VOTING: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  COMPLETED: "border-purple-500/30 bg-purple-500/10 text-purple-300",
};

// funcion interna de la pagina de perfil
function UserProfileContent() {
  //esta constante obtiene el nombre de usuario de la URL y 
  //lo utiliza para hacer una consulta a la API para obtener
  //los datos de perfil del usuario correspondiente.
  const params = useParams<{ username: string }>();
  const username = params.username;
  const trpc = useTRPC();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>("host");

  const { data, isPending, error } = useQuery(
    trpc.profile.byUsername.queryOptions({ username })
  );
  //si la api esta cargando, se muestra un mensaje de carga
  if (isPending) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-400">
        Cargando perfil…
      </main>
    );
  }
  //si hay un error al cargar los datos del perfil, se muestra un mensaje de error
  if (error) {
    const notFound = error.data?.code === "NOT_FOUND";
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8">
          <h1 className="text-2xl font-bold text-white">
            {notFound ? "Usuario no encontrado" : "No se pudo cargar el perfil"}
          </h1>
          <p className="mt-2 text-sm text-red-200">
            {notFound
              ? "Comprueba que el nombre de usuario esté escrito correctamente."
              : error.message}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }
  //si no hay datos de perfil, no se muestra nada
  if (!data) return null;
  //en el caso de que se carguen los datos del perfil,
  //se muestra la informacion del usuario, incluyendo su nombre de usuario,
  //descripcion, enlaces a su perfil de GitHub, y estadisticas de su
  //actividad en la plataforma, como competencias hosteadas, competencias
  //realizadas como desarrollador y proyectos entregados. Tambien
  //se muestran pestañas para filtrar la actividad del usuario por tipo (host, dev, projects).
  const isOwnProfile = currentUser?.id === data.user.id;
  const hasActivity =
    data.hostedCompetitions.length > 0 ||
    data.devCompetitions.length > 0 ||
    data.projects.length > 0;

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "host", label: "Como host" },
    { id: "dev", label: "Como dev" },
    { id: "projects", label: "Proyectos" },
  ];

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6">
        <div
          aria-hidden="true"
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/10 text-3xl font-bold text-orange-300"
        >
          {data.user.username.slice(0, 1).toUpperCase()}
        </div>

        <h1 className="mt-4 text-center text-xl font-bold text-white">
          @{data.user.username}
        </h1>

        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">
          {data.user.description?.trim() || "Sin descripción"}
        </p>

        {data.user.githubUrl && (
          <a
            href={data.user.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block break-all text-sm text-orange-300 underline hover:text-orange-200"
          >
            Ver perfil de GitHub
          </a>
        )}

        {isOwnProfile && (
          <button
            type="button"
            disabled
            title="La edición de perfil se implementará en otra tarea."
            className="mt-6 w-full cursor-not-allowed rounded-lg border border-[#34445F] px-4 py-2 text-sm font-semibold text-slate-400"
          >
            Editar perfil
          </button>
        )}
      </aside>

      <section className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Retos hosteados"
            value={data.stats.hostedCompetitions}
          />
          <StatCard
            label="Retos realizados como dev"
            value={data.stats.devCompetitions}
          />
        </div>

        <div className="rounded-xl border border-[#34445F] bg-[#111A2E] p-4 text-sm text-slate-400">
          Medallas: pendiente de definir cómo se obtienen y transfieren.
        </div>

        {!hasActivity ? (
          <div className="rounded-2xl border border-dashed border-[#34445F] p-10 text-center">
            <h2 className="font-semibold text-white">
              Aún no tiene actividad en la plataforma
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Cuando participe o cree competencias, aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#1E2D4A] bg-[#111A2E]">
            <div
              className="flex flex-wrap gap-2 border-b border-[#1E2D4A] p-3"
              role="tablist"
              aria-label="Actividad del usuario"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id
                      ? "bg-orange-500 text-white"
                      : "text-slate-400 hover:bg-[#1A2640] hover:text-white"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-3 p-4">
              {activeTab === "host" &&
                (data.hostedCompetitions.length ? (
                  data.hostedCompetitions.map((competition) => (
                    <CompetitionRow
                      key={competition.id}
                      id={competition.id}
                      title={competition.title}
                      status={competition.status}
                    />
                  ))
                ) : (
                  <EmptyTab message="No ha hosteado competencias todavía." />
                ))}

              {activeTab === "dev" &&
                (data.devCompetitions.length ? (
                  data.devCompetitions.map((competition) => (
                    <CompetitionRow
                      key={competition.id}
                      id={competition.id}
                      title={competition.title}
                      status={competition.status}
                    />
                  ))
                ) : (
                  <EmptyTab message="No ha participado como dev todavía." />
                ))}

              {activeTab === "projects" &&
                (data.projects.length ? (
                  data.projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/proyectos/${project.id}`}
                      className="block rounded-xl border border-[#263652] p-4 transition hover:border-orange-500/50 hover:bg-[#0D1527]"
                    >
                      <p className="font-semibold text-white">{project.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Competencia: {project.competitionTitle}
                      </p>
                      <p className="mt-2 text-xs text-orange-300">
                        Formato: {project.fileFormat || "No especificado"}
                      </p>
                    </Link>
                  ))
                ) : (
                  <EmptyTab message="No ha entregado proyectos todavía." />
                ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function CompetitionRow({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: string;
}) {
  return (
    <Link
      href={`/competitions/${id}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#263652] p-4 transition hover:border-orange-500/50 hover:bg-[#0D1527]"
    >
      <span className="font-semibold text-white">{title}</span>
      <span
        className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? "border-slate-600 text-slate-300"
          }`}
      >
        {status}
      </span>
    </Link>
  );
}

function EmptyTab({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{message}</p>;
}

export default function UserProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-400">
          Cargando perfil…
        </main>
      }
    >
      <UserProfileContent />
    </Suspense>
  );
}