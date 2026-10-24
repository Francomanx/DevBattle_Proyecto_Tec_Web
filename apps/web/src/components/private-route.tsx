"use client";

import { useAuth } from "@/context/auth-context";
import Link from "next/link";

interface PrivateRouteProps {
  children: React.ReactNode;
}

export function PrivateRoute({ children }: PrivateRouteProps) {
  const { isAuthenticated, isLoading, authError, refreshSession } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  //para mostrar errores de conexion a la sesion
  if (authError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p role="alert" className="text-red-300">
          {authError}
        </p>
        <button
          type="button"
          onClick={() => void refreshSession()}
          className="mt-4 rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white"
        >
          Volver a comprobar
        </button>
      </div>
    );
  } //esto diferencia una sesion no iniciada de un problema al comunicarse con la API
  

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center px-4 py-16">
        <div className="w-full rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h2 className="mt-5 text-2xl font-bold tracking-tight text-white">
            Acceso Privado Requerido
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Se puede acceder a la creación de retos solo con una sesión iniciada.
            Inicia sesión para continuar y convertirte en el host de la competencia.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/login"
              className="w-full rounded-xl bg-[#FF6B00] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#E05E00]"
            >
              Iniciar sesión o crear cuenta
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-[#1E2D4A] bg-[#131E35] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[#1A2A4A] hover:text-white"
            >
              Volver a Explorar Retos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
