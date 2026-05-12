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
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-1024.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
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

/**
 * iOS apple-touch-startup-image table (portrait orientation, 2x/3x).
 * Each entry → device-width × device-height in CSS px × device-pixel-ratio.
 * Generated PNGs live in public/splash/ (see scripts/gen-splash.mjs).
 */
const SPLASH_LINKS: { href: string; media: string }[] = [
  // iPhone 14 Pro Max / 15 Pro Max (430×932 @3x)
  { href: "/splash/splash-iphone-14-pro-max-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  // iPhone 14 Pro / 15 Pro (393×852 @3x)
  { href: "/splash/splash-iphone-14-pro-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  // iPhone 14 Plus / 13 Pro Max / 12 Pro Max (428×926 @3x)
  { href: "/splash/splash-iphone-13-pro-max-1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  // iPhone 14 / 13 Pro / 13 / 12 Pro / 12 (390×844 @3x)
  { href: "/splash/splash-iphone-13-pro-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  // iPhone 13 mini / 12 mini (375×812 @3x — same as 11 Pro spatial but different ratio)
  { href: "/splash/splash-iphone-13-mini-1080x2340.png", media: "(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  // iPhone 11 Pro Max / XS Max (414×896 @3x)
  { href: "/splash/splash-iphone-11-pro-max-1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  // iPhone 11 / XR (414×896 @2x)
  { href: "/splash/splash-iphone-11-828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  // iPhone 11 Pro / XS / X (375×812 @3x)
  { href: "/splash/splash-iphone-11-pro-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  // iPhone 8 Plus / 7 Plus / 6S Plus (414×736 @3x)
  { href: "/splash/splash-iphone-8-plus-1242x2208.png", media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  // iPhone SE 2/3 / 8 / 7 / 6S (375×667 @2x)
  { href: "/splash/splash-iphone-se-750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  // iPhone SE 1st gen / 5 / 5S (320×568 @2x)
  { href: "/splash/splash-iphone-se-1-640x1136.png", media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  // iPad mini fallback (744×1133 @2x — covers small iPads)
  { href: "/splash/splash-ipad-mini-1488x2266.png", media: "(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={jakarta.variable}>
      <head>
        {SPLASH_LINKS.map((s) => (
          <link
            key={s.href}
            rel="apple-touch-startup-image"
            href={s.href}
            media={s.media}
          />
        ))}
      </head>
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
