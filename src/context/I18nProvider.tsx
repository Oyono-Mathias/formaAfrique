
'use client';

import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { ReactNode, Suspense } from 'react';

export function I18nProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div>Loading translations...</div>}>
        <I18nextProvider i18n={i18n}>
            {children}
        </I18nextProvider>
    </Suspense>
  );
}
