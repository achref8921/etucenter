import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Providers from "@/components/providers";
import PwaRegister from "@/components/pwa-register";
import PushSetup from "@/components/push-setup";
import OfflineBanner from "@/components/offline-banner";
import ScrollRestoration from "@/components/scroll-restoration";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  style: ["normal"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Étudnet - Plateforme éducative",
  description:
    "Plateforme éducative de gestion de centre - élèves, professeurs, présences, séances, paiements et documents sécurisés",
  applicationName: "Étudnet",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Étudnet",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1D4ED8",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <Providers>
          <OfflineBanner />
          <ScrollRestoration />
          {children}
          <PwaRegister />
          <PushSetup />
        </Providers>
      </body>
    </html>
  );
}
