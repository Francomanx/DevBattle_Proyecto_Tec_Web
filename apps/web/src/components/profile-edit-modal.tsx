"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
//este prop recibe los datos actuales del usuario y las funciones
//para cerrar el modal y avisar al perfil cuando se guardo un cambio.
interface ProfileEditModalProps {
  username: string;
  description: string | null;
  githubUrl: string | null;
  onClose: () => void;
  onSaved: (profile: {
    id: string;
    username: string;
    description: string | null;
    githubUrl: string | null;
  }) => void;
}

type ModalSection = "profile" | "security";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

function isGitHubUrl(value: string) {
  if (!value.trim()) return true;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["github.com", "www.github.com"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function ProfileEditModal({
  username: initialUsername,
  description: initialDescription,
  githubUrl: initialGithubUrl,
  onClose,
  onSaved,
}: ProfileEditModalProps) {
  const trpc = useTRPC();
  const updateProfile = useMutation(trpc.profile.updateProfile.mutationOptions());
  const changePassword = useMutation(
    trpc.profile.changePassword.mutationOptions()
  );

  const [section, setSection] = useState<ModalSection>("profile");
  const [username, setUsername] = useState(initialUsername);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [githubUrl, setGithubUrl] = useState(initialGithubUrl ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [securitySuccess, setSecuritySuccess] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      setProfileError("El nombre de usuario debe tener entre 3 y 30 caracteres.");
      return;
    }
    if (!isGitHubUrl(githubUrl)) {
      setProfileError("Ingresa una URL HTTPS válida de GitHub.");
      return;
    }

    try {
      const updated = await updateProfile.mutateAsync({
        username: cleanUsername,
        description: description.trim(),
        githubUrl: githubUrl.trim(),
      });
      setProfileSuccess("Perfil actualizado.");
      onSaved(updated);
    } catch (error) {
      setProfileError(getErrorMessage(error));
    }
  }

  function validatePasswordFields() {
    if (!currentPassword) {
      setSecurityError("Ingresa tu contraseña actual.");
      return false;
    }
    if (newPassword.length < 8 || newPassword.length > 72) {
      setSecurityError("La contraseña debe tener entre 8 y 72 caracteres.");
      return false;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError("Las contraseñas no coinciden.");
      return false;
    }
    return true;
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityError("");
    setSecuritySuccess("");

    if (!validatePasswordFields()) return;

    try {
      await changePassword.mutateAsync({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSecuritySuccess("Contraseña actualizada correctamente.");
    } catch (error) {
      setSecurityError(getErrorMessage(error));
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="profile-edit-title"
        aria-modal="true"
        className="my-auto w-full max-w-2xl rounded-2xl border border-[#263652] bg-[#111A2E] p-5 shadow-2xl sm:p-7"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id="profile-edit-title" className="text-xl font-bold text-white">
              Editar perfil
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Actualiza tu información o cambia tu contraseña.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="rounded-lg px-3 py-1 text-xl text-slate-400 hover:bg-[#1A2640] hover:text-white"
          >
            ×
          </button>
        </header>

        <div className="mt-6 flex gap-2 border-b border-[#263652]">
          <button
            type="button"
            onClick={() => setSection("profile")}
            aria-pressed={section === "profile"}
            className={`border-b-2 px-3 py-2 text-sm font-semibold ${
              section === "profile"
                ? "border-orange-500 text-white"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Perfil
          </button>
          <button
            type="button"
            onClick={() => setSection("security")}
            aria-pressed={section === "security"}
            className={`border-b-2 px-3 py-2 text-sm font-semibold ${
              section === "security"
                ? "border-orange-500 text-white"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Seguridad
          </button>
        </div>

        {section === "profile" ? (
          <form className="mt-5 space-y-4" onSubmit={handleProfileSubmit}>
            <label className="block space-y-1.5 text-sm text-slate-300">
              <span>Nombre de usuario</span>
              <input
                autoComplete="username"
                required
                minLength={3}
                maxLength={30}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-lg border border-[#34445F] bg-[#0A101D] px-3 py-2.5 text-white outline-none focus:border-orange-500"
              />
              <span className="block text-xs text-slate-500">
                Entre 3 y 30 caracteres.
              </span>
            </label>

            <label className="block space-y-1.5 text-sm text-slate-300">
              <span>Descripción</span>
              <textarea
                rows={4}
                maxLength={500}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full resize-y rounded-lg border border-[#34445F] bg-[#0A101D] px-3 py-2.5 text-white outline-none focus:border-orange-500"
              />
              <span className="block text-right text-xs text-slate-500">
                {description.length}/500
              </span>
            </label>

            <label className="block space-y-1.5 text-sm text-slate-300">
              <span>URL de GitHub</span>
              <input
                type="url"
                inputMode="url"
                placeholder="https://github.com/usuario"
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
                className="w-full rounded-lg border border-[#34445F] bg-[#0A101D] px-3 py-2.5 text-white outline-none focus:border-orange-500"
              />
            </label>

            {profileError && (
              <p role="alert" className="text-sm text-red-300">
                {profileError}
              </p>
            )}
            {profileSuccess && (
              <p role="status" className="text-sm text-emerald-300">
                {profileSuccess}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#34445F] px-4 py-2 text-sm text-slate-300 hover:bg-[#1A2640]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {updateProfile.isPending ? "Guardando…" : "Guardar perfil"}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handlePasswordSubmit}>
            <p className="text-sm text-slate-400">
              Confirma tu contraseña actual y elige una nueva contraseña.
            </p>

            <label className="block space-y-1.5 text-sm text-slate-300">
              <span>Contraseña actual</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={72}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full rounded-lg border border-[#34445F] bg-[#0A101D] px-3 py-2.5 text-white outline-none focus:border-orange-500"
              />
            </label>

            <label className="block space-y-1.5 text-sm text-slate-300">
              <span>Nueva contraseña</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-lg border border-[#34445F] bg-[#0A101D] px-3 py-2.5 text-white outline-none focus:border-orange-500"
              />
            </label>

            <label className="block space-y-1.5 text-sm text-slate-300">
              <span>Confirmar nueva contraseña</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-[#34445F] bg-[#0A101D] px-3 py-2.5 text-white outline-none focus:border-orange-500"
              />
            </label>

            {securityError && (
              <p role="alert" className="text-sm text-red-300">
                {securityError}
              </p>
            )}
            {securitySuccess && (
              <p role="status" className="text-sm text-emerald-300">
                {securitySuccess}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#34445F] px-4 py-2 text-sm text-slate-300 hover:bg-[#1A2640]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={changePassword.isPending}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {changePassword.isPending ? "Actualizando…" : "Cambiar contraseña"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
