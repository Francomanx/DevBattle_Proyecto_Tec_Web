"use client";
//cambios nuevos aqui
//importamos esto para poder usar el localStorage en el navegador
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface UserSession {
  id: string;
  username: string;
  name: string;
  email: string;
  /* estos los quito puesto que el rol es contextual y no se necesita en el localStorage creo? xd
  avatarUrl?: string;
  role?: string;
  */
}

/*
const DEFAULT_USER: UserSession = {
  id: "luis_dev",
  username: "luis_dev",
  name: "Luis Dev",
  email: "luis@devbattle.com",
  role: "HOST",
};
*/
/*
interface AuthContextType {
  user: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (customUser?: Partial<UserSession>) => void;
  logout: () => void;
  toggleAuth: () => void;
}
*/
//esto es lo que se va a usar para el contexto de autenticación
interface AuthContextType {
  user: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

interface AuthSessionResponse {
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
}



const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return "http://localhost:3001";
}

/*
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
*/

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const response = await fetch(`${getApiUrl()}/api/auth/session`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("No se pudo consultar la sesión.");
      }

      const session =
        (await response.json()) as AuthSessionResponse | null;

      if (!session?.user) {
        setUser(null);
        return;
      }

      const name = session.user.name ?? session.user.email ?? "Usuario";

      setUser({
        id: session.user.id,
        name,
        username: name,
        email: session.user.email ?? "",
      });
    } catch (error) {
      setUser(null);
      setAuthError(
        error instanceof Error
          ? error.message
          : "No se pudo consultar la sesión."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);

    try {
      const csrfResponse = await fetch(`${getApiUrl()}/api/auth/csrf`, {
        credentials: "include",
      });

      if (!csrfResponse.ok) {
        throw new Error("No se pudo preparar el cierre de sesión.");
      }

      const { csrfToken } = (await csrfResponse.json()) as {
        csrfToken: string;
      };

      const response = await fetch(`${getApiUrl()}/api/auth/signout`, {
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

      if (!response.ok) {
        throw new Error("No se pudo cerrar la sesión.");
      }

      setUser(null);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "No se pudo cerrar la sesión."
      );
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        authError,
        refreshSession,
        logout,
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

//me cuesta un poco enteder esto, pero cuando la aplicacion se carga
//consulta la sesion real de Auth.js. Si no hay una sesion valida, el user queda en null.
//Esto tambien implementa el cierre de sesion real. Asi se elimina el comportamiento de que
//antes el inicio de sesion era ficticio y se iniciaba como Luis Dev