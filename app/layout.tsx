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
  title: "Salam Stock",
  description: "Gestion de réception et stock — Salam Market Toulouse",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Salam Stock",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
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
          offset="calc(env(safe-area-inset-top, 0px) + 16px)"
          toastOptions={{
            style: {
              borderRadius: "16px",
              border: "1px solid var(--border-light)",
              padding: "14px 16px",
              fontFamily: "var(--font-jakarta), system-ui, sans-serif",
            },
          }}
        />
      </body>
    </html>
  );
}
