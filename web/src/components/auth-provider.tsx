"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { prepareFirebaseAuth } from "@/lib/firebase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let stop: (() => void) | undefined;

    void prepareFirebaseAuth()
      .then((auth) => {
        if (!active) return;
        stop = onAuthStateChanged(
          auth,
          (nextUser) => {
            setUser(nextUser);
            setError(null);
            setLoading(false);
          },
          (caught) => {
            setError(caught.message);
            setLoading(false);
          },
        );
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : String(caught));
        setLoading(false);
      });

    return () => {
      active = false;
      stop?.();
    };
  }, []);

  const value = useMemo(() => ({ user, loading, error }), [user, loading, error]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
