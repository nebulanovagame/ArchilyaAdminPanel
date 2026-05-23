import type { Metadata, Viewport } from "next";
import { Montserrat, Cormorant_Garamond } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { AuthProvider } from "@/components/providers/auth-provider";
import { CookieConsentBanner } from "@/components/legal/cookie-consent-banner";
import ServiceWorkerRegister from "@/components/pwa/service-worker-register";

import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["200", "300", "400", "500", "600"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Archilya | Panel",
  description: "Archilya AI destekli mimari yönetim paneli",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Archilya",
  },
  icons: {
    icon: [
      { url: "/icon-192x192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512x512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#c6a87c",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${montserrat.variable} ${cormorant.variable}`}
    >
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
        <CookieConsentBanner />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
