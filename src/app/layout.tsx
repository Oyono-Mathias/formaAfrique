
import type { Metadata } from "next";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { RoleProvider } from "@/context/RoleContext";
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
};

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" {...props}>
    <path
      d="M16 2a14 14 0 1 0 0 28 14 14 0 0 0 0-28zm7.4 20.3a.5.5 0 0 1-.7.4l-4.5-2.2a1 1 0 0 0-1.1.2l-1.6 1.6a11.1 11.1 0 0 1-5.7-5.7l1.6-1.6a1 1 0 0 0 .2-1.1l-2.2-4.5a.5.5 0 0 1 .4-.7h-3.3a.5.5 0 0 0-.5.5c0 1.4.3 2.8 1 4.1.7 1.4 1.7 2.7 2.9 3.9s2.5 2.2 3.9 2.9c1.3.7 2.7 1 4.1 1a.5.5 0 0 0 .5-.5v-3.3z"
      fill="currentColor"
    />
  </svg>
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const WHATSAPP_NUMBER = "237653706443"; // REMPLACEZ PAR VOTRE NUMÉRO
  const whatsappMessage = encodeURIComponent("Bonjour FormaAfrique, j'aimerais avoir plus d'informations sur un cours.");

  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
       <body className={cn("min-h-screen bg-background font-sans antialiased", fontSans.variable)}>
        <FirebaseClientProvider>
          <RoleProvider>
            <AppShell>{children}</AppShell>
            <Toaster />
          </RoleProvider>
        </FirebaseClientProvider>

        <Link
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "fixed bottom-6 right-6 z-50",
            "h-16 w-16 bg-white rounded-full shadow-lg",
            "flex items-center justify-center",
            "transition-transform hover:scale-110"
          )}
          aria-label="Contacter sur WhatsApp"
        >
          <WhatsAppIcon className="h-8 w-8 text-green-500" />
        </Link>
      </body>
    </html>
  );
}
