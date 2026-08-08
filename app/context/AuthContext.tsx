import React, { createContext, useContext, useState } from "react";

interface AuthContextType {
  email: string;
  setEmail: (email: string) => void;
  code: string;
  setCode: (code: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  return (
    <AuthContext.Provider value={{ email, setEmail, code, setCode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
} 