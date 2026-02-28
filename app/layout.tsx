import type { Metadata, Viewport } from "next";
import { NavigationProvider } from "@/context/navigation-context";
import { PerformanceProvider } from "@/components/providers/performance-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { NetworkStatusProvider } from "@/contexts/network-status-context";
import { RequestQueueProvider } from "@/components/providers/request-queue-provider";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { TestModeInitializer } from "@/components/dev/test-mode-initializer";
import { DEFAULT_THEME_ID, THEME_RUNTIME_CONFIG } from "@/lib/themes/theme-config";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unified Ledger | Personal Finance Management",
  description: "A comprehensive personal finance app for tracking transactions, bills, budgets, savings goals, and debt management",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
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
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

function buildThemeBootstrapScript() {
  const runtimeConfig = JSON.stringify(THEME_RUNTIME_CONFIG);
  const defaultThemeId = JSON.stringify(DEFAULT_THEME_ID);

  return `
    (() => {
      try {
        const runtime = ${runtimeConfig};
        const fallbackId = ${defaultThemeId};
        const selectedHouseholdId = localStorage.getItem('unified-ledger:selected-household');
        const householdThemeKey = selectedHouseholdId
          ? 'unified-ledger:theme:' + selectedHouseholdId
          : 'unified-ledger:theme';
        const cachedTheme =
          localStorage.getItem(householdThemeKey) || localStorage.getItem('unified-ledger:theme');
        const normalizedCachedTheme = cachedTheme === 'dark-mode' ? 'dark-green' : cachedTheme;
        if (normalizedCachedTheme && normalizedCachedTheme !== cachedTheme) {
          localStorage.setItem(householdThemeKey, normalizedCachedTheme);
        }
        const themeId = normalizedCachedTheme && runtime[normalizedCachedTheme]
          ? normalizedCachedTheme
          : fallbackId;
        const theme = runtime[themeId] || runtime[fallbackId];
        if (!theme) return;

        const root = document.documentElement;
        root.setAttribute('data-theme', themeId);
        const vars = theme.cssVars || {};
        for (const key in vars) {
          root.style.setProperty(key, vars[key]);
        }
        const scheme = theme.mode === 'light' ? 'light' : 'dark';
        root.classList.toggle('dark', scheme === 'dark');
        root.style.setProperty('color-scheme', scheme);
        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) {
          themeMeta.setAttribute('content', scheme === 'light' ? '#ffffff' : '#0a0a0a');
        }
      } catch {}
    })();
  `;
}

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
          className="overflow-x-hidden"
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
            <script dangerouslySetInnerHTML={{ __html: buildThemeBootstrapScript() }} />
          </head>
          <body
            className="antialiased overflow-x-hidden w-full"
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
                    <Toaster 
                      position="bottom-right"
                      richColors
                      closeButton
                      toastOptions={{
                        className: "font-sans",
                      }}
                    />
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
