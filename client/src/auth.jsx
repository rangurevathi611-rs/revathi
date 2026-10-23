import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, setAccessToken, setAuthFailureHandler } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthFailureHandler(() => {
      setAccessToken(null);
      setUser(null);
    });
  }, []);

  useEffect(() => {
    let cancel = false;
    refreshSession()
      .then((data) => {
        if (!cancel) setUser(data.user);
      })
      .catch(() => {
        if (!cancel) setUser(null);
      })
      .finally(() => {
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const value = useMemo(() => {
    async function login(email, password) {
      const data = await api('/auth/login', { method: 'POST', body: { email, password } });
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.user;
    }

    async function register(payload) {
      const data = await api('/auth/register', { method: 'POST', body: payload });
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.user;
    }

    async function logout() {
      try {
        await api('/auth/logout', { method: 'POST' });
      } catch {
        // The local session still ends if the server is unreachable.
      }
      setAccessToken(null);
      setUser(null);
    }

    return { user, login, register, logout };
  }, [user]);

  if (!ready) {
    return (
      <div className="splash">
        <p>Opening the vault…</p>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
