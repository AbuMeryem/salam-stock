import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Salam Stock — Gestion multi-dépôts",
    template: "%s · Salam Stock",
  },
  description:
    "Salam Market Toulouse — réception, sortie, transferts, inventaire et drive multi-dépôts. App PWA opérée sur le terrain.",
  manifest: "/manifest.json",
  applicationName: "Salam Stock",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Salam Stock",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Salam Stock",
    title: "Salam Stock — Gestion multi-dépôts",
    description:
      "Réception, sortie, transferts, inventaire, drive — multi-dépôts Toulouse.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "Salam Stock",
    description: "Gestion multi-dépôts Toulouse",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
    shortcut: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E3B2E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={jakarta.variable}>
      <body className="antialiased bg-cream text-text-primary">
        {children}
        <Toaster
          position="top-center"
          /* 80px clears the Dynamic Island (~59pt) on iPhone 14/15/16 Pro
             with a 21pt breathing margin. sonner doesn't reliably parse
             CSS calc() strings, so we hard-code a pixel-safe value. */
          offset={80}
          mobileOffset={80}
          duration={2400}
          gap={6}
          visibleToasts={2}
          toastOptions={{
            style: {
              borderRadius: "16px",
              border: "1px solid var(--border-light)",
              padding: "14px 16px",
              fontFamily: "var(--font-jakarta), system-ui, sans-serif",
              boxShadow: "0 8px 24px rgba(14,59,46,0.12)",
            },
          }}
        />
      </body>
    </html>
  );
}
