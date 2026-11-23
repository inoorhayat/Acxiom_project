import { createContext, useContext, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('acxiom_user'));
    } catch {
      return null;
    }
  });

  const saveSession = (token, u) => {
    localStorage.setItem('acxiom_token', token);
    localStorage.setItem('acxiom_user', JSON.stringify(u));
    setUser(u);
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    saveSession(data.token, data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logging out locally even if the server is unreachable
    }
    localStorage.removeItem('acxiom_token');
    localStorage.removeItem('acxiom_user');
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    hasRole: (...roles) => !!user && roles.includes(user.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
