"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { NotificationsDropdown } from "@/components/notifications-dropdown";

export function Navbar() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1A2640] bg-[#0B111E]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo & Nav items */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative h-9 w-36">
              <Image
                src="/logos/Logo_Title_White_png.png"
                alt="DevBattle"
                fill
                priority
                className="object-contain"
              />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-[#23355A] bg-[#131E35] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#1A2A4A]"
            >
              Explorar Retos
            </Link>
          </nav>
        </div>

        {/* Right: Actions & User */}
        <div className="flex items-center gap-4">
          <Link
            href="/competitions/create"
            className="flex items-center gap-1.5 rounded-lg bg-[#FF6B00] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#E05E00] active:scale-[0.98]"
          >
            <span className="text-base font-bold">+</span>
            <span>Crear Reto</span>
          </Link>

          <div className="h-6 w-px bg-[#1E2D4A]" />

          {/* User profile / session trigger */}
          {isLoading ? (
            <span className="text-xs text-slate-400">Comprobando sesión…</span>
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <NotificationsDropdown />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2.5 rounded-lg p-1 text-left transition hover:bg-[#131E35] focus:outline-none"
                  aria-expanded={menuOpen}
                >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-[#0B111E] font-bold text-sm shadow">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="hidden sm:block min-w-0">
                  <p className="text-sm font-semibold leading-tight text-white max-w-[140px] truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-slate-400">Perfil</p>
                </div>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[#1E2D4A] bg-[#111A2E] p-2 shadow-xl z-50">
                  <div className="px-3 py-2 border-b border-[#1E2D4A] mb-1 min-w-0">
                    {/* para mostrar el perfil del usuario, se utiliza un link que redirige a la pagina de perfil del usuario */}
                    <Link
                      href={`/usuarios/${encodeURIComponent(user.username)}`}
                      onClick={() => setMenuOpen(false)}
                      className="text-sm font-semibold text-white hover:text-orange-300 block"
                    >
                      Ver mi perfil
                    </Link>
                    <p className="text-xs text-slate-400 truncate">@{user.username}</p>
                  </div>
                  <Link
                    href={`/usuarios/${encodeURIComponent(user.username)}?tab=notifications`}
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-[#18253D] hover:text-white block"
                  >
                    Notificaciones
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                  >
                    Cerrar sesión (Probar acceso privado)
                  </button>
                </div>
              )}
            </div>
          </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
            >
              Iniciar sesión / Crear cuenta
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
