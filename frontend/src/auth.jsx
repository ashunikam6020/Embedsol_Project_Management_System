import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('embedsol_token'));

  useEffect(() => {
    if (!localStorage.getItem('embedsol_token')) return;
    api.get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => localStorage.removeItem('embedsol_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const r = await api.post('/auth/login', { username, password });
    localStorage.setItem('embedsol_token', r.data.token);
    setUser(r.data.user);
  };
  const logout = () => {
    localStorage.removeItem('embedsol_token');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'ADMIN' }}>{children}</Ctx.Provider>;
}
