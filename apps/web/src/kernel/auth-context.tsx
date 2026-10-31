import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from './types';
import { apiClient } from './client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; role?: Role }) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(apiClient.getToken());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadCurrentUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiClient.get<{ user: User }>('/auth/me');
        setUser(res.user);
      } catch (_err) {
        apiClient.clearToken();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadCurrentUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post<{ user: User; token: string }>('/auth/login', {
      email,
      password,
    });
    apiClient.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (data: { email: string; password: string; name: string; role?: Role }) => {
    const res = await apiClient.post<{ user: User; token: string }>('/auth/register', data);
    apiClient.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    try {
      apiClient.post('/auth/logout', {}).catch(() => {});
    } finally {
      apiClient.clearToken();
      setToken(null);
      setUser(null);
    }
  };

  const hasRole = (...roles: Role[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
