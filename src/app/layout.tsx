
import type { Metadata } from "next";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { RoleProvider } from "@/context/RoleContext";
import { I18nProvider } from "@/context/I18nProvider"; 
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Inter as FontSans } from "next/font/google"

export const metadata: Metadata = {
  title: "FormaAfrique | Formations en ligne pour le marché Africain",
  description: "Apprenez des compétences d'avenir avec des cours conçus par des experts locaux. Payez facilement par Orange Money et MTN MoMo.",
  keywords: ['formation en ligne', 'e-learning afrique', 'compétences numériques', 'cours en français', 'udemy afrique'],
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
    <html lang="fr" suppressHydrationWarning>
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
