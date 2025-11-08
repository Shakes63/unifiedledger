import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { NavigationProvider } from "@/context/navigation-context";
import { PerformanceProvider } from "@/components/providers/performance-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unified Ledger | Personal Finance Management",
  description: "A comprehensive personal finance app for tracking transactions, bills, budgets, savings goals, and debt management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Unified Ledger",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <NavigationProvider>
        <PerformanceProvider>
          <html lang="en" className="dark overflow-x-hidden" suppressHydrationWarning style={{ maxWidth: '100vw', width: '100%' }}>
            <head>
              <meta name="mobile-web-app-capable" content="yes" />
              <meta name="apple-mobile-web-app-capable" content="yes" />
              <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
              <meta name="apple-mobile-web-app-title" content="Unified Ledger" />
              <meta name="theme-color" content="#0a0a0a" />
            </head>
            <body
              className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-[#0a0a0a] text-white overflow-x-hidden w-full`}
              style={{ maxWidth: '100vw', position: 'relative' }}
            >
              <div className="w-full max-w-full overflow-x-hidden">
                {children}
              </div>
            </body>
          </html>
        </PerformanceProvider>
      </NavigationProvider>
    </ClerkProvider>
  );
}
