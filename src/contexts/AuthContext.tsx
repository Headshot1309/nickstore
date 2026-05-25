import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { account } from '@/lib/mongodb';

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
      console.log('🔍 Checking session...');
      const currentUser = await account.get();
      console.log('✅ User is authenticated:', currentUser.email);
      setUser(currentUser as AdminUser);
    } catch {
      console.log('❌ No session found');
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
      console.log('🔐 Attempting login for:', email);
      const sessionResult = await account.createEmailPasswordSession(email, password);
      if ('requires2fa' in sessionResult) {
        return sessionResult;
      }
      const currentUser = await account.get();
      console.log('✅ Login successful! User:', currentUser.email);
      setUser(currentUser as AdminUser);
    } catch (error: unknown) {
      console.error('❌ Login failed:', error);
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
      console.error('Verification failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await account.deleteSession('current');
      setUser(null);
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

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
