import { createContext, useContext, useState, ReactNode } from 'react';
import { api } from '../api/client';
import { User } from '../types';

interface AuthCtx {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('dtr_user');
    return raw ? (JSON.parse(raw) as User) : null;
  });

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    const { token, user: u } = res.data;
    localStorage.setItem('dtr_token', token);
    localStorage.setItem('dtr_user', JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('dtr_token');
    localStorage.removeItem('dtr_user');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
