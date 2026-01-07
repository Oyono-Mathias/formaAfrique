
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// Define the shape of your translations
interface Translations {
  welcomeMessage: string;
  loginButton: string;
  registerButton: string;
  dashboardTitle: string;
  exploreCourses: string;
  // Add more keys as needed
}

// Define the supported languages
export type Language = 'en' | 'fr' | 'sg';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: keyof Translations) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Translations> = {
  en: {
    welcomeMessage: "Welcome to FormaAfrique!",
    loginButton: "Login",
    registerButton: "Register",
    dashboardTitle: "Dashboard",
    exploreCourses: "Explore Courses",
  },
  fr: {
    welcomeMessage: "Bienvenue sur FormaAfrique !",
    loginButton: "Se connecter",
    registerButton: "S'inscrire",
    dashboardTitle: "Tableau de bord",
    exploreCourses: "Explorer les cours",
  },
  sg: {
    welcomeMessage: "Samba na FormaAfrique !",
    loginButton: "Gango",
    registerButton: "S'inscrire", // Keeping it simple for now
    dashboardTitle: "Tableau de bord",
    exploreCourses: "Explorer les cours",
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');

  useEffect(() => {
    const storedLang = localStorage.getItem('formaafrique-lang') as Language;
    if (storedLang && ['en', 'fr', 'sg'].includes(storedLang)) {
      setLanguageState(storedLang);
    } else {
        // Auto-detect based on browser language if no preference is stored
        const browserLang = navigator.language.split('-')[0];
        if(browserLang === 'sg') setLanguageState('sg');
        else if(browserLang === 'en') setLanguageState('en');
        else setLanguageState('fr'); // Default to French
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('formaafrique-lang', lang);
  };

  const t = useCallback((key: keyof Translations): string => {
    return translations[language][key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
