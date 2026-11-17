"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useAuth } from "@/context/auth-context";

const MAX_LENGTH = 500;

export function ProjectComments({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: comments, isLoading, refetch } = useQuery(
    trpc.comment.listByProject.queryOptions({ projectId })
  );
  const createMutation = useMutation(trpc.comment.create.mutationOptions());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      setError("El comentario no puede estar vacío.");
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError(`El comentario no puede superar los ${MAX_LENGTH} caracteres.`);
      return;
    }
    setError(null);
    try {
      await createMutation.mutateAsync({ projectId, content: trimmed });
      setContent("");
      await refetch();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al publicar el comentario."
      );
    }
  };

  return (
    <section className="rounded-xl border border-[#455b7a] bg-[#1E2433] p-6 shadow-lg space-y-5">
      <h2 className="text-lg font-semibold text-white">
        Comentarios{comments ? ` (${comments.length})` : ""}
      </h2>

      {isLoading ? (
        <p className="text-sm text-zinc-400">Cargando comentarios…</p>
      ) : !comments || comments.length === 0 ? (
        <p className="text-sm italic text-zinc-500">
          Aún no hay comentarios. ¡Sé el primero en comentar!
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-[#455b7a]/50 bg-[#263245] p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <Link
                  href={`/usuarios/${encodeURIComponent(c.author.username)}`}
                  className="font-semibold text-orange-400 hover:text-orange-300"
                >
                  @{c.author.username}
                </Link>
                <span className="text-zinc-500">
                  {new Date(c.createdAt).toLocaleString("es-ES")}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-zinc-300">{c.content}</p>
            </li>
          ))}
        </ul>
      )}

      {user ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            rows={3}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Escribe un comentario…"
            className="w-full rounded-lg border border-[#263652] bg-[#0A101D] p-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span
              className={`text-[11px] ${content.length > MAX_LENGTH ? "text-red-400" : "text-zinc-500"}`}
            >
              {content.length}/{MAX_LENGTH}
            </span>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              {createMutation.isPending ? "Publicando…" : "Publicar comentario"}
            </button>
          </div>
          {error && <p className="text-xs font-medium text-red-400">{error}</p>}
        </form>
      ) : (
        <p className="text-sm text-zinc-400">Inicia sesión para dejar un comentario.</p>
      )}
    </section>
  );
}
