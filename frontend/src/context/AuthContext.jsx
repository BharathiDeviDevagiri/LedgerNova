import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ledgerline_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('ledgerline_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifyAuth() {
      if (token) {
        try {
          const res = await authService.getMe();
          if (res.data.success && res.data.user) {
            setUser(res.data.user);
            localStorage.setItem('ledgerline_user', JSON.stringify(res.data.user));
          }
        } catch (error) {
          console.warn('[Auth] Session verification failed, clearing token');
          localStorage.removeItem('ledgerline_token');
          localStorage.removeItem('ledgerline_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    }
    verifyAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    if (res.data.success) {
      const { user: userData, token: userToken } = res.data;
      localStorage.setItem('ledgerline_token', userToken);
      localStorage.setItem('ledgerline_user', JSON.stringify(userData));
      setUser(userData);
      setToken(userToken);
      return userData;
    }
    throw new Error(res.data.error || 'Login failed');
  };

  const register = async (fullName, email, password) => {
    const res = await authService.register(fullName, email, password);
    if (res.data.success) {
      const { user: userData, token: userToken } = res.data;
      localStorage.setItem('ledgerline_token', userToken);
      localStorage.setItem('ledgerline_user', JSON.stringify(userData));
      setUser(userData);
      setToken(userToken);
      return userData;
    }
    throw new Error(res.data.error || 'Registration failed');
  };

  const logout = () => {
    localStorage.removeItem('ledgerline_token');
    localStorage.removeItem('ledgerline_user');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        register,
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
