import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NavigationProvider } from "@/context/navigation-context";
import { PerformanceProvider } from "@/components/providers/performance-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { NetworkStatusProvider } from "@/contexts/network-status-context";
import { RequestQueueProvider } from "@/components/providers/request-queue-provider";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { TestModeInitializer } from "@/components/dev/test-mode-initializer";
import { DEFAULT_THEME_ID } from "@/lib/themes/theme-config";
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
    <NavigationProvider>
      <PerformanceProvider>
        <html
          lang="en"
          className="dark overflow-x-hidden"
          suppressHydrationWarning
          style={{ maxWidth: '100vw', width: '100%' }}
          data-theme={DEFAULT_THEME_ID}
        >
          <head>
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            <meta name="apple-mobile-web-app-title" content="Unified Ledger" />
            <meta name="theme-color" content="#0a0a0a" />
          </head>
          <body
            className={`${inter.variable} ${jetbrainsMono.variable} antialiased text-white overflow-x-hidden w-full`}
            style={{ maxWidth: '100vw', position: 'relative' }}
          >
            <ThemeProvider>
              <NetworkStatusProvider>
                <RequestQueueProvider>
                  <TestModeInitializer>
                    <OfflineBanner />
                    <div className="w-full max-w-full overflow-x-hidden">
                      {children}
                    </div>
                  </TestModeInitializer>
                </RequestQueueProvider>
              </NetworkStatusProvider>
            </ThemeProvider>
          </body>
        </html>
      </PerformanceProvider>
    </NavigationProvider>
  );
}
