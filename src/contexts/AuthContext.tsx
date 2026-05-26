import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { account, touchAdminSession } from '@/lib/mongodb';

const ADMIN_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

interface AdminUser {
  $id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ requires2fa?: boolean; challengeId?: string; message?: string } | void>;
  verifyLoginCode: (challengeId: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkUser = useCallback(async () => {
    try {
      const currentUser = await account.get();
      setUser(currentUser as AdminUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const sessionResult = await account.createEmailPasswordSession(email, password);
      if ('requires2fa' in sessionResult) {
        return sessionResult;
      }
      const currentUser = await account.get();
      setUser(currentUser as AdminUser);
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginCode = async (challengeId: string, code: string) => {
    setLoading(true);
    try {
      await account.verifyEmailCode(challengeId, code);
      const currentUser = await account.get();
      setUser(currentUser as AdminUser);
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await account.deleteSession('current');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleIdleLogout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void logout();
      }, ADMIN_IDLE_TIMEOUT_MS);
    };
    const handleActivity = () => {
      touchAdminSession();
      scheduleIdleLogout();
    };
    const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];

    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    scheduleIdleLogout();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [logout, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        verifyLoginCode,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
