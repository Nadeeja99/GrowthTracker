'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, User } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  /** True until the initial session restore has finished. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Signs in to the shared demo account. */
  loginDemo: () => Promise<void>;
  register: (userData: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  /** Revokes every session of this user, on all devices. */
  logoutEverywhere: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const endSession = useCallback(() => {
    setUser(null);
    // Never show one user's cached data to the next person who signs in.
    queryClient.clear();
  }, [queryClient]);

  // Restore the session from the httpOnly refresh cookie on page load, and
  // drop it whenever the API reports it can no longer be renewed.
  useEffect(() => {
    let cancelled = false;
    apiClient.refreshSession()
      // If the session can't be checked (e.g. offline), fall back to signing in.
      .catch(() => null)
      .then(restored => {
        if (cancelled) return;
        setUser(restored);
        setIsLoading(false);
      });
    apiClient.onSessionExpired(endSession);
    return () => {
      cancelled = true;
      apiClient.onSessionExpired(null);
    };
  }, [endSession]);

  const login = async (email: string, password: string) => {
    const response = await apiClient.login({ email, password });
    if (!response.data?.user) throw new Error(response.error || 'Login failed');
    setUser(response.data.user);
  };

  const loginDemo = async () => {
    const response = await apiClient.loginDemo();
    if (!response.data?.user) throw new Error(response.error || 'Couldn’t open the demo');
    setUser(response.data.user);
  };

  const register: AuthContextType['register'] = async userData => {
    const response = await apiClient.register(userData);
    if (!response.data?.user) throw new Error(response.error || 'Registration failed');
    setUser(response.data.user);
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      endSession();
    }
  };

  const logoutEverywhere = async () => {
    try {
      await apiClient.logoutEverywhere();
    } finally {
      endSession();
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    loginDemo,
    register,
    logout,
    logoutEverywhere,
    updateUser: setUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
