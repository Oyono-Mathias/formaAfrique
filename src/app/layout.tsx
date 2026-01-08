
import type { Metadata } from "next";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { RoleProvider } from "@/context/RoleContext";
import { I18nProvider } from "@/context/I18nProvider"; // Import I18nProvider
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Inter as FontSans } from "next/font/google"

export const metadata: Metadata = {
  title: "FormaAfrique | Formations Gratuites et Certifiantes au Cameroun",
  description: "La plateforme n°1 pour apprendre un métier. Accédez à nos formations gratuites et premium. Payez facilement par Orange Money, MTN et Wave.",
  keywords: ['formation gratuite', 'apprendre en ligne Afrique', 'e-commerce Cameroun', 'cours certifiants'],
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
       <body className={cn("min-h-screen bg-background font-sans antialiased", fontSans.variable)}>
        <FirebaseClientProvider>
          <RoleProvider>
            <I18nProvider>
              <AppShell>{children}</AppShell>
              <Toaster />
            </I18nProvider>
          </RoleProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
