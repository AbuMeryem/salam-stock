"use client";

import { motion } from "framer-motion";

/**
 * Web splash screen displayed on the very first visit to "/".
 * - Fond dégradé vert sapin foncé (#0A2A20 → #0E3B2E vertical)
 * - Logo Xlab "S" sapin/or au centre
 * - "Salam Market" blanc + "Stock" or
 * - Sous-texte "Gestion multi-dépôts" blanc 60%
 * - Fade-in du logo (300ms), pulse subtil du texte (loop 2s)
 *
 * Pour la version PWA (mode standalone iPhone), iOS utilise les PNGs
 * apple-touch-startup-image — voir public/splash/ et app/layout.tsx.
 */
export function SplashScreen() {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{
        background:
          "linear-gradient(180deg, #0A2A20 0%, #0E3B2E 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
        className="flex flex-col items-center"
      >
        {/* Logo Xlab — carré sapin avec "S" doré */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
          style={{
            background:
              "linear-gradient(135deg, #0E3B2E 0%, #14523F 100%)",
            border: "1.5px solid rgba(201, 162, 39, 0.35)",
          }}
        >
          <span
            className="text-4xl font-extrabold"
            style={{ color: "#C9A227", letterSpacing: "-0.05em" }}
          >
            S
          </span>
        </div>

        <motion.div
          animate={{ opacity: [1, 0.85, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="text-center"
        >
          <p
            className="text-white"
            style={{
              fontFamily: "var(--font-jakarta), system-ui, sans-serif",
              fontSize: 32,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Salam Market
          </p>
          <p
            style={{
              color: "#C9A227",
              fontFamily: "var(--font-jakarta), system-ui, sans-serif",
              fontSize: 32,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Stock
          </p>
        </motion.div>

        <p
          className="mt-4"
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        >
          Gestion multi-dépôts
        </p>
      </motion.div>
    </div>
  );
}
