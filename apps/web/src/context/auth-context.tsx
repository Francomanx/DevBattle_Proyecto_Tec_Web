"use client";

import React, { createContext, useContext, useState } from "react";

export interface UserSession {
  id: string;
  username: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: string;
}

const DEFAULT_USER: UserSession = {
  id: "luis_dev",
  username: "luis_dev",
  name: "Luis Dev",
  email: "luis@devbattle.com",
  role: "HOST",
};

interface AuthContextType {
  user: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (customUser?: Partial<UserSession>) => void;
  logout: () => void;
  toggleAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(() => {
    if (typeof window === "undefined") return DEFAULT_USER;
    try {
      const stored = localStorage.getItem("devbattle_user_session");
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return DEFAULT_USER;
  });

  const login = (customUser?: Partial<UserSession>) => {
    const updated = { ...DEFAULT_USER, ...customUser };
    setUser(updated);
    try {
      localStorage.setItem("devbattle_user_session", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("devbattle_user_session");
    } catch {
      // ignore
    }
  };

  const toggleAuth = () => {
    if (user) {
      logout();
    } else {
      login();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading: false,
        login,
        logout,
        toggleAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
