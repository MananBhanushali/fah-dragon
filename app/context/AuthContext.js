"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // start with not-loading so UI can render login button immediately
  const [loading, setLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        setUser(data.user);
        try {
          if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
          else localStorage.removeItem("user");
        } catch (e) {
          // ignore localStorage errors
        }
      } else {
        // non-json (likely HTML error page) — treat as not logged in
        const txt = await res.text();
        console.error("Non-JSON response from /api/auth/me:", txt.slice(0, 400));
        setUser(null);
        try { localStorage.removeItem("user"); } catch (e) {}
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
      try { localStorage.removeItem("user"); } catch (e) {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // hydrate from localStorage for instant UI responsiveness
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        setUser(JSON.parse(stored));
        setLoading(false);
      }
    } catch (e) {
      // ignore parse/localStorage errors
    }

    fetchUser();
  }, [fetchUser]);

  const register = async (username, password, displayName) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, displayName }),
    });
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setUser(data.user);
      try { localStorage.setItem("user", JSON.stringify(data.user)); } catch (e) {}
      return data.user;
    }
    const txt = await res.text();
    throw new Error(txt || "Registration failed");
  };

  const login = async (username, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setUser(data.user);
      try { localStorage.setItem("user", JSON.stringify(data.user)); } catch (e) {}
      return data.user;
    }
    const txt = await res.text();
    throw new Error(txt || "Login failed");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    try { localStorage.removeItem("user"); } catch (e) {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refetch: fetchUser }}>
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
