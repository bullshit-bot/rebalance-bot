import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { api, getApiKey, setApiKey, clearApiKey } from "@/lib/api";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (apiKey: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!getApiKey());

  const login = useCallback(async (apiKey: string): Promise<boolean> => {
    // Store key first so api.getHealth() can use it
    setApiKey(apiKey);
    try {
      await api.getHealth();
      setIsAuthenticated(true);
      return true;
    } catch {
      clearApiKey();
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearApiKey();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
