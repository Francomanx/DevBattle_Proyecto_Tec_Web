"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { ChallengeList } from "@/components/challenge-list";
import { useTRPC } from "@/trpc/client";

type AuthSession = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

type AuthMode = "login" | "register";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function readSession() {
  const response = await fetch(`${apiUrl}/api/auth/session`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("No se pudo comprobar la sesión.");
  return (await response.json()) as AuthSession | null;
}

async function signIn(email: string, password: string) {
  const csrfResponse = await fetch(`${apiUrl}/api/auth/csrf`, {
    credentials: "include",
  });
  if (!csrfResponse.ok) throw new Error("No se pudo iniciar la sesión.");
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const response = await fetch(`${apiUrl}/api/auth/callback/credentials`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: window.location.origin,
      json: "true",
    }),
  });
  if (!response.ok) throw new Error("No se pudo iniciar la sesión.");

  const session = await readSession();
  if (!session?.user) throw new Error("Correo o contraseña incorrectos.");
  return session;
}

async function signOut() {
  const csrfResponse = await fetch(`${apiUrl}/api/auth/csrf`, {
    credentials: "include",
  });
  if (!csrfResponse.ok) throw new Error("No se pudo cerrar la sesión.");
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const response = await fetch(`${apiUrl}/api/auth/signout`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({
      csrfToken,
      callbackUrl: window.location.origin,
      json: "true",
    }),
  });
  if (!response.ok) throw new Error("No se pudo cerrar la sesión.");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark${compact ? " brand-mark-compact" : ""}`}>
      <span className="brand-angle">&lt;</span>
      <span className="brand-dev">Dev</span>
      <span className="brand-battle">Battle</span>
      <span className="brand-angle">&gt;</span>
    </span>
  );
}

export function AuthGate() {
  const trpc = useTRPC();
  const registerMutation = useMutation(trpc.auth.register.mutationOptions());
  const [mode, setMode] = useState<AuthMode>("login");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    readSession()
      .then((value) => {
        if (active) setSession(value?.user ? value : null);
      })
      .catch(() => {
        if (active) setError("No se pudo conectar con el servicio de sesión.");
      })
      .finally(() => {
        if (active) setIsCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      if (mode === "register") {
        await registerMutation.mutateAsync({ name, email, password });
        setNotice("Cuenta creada. Iniciando sesión...");
      }
      setSession(await signIn(email, password));
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setIsSigningOut(true);
    try {
      await signOut();
      setSession(null);
      setMode("login");
      setPassword("");
      setNotice("");
    } catch (signOutError) {
      setError(errorMessage(signOutError));
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="auth-shell auth-loading" aria-label="Cargando sesión">
        <BrandMark />
        <span className="loading-indicator" />
      </main>
    );
  }

  if (session?.user) {
    return (
      <main className="workspace-shell">
        <header className="workspace-header">
          <BrandMark compact />
          <div className="workspace-account">
            <span className="account-avatar" aria-hidden="true">
              {(session.user.name ?? session.user.email ?? "D").slice(0, 1).toUpperCase()}
            </span>
            <span className="account-name">{session.user.name ?? session.user.email}</span>
            <button
              className="quiet-button"
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? "Cerrando..." : "Cerrar sesión"}
            </button>
          </div>
        </header>
        <section className="challenge-section">
          <div className="section-kicker"><span /> SALA DE BATALLA</div>
          <h1>Retos activos</h1>
          <p className="section-description">Elige tu siguiente desafío.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <ChallengeList />
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <div className="auth-layout">
        <section className="auth-brand-panel">
          <BrandMark />
          <div className="brand-message">
            <div className="section-kicker"><span /> DEV BATTLE / 001</div>
            <h1>El código habla.<br /><em>Tu estrategia</em> responde.</h1>
            <div className="brand-rule" />
            <p>Desafíos de programación. Una sola arena.</p>
          </div>
          <div className="brand-footer">
            <span>BUILD / COMPETE / REPEAT</span>
            <span className="footer-status"><i /> SISTEMA EN LÍNEA</span>
          </div>
        </section>

        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-panel-top">
            <span className="panel-index">ACCESO DE JUGADOR</span>
            <span className="panel-code">DB—01</span>
          </div>

          <div className="auth-heading">
            <h2 id="auth-title">{mode === "login" ? "Qué bueno verte." : "Crea tu cuenta."}</h2>
            <p>{mode === "login" ? "Entra y vuelve a la arena." : "Tu próxima batalla empieza aquí."}</p>
          </div>

          <div className="auth-switch" role="tablist" aria-label="Acceso o registro">
            <button
              id="login-tab"
              className={mode === "login" ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              aria-controls="auth-form"
              onClick={() => switchMode("login")}
            >
              Iniciar sesión
            </button>
            <button
              id="register-tab"
              className={mode === "register" ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              aria-controls="auth-form"
              onClick={() => switchMode("register")}
            >
              Crear cuenta
            </button>
          </div>

          <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <label className="form-field">
                <span>Nombre de jugador</span>
                <input
                  autoComplete="name"
                  maxLength={80}
                  minLength={2}
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ada Lovelace"
                  required
                  value={name}
                />
              </label>
            )}
            <label className="form-field">
              <span>Correo electrónico</span>
              <input
                autoComplete="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@correo.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="form-field">
              <span>Contraseña</span>
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                maxLength={72}
                minLength={mode === "register" ? 8 : 1}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "register" ? "Mínimo 8 caracteres" : "Tu contraseña"}
                required
                type="password"
                value={password}
              />
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}
            {notice && <p className="form-notice" role="status">{notice}</p>}

            <button className="submit-button" type="submit" disabled={isSubmitting}>
              <span>{isSubmitting ? "Conectando..." : mode === "login" ? "Entrar a DevBattle" : "Crear cuenta"}</span>
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          <div className="auth-panel-footer">
            <span>SESIÓN SEGURA</span>
            <span>AUTH / JWT</span>
          </div>
        </section>
      </div>
    </main>
  );
}