'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, User } from '@/lib/api';
import { discardCheckIns, openCheckIns, showPendingCheckIns } from '@/lib/checkIns';
import { clearOfflineData, rememberUser, rememberedUser, restoreCache, startCaching } from '@/lib/offlineCache';
import { forgetPushDevice } from '@/lib/push';

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
  /** Changes the password; other devices are signed out, this one stays in. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Sets a new password from an emailed link, and signs in. */
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  /** Permanently deletes the account and ends the session. */
  deleteAccount: (password: string) => Promise<void>;
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

  // `keepCheckIns` is for a session that ran out rather than a choice to leave:
  // the same user signing in again shouldn't lose what they did offline.
  const endSession = useCallback(({ keepCheckIns = false } = {}) => {
    if (!keepCheckIns) discardCheckIns();
    openCheckIns(null);
    setUser(null);
    // Never show one user's cached data to the next person who signs in.
    queryClient.clear();
    void clearOfflineData();
  }, [queryClient]);

  // Restore the session from the httpOnly refresh cookie on page load, and
  // drop it whenever the API reports it can no longer be renewed.
  useEffect(() => {
    let cancelled = false;
    // Start the API now in case it is asleep (free hosting tier), so it is
    // up by the time the visitor signs in.
    apiClient.wakeApi().catch(() => undefined);

    const start = async () => {
      // Open from saved data right away: without a connection, or while the
      // server wakes up, this is all there is. The session is confirmed below.
      const saved = rememberedUser();
      if (saved) {
        await restoreCache(queryClient, saved.id);
        openCheckIns(saved.id);
        showPendingCheckIns(queryClient);
        if (cancelled) return;
        setUser(saved);
        setIsLoading(false);
      }

      try {
        const restored = await apiClient.refreshSession();
        if (cancelled) return;
        if (restored) setUser(restored);
        else if (saved) endSession({ keepCheckIns: true });
      } catch {
        // Couldn't check (e.g. offline). Without saved data, that means signing in.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void start();
    apiClient.onSessionExpired(() => endSession({ keepCheckIns: true }));
    return () => {
      cancelled = true;
      apiClient.onSessionExpired(null);
    };
  }, [endSession, queryClient]);

  // The shared demo account is never kept on the device: visitors change it,
  // and it's rebuilt with new ids.
  const userId = user?.id;
  const keepOffline = !!user && !user.isDemo;

  useEffect(() => {
    if (userId) openCheckIns(userId);
    if (!userId || !keepOffline) return;
    return startCaching(queryClient, userId);
  }, [userId, keepOffline, queryClient]);

  useEffect(() => {
    if (user && !user.isDemo) rememberUser(user);
  }, [user]);

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
    await forgetPushDevice();
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

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const response = await apiClient.changePassword(currentPassword, newPassword);
    if (response.data?.user) setUser(response.data.user);
  };

  const resetPassword = async (token: string, newPassword: string) => {
    const response = await apiClient.resetPassword(token, newPassword);
    if (!response.data?.user) throw new Error(response.error || 'Couldn’t reset the password');
    setUser(response.data.user);
  };

  const deleteAccount = async (password: string) => {
    await apiClient.deleteAccount(password);
    await forgetPushDevice({ tellServer: false });
    endSession();
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
    changePassword,
    resetPassword,
    deleteAccount,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
