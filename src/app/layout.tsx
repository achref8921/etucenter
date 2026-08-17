import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Providers from "@/components/providers";
import PwaRegister from "@/components/pwa-register";
import PushSetup from "@/components/push-setup";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  style: ["normal"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Gestion Centre",
  description:
    "Système de gestion de centre - Suivi des présences et des absences des professeurs et élèves",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gestion Centre",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
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
          {children}
          <PwaRegister />
          <PushSetup />
        </Providers>
      </body>
    </html>
  );
}
