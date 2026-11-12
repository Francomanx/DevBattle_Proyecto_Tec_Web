"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useAuth } from "@/context/auth-context";

interface SubmitProjectProps {
  competitionId: string;
  competitionStatus: string;
  fileFormats: string;
  hasUserAlreadySubmitted: boolean;
  onSuccessSubmit: () => void;
}

export function SubmitProjectForm({
  competitionId,
  competitionStatus,
  fileFormats,
  hasUserAlreadySubmitted,
  onSuccessSubmit,
}: SubmitProjectProps) {
  const trpc = useTRPC();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<"link" | "zip" | "archivo" | "">("");
  
  const [urlInput, setUrlInput] = useState("");
  
  const [fileInput, setFileInput] = useState<File | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const submitMutation = useMutation(trpc.project.submitToCompetition.mutationOptions());
  
  if (!user) {
    return (
      <div className="rounded-xl border border-[#1E2D4A] bg-[#0E1628] p-6 text-center">
        <h3 className="text-white font-bold mb-2">Únete al desafío</h3>
        <p className="text-sm text-slate-400 mb-4">Inicia sesión para poder participar y enviar tu solución.</p>
        <button className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition">
          Iniciar Sesión
        </button>
      </div>
    );
  }

  if (competitionStatus !== "ACTIVE") {
    return (
      <div className="rounded-xl border border-[#1E2D4A] bg-[#0E1628] p-6 text-center">
        <p className="text-sm text-slate-400">
          La etapa de recepción de proyectos no está disponible.
        </p>
      </div>
    );
  }

  if (hasUserAlreadySubmitted) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 mb-3">
          <span className="text-white font-bold">✓</span>
        </div>
        <h3 className="text-emerald-400 font-bold mb-1">¡Ya estás participando!</h3>
        <p className="text-xs text-slate-300">
          Tu proyecto ha sido recibido con éxito. Podrás ver los resultados cuando termine la fase de votación.
        </p>
      </div>
    );
  }

  const availableFormats = fileFormats
    .split(",")
    .map((f) => f.trim().toLowerCase())
    .filter((f) => ["link", "zip", "archivo"].includes(f)) as ("link" | "zip" | "archivo")[];

  if (!selectedFormat && availableFormats.length === 1) {
    setSelectedFormat(availableFormats[0]);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage("El título es obligatorio.");
      return;
    }
    if (description.trim().length < 200) {
      setErrorMessage(`La descripción debe tener al menos 200 caracteres (actual: ${description.trim().length}).`);
      return;
    }
    if (!selectedFormat) {
      setErrorMessage("Debes seleccionar un formato de entrega.");
      return;
    }

    if (selectedFormat === "link") {
      if (!urlInput.startsWith("http://") && !urlInput.startsWith("https://")) {
        setErrorMessage("Debes ingresar un enlace válido (http:// o https://).");
        return;
      }
    } else {
      if (!fileInput) {
        setErrorMessage("Debes subir un archivo adjunto.");
        return;
      }
      if (selectedFormat === "zip" && !fileInput.name.toLowerCase().endsWith(".zip")) {
        setErrorMessage("El archivo subido debe tener extensión .zip");
        return;
      }
    }

    try {
      setIsUploading(true);

      const result = await submitMutation.mutateAsync({
        competitionId,
        title: title.trim(),
        description: description.trim(),
        deliverableType: selectedFormat,
        deliverableContent: selectedFormat === "link" ? urlInput.trim() : fileInput!.name,
      });

      if (result.presignedUrl && fileInput) {
        const uploadResponse = await fetch(result.presignedUrl, {
          method: "PUT",
          body: fileInput,
          headers: {
            "Content-Type": fileInput.type || "application/octet-stream",
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Ocurrió un error al subir el archivo a los servidores.");
        }
      }

      await queryClient.invalidateQueries({ queryKey: [["competition", "byId"]] });
      onSuccessSubmit();

    } catch (err: any) {
      setErrorMessage(err.message || "Ocurrió un error inesperado al enviar el proyecto.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#1E2D4A] bg-[#111A2E] p-5 shadow-lg">
      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-orange-500" />
        Enviar Solución al Reto
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Título */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
            Título del Proyecto
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Ej: Optimizador de Rutas Dinámico"
            className="w-full rounded-lg border border-[#1E2D4A] bg-[#0A101D] px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* Descripción */}
        <div>
          <div className="flex justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase">
              Descripción y Enfoque
            </label>
            <span className={`text-[10px] font-mono ${description.trim().length >= 200 ? "text-emerald-400" : "text-amber-400"}`}>
              {description.trim().length} / 200 min
            </span>
          </div>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explica cómo resolviste el problema, las tecnologías que usaste y los retos que superaste (Mínimo 200 caracteres)..."
            className="w-full rounded-lg border border-[#1E2D4A] bg-[#0A101D] px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none resize-none"
          />
        </div>

        {/* Selección de Formato */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
            Formato de Entrega
          </label>
          {availableFormats.length > 1 ? (
            <div className="flex gap-2">
              {availableFormats.map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => {
                    setSelectedFormat(fmt);
                    setFileInput(null);
                    setUrlInput("");
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                    selectedFormat === fmt
                      ? "border-orange-500 bg-orange-500/20 text-orange-400"
                      : "border-[#1E2D4A] bg-[#0A101D] text-slate-400 hover:text-white"
                  }`}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-orange-400 font-semibold px-1">
              Formato requerido: {availableFormats[0]?.toUpperCase()}
            </p>
          )}
        </div>

        {/* Input Dinámico según el Formato */}
        {selectedFormat === "link" && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://github.com/tu-usuario/repo"
              className="w-full rounded-lg border border-[#1E2D4A] bg-[#0A101D] px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            />
          </div>
        )}

        {(selectedFormat === "zip" || selectedFormat === "archivo") && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="relative flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-[#1E2D4A] border-dashed rounded-lg cursor-pointer bg-[#0A101D] hover:bg-[#0E1628] hover:border-orange-500/50 transition">
                <div className="flex flex-col items-center justify-center pt-3 pb-4">
                  <p className="mb-1 text-xs text-slate-400">
                    <span className="font-bold text-white">Haz clic para subir</span> o arrastra
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {selectedFormat === "zip" ? "Solo archivos .ZIP" : "Archivos de código (.py, .js, etc)"}
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept={selectedFormat === "zip" ? ".zip" : undefined}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFileInput(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
            {fileInput && (
              <p className="mt-2 text-xs text-emerald-400 text-center font-medium">
                📄 Archivo seleccionado: {fileInput.name}
              </p>
            )}
          </div>
        )}

        {/* Mensaje de Error */}
        {(errorMessage || (hasAttemptedSubmit && description.trim().length < 200)) && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-xs text-red-400 font-medium">
              {errorMessage || "Faltan campos por completar correctamente."}
            </p>
          </div>
        )}

        {/* Botón Submit */}
        <button
          type="submit"
          disabled={isUploading || submitMutation.isPending}
          className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-white shadow transition hover:bg-orange-600 disabled:opacity-50"
        >
          {isUploading ? "Subiendo proyecto..." : "Enviar Solución"}
        </button>
      </form>
    </div>
  );
}