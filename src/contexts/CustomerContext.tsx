import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { customerAccount } from '@/lib/mongodb';
import type { Customer } from '@/types';

interface CustomerContextType {
  customer: Customer | null;
  isCustomerAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ requires2fa?: boolean; challengeId?: string; message?: string } | void>;
  verifyLoginCode: (challengeId: string, code: string) => Promise<void>;
  register: (data: { name: string; email: string; phone?: string; password: string }) => Promise<void>;
  requestPasswordReset: (email: string, password: string) => Promise<{ challengeId?: string; message?: string }>;
  resetPassword: (challengeId: string, code: string) => Promise<string | undefined>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const currentCustomer = await customerAccount.get();
      setCustomer(currentCustomer as Customer);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const currentCustomer = await customerAccount.login(email, password);
      if ('requires2fa' in currentCustomer) {
        return currentCustomer;
      }
      setCustomer(currentCustomer as Customer);
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginCode = async (challengeId: string, code: string) => {
    setLoading(true);
    try {
      const currentCustomer = await customerAccount.verifyLoginCode(challengeId, code);
      setCustomer(currentCustomer as Customer);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: { name: string; email: string; phone?: string; password: string }) => {
    setLoading(true);
    try {
      const currentCustomer = await customerAccount.register(data);
      setCustomer(currentCustomer as Customer);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await customerAccount.logout();
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async (email: string, password: string) => {
    const response = await customerAccount.requestPasswordReset(email, password);
    return { challengeId: response.challenge_id, message: response.message };
  };

  const resetPassword = async (challengeId: string, code: string) => {
    const response = await customerAccount.resetPassword(challengeId, code);
    return response.message;
  };

  return (
    <CustomerContext.Provider
      value={{
        customer,
        isCustomerAuthenticated: Boolean(customer),
        loading,
        login,
        verifyLoginCode,
        register,
        requestPasswordReset,
        resetPassword,
        logout,
        refresh,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = () => {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
};
