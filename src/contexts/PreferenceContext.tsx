import React, { createContext, useContext, useMemo, useState } from 'react';

export const supportedCurrencies = [
  'MYR', 'USD', 'EUR', 'GBP', 'SGD', 'IDR', 'THB', 'PHP', 'VND', 'CNY', 'JPY', 'KRW',
  'AUD', 'NZD', 'CAD', 'CHF', 'SEK', 'NOK', 'DKK', 'AED', 'SAR', 'QAR', 'KWD', 'BHD',
  'OMR', 'INR', 'PKR', 'BDT', 'LKR', 'NPR', 'HKD', 'TWD', 'BRL', 'MXN', 'ARS', 'CLP',
  'COP', 'PEN', 'ZAR', 'EGP', 'NGN', 'KES', 'TRY', 'PLN', 'CZK', 'HUF', 'RON',
] as const;

export const supportedLanguages = [
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'th', label: 'Thai' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'tl', label: 'Filipino' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'tr', label: 'Turkish' },
] as const;

const ratesFromMyr: Record<string, number> = {
  MYR: 1,
  USD: 0.21,
  EUR: 0.19,
  GBP: 0.17,
  SGD: 0.28,
  IDR: 3400,
  THB: 7.7,
  PHP: 12.2,
  VND: 5400,
  CNY: 1.52,
  JPY: 33,
  KRW: 295,
  AUD: 0.32,
  NZD: 0.35,
  CAD: 0.29,
  CHF: 0.18,
  SEK: 2.1,
  NOK: 2.2,
  DKK: 1.42,
  AED: 0.78,
  SAR: 0.8,
  QAR: 0.77,
  KWD: 0.065,
  BHD: 0.08,
  OMR: 0.081,
  INR: 18,
  PKR: 60,
  BDT: 25,
  LKR: 65,
  NPR: 29,
  HKD: 1.68,
  TWD: 6.8,
  BRL: 1.15,
  MXN: 3.9,
  ARS: 230,
  CLP: 200,
  COP: 850,
  PEN: 0.78,
  ZAR: 3.8,
  EGP: 10.4,
  NGN: 330,
  KES: 27,
  TRY: 7.2,
  PLN: 0.82,
  CZK: 4.7,
  HUF: 75,
  RON: 0.95,
};

type PreferenceContextType = {
  currency: string;
  language: string;
  setCurrency: (currency: string) => void;
  setLanguage: (language: string) => void;
  formatMoney: (amountMyr: number | string) => string;
};

const PreferenceContext = createContext<PreferenceContextType | undefined>(undefined);

export const PreferenceProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [currency, setCurrencyState] = useState(() => localStorage.getItem('nickstore_currency') || 'MYR');
  const [language, setLanguageState] = useState(() => localStorage.getItem('nickstore_language') || 'en');

  const value = useMemo<PreferenceContextType>(() => {
    const setCurrency = (nextCurrency: string) => {
      if (!supportedCurrencies.includes(nextCurrency as any)) return;
      localStorage.setItem('nickstore_currency', nextCurrency);
      setCurrencyState(nextCurrency);
    };

    const setLanguage = (nextLanguage: string) => {
      if (!supportedLanguages.some((item) => item.code === nextLanguage)) return;
      localStorage.setItem('nickstore_language', nextLanguage);
      setLanguageState(nextLanguage);
      document.documentElement.lang = nextLanguage;
    };

    const formatMoney = (amountMyr: number | string) => {
      const amount = Number(amountMyr || 0) * (ratesFromMyr[currency] || 1);
      return new Intl.NumberFormat(language, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: currency === 'IDR' || currency === 'VND' || currency === 'JPY' || currency === 'KRW' ? 0 : 2,
      }).format(amount);
    };

    return { currency, language, setCurrency, setLanguage, formatMoney };
  }, [currency, language]);

  return <PreferenceContext.Provider value={value}>{children}</PreferenceContext.Provider>;
};

export const usePreference = () => {
  const context = useContext(PreferenceContext);
  if (!context) throw new Error('usePreference must be used within PreferenceProvider');
  return context;
};
