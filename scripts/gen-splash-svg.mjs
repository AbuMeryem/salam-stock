import sharp from "sharp";
import { mkdirSync } from "node:fs";

/**
 * Splash SVG generator — recrée le master "Salamarket / Stock et Gestion"
 * en vectoriel, puis le rend pour chaque dimension d'appareil iOS.
 *
 * Pourquoi pas la version PNG center-croppée du master 3000×3000 :
 *   crop center → on perd les arabesques latérales sur les écrans portrait
 *   très étroits (iPhone SE, mini), et le logo se décentre visuellement.
 *   Vector → adapte les ondulations + le motif islamique à chaque ratio.
 */

const SIZES = [
  { w: 1290, h: 2796, name: "iphone-14-pro-max" },
  { w: 1179, h: 2556, name: "iphone-14-pro" },
  { w: 1284, h: 2778, name: "iphone-13-pro-max" },
  { w: 1170, h: 2532, name: "iphone-13-pro" },
  { w: 1080, h: 2340, name: "iphone-13-mini" },
  { w: 1242, h: 2688, name: "iphone-11-pro-max" },
  { w: 828, h: 1792, name: "iphone-11" },
  { w: 1125, h: 2436, name: "iphone-11-pro" },
  { w: 1242, h: 2208, name: "iphone-8-plus" },
  { w: 750, h: 1334, name: "iphone-se" },
  { w: 640, h: 1136, name: "iphone-se-1" },
  { w: 1488, h: 2266, name: "ipad-mini" },
];

mkdirSync("public/splash", { recursive: true });

/* ────────────────────────────────────────────────────────────────
   Génère le SVG complet adapté aux dimensions w × h
   ──────────────────────────────────────────────────────────────── */
function svg(w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const minDim = Math.min(w, h);

  // Échelle relative à la largeur (logo proportionnel)
  const titleSize = Math.round(w * 0.082);
  const subSize = Math.round(w * 0.026);
  const archSize = Math.round(w * 0.075);
  const archStroke = Math.max(2.5, w * 0.0035);
  const goldArcStroke = Math.max(1.5, w * 0.0018);

  // Tile size pour le motif islamique (proportionnel)
  const tile = Math.round(minDim * 0.065);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <!-- Fond : radial sapin profond, plus clair au centre -->
    <radialGradient id="bgRad" cx="50%" cy="48%" r="75%">
      <stop offset="0%"  stop-color="#1A5240"/>
      <stop offset="55%" stop-color="#0E3B2E"/>
      <stop offset="100%" stop-color="#06231B"/>
    </radialGradient>

    <!-- Bandes d'ondulation vert plus clair (translucides) -->
    <linearGradient id="waveA" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="#2D8163" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#0E3B2E" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="waveB" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#1F6650" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#0E3B2E" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="waveC" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%"  stop-color="#247256" stop-opacity="0.40"/>
      <stop offset="100%" stop-color="#0E3B2E" stop-opacity="0"/>
    </linearGradient>

    <!-- Arabesque dorée fine -->
    <linearGradient id="goldLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#C9A227" stop-opacity="0"/>
      <stop offset="40%"  stop-color="#E8C557" stop-opacity="0.85"/>
      <stop offset="60%"  stop-color="#E8C557" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#C9A227" stop-opacity="0"/>
    </linearGradient>

    <!-- Motif géométrique islamique : étoile à 8 branches répétée -->
    <pattern id="islamic" x="0" y="0" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="#D4A52E" stroke-width="${Math.max(0.6, w * 0.0007)}" opacity="0.85">
        <!-- Étoile 8 pointes -->
        <path d="M ${tile / 2} ${tile * 0.08}
                 L ${tile * 0.62} ${tile * 0.38}
                 L ${tile * 0.92} ${tile / 2}
                 L ${tile * 0.62} ${tile * 0.62}
                 L ${tile / 2} ${tile * 0.92}
                 L ${tile * 0.38} ${tile * 0.62}
                 L ${tile * 0.08} ${tile / 2}
                 L ${tile * 0.38} ${tile * 0.38}
                 Z"/>
        <!-- Carré pivoté pour effet entrelacé -->
        <rect x="${tile * 0.22}" y="${tile * 0.22}" width="${tile * 0.56}" height="${tile * 0.56}"
              transform="rotate(45 ${tile / 2} ${tile / 2})"/>
        <circle cx="${tile / 2}" cy="${tile / 2}" r="${tile * 0.08}"/>
      </g>
    </pattern>

    <!-- Masque doux pour limiter le motif au quart bas-droit -->
    <radialGradient id="patternMask" cx="100%" cy="100%" r="80%">
      <stop offset="0%"  stop-color="white" stop-opacity="0.6"/>
      <stop offset="60%" stop-color="white" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
    <mask id="patternFade">
      <rect width="${w}" height="${h}" fill="url(#patternMask)"/>
    </mask>
  </defs>

  <!-- 1. Fond radial sapin -->
  <rect width="${w}" height="${h}" fill="url(#bgRad)"/>

  <!-- 2. Motif islamique bas-droit (masqué pour fade) -->
  <rect width="${w}" height="${h}" fill="url(#islamic)" mask="url(#patternFade)" opacity="0.55"/>

  <!-- 3. Bandes d'ondulation vert clair (3 superpositions) -->
  <path d="M 0 ${h * 0.18}
           Q ${w * 0.35} ${h * 0.05}, ${w * 0.7} ${h * 0.22}
           T ${w} ${h * 0.32}
           L ${w} 0 L 0 0 Z"
        fill="url(#waveA)"/>
  <path d="M 0 ${h * 0.85}
           Q ${w * 0.3} ${h * 0.65}, ${w * 0.55} ${h * 0.88}
           T ${w} ${h * 0.78}
           L ${w} ${h} L 0 ${h} Z"
        fill="url(#waveB)"/>
  <path d="M ${-w * 0.1} ${h * 0.42}
           Q ${w * 0.25} ${h * 0.32}, ${w * 0.5} ${h * 0.5}
           T ${w * 1.1} ${h * 0.62}"
        fill="none" stroke="url(#waveC)" stroke-width="${w * 0.18}" stroke-linecap="round"
        opacity="0.55"/>

  <!-- 4. Arabesques dorées fines (3 arcs) -->
  <path d="M 0 ${h * 0.12}
           Q ${w * 0.4} ${h * 0.02}, ${w * 0.75} ${h * 0.18}
           T ${w} ${h * 0.28}"
        fill="none" stroke="url(#goldLine)" stroke-width="${goldArcStroke}" opacity="0.7"/>
  <path d="M 0 ${h * 0.78}
           Q ${w * 0.35} ${h * 0.6}, ${w * 0.65} ${h * 0.82}
           T ${w} ${h * 0.72}"
        fill="none" stroke="url(#goldLine)" stroke-width="${goldArcStroke}" opacity="0.55"/>

  <!-- 5. Logo centré -->
  <g transform="translate(${cx} ${cy})">
    <!-- Arche stylisée (mosquée) au-dessus du texte -->
    <g transform="translate(0 ${-titleSize * 0.95})">
      <!-- Base de l'arche -->
      <path d="M ${-archSize / 2} 0
               L ${-archSize / 2} ${-archSize * 0.2}
               Q ${-archSize / 2} ${-archSize * 0.7}, 0 ${-archSize * 0.85}
               Q ${archSize / 2} ${-archSize * 0.7}, ${archSize / 2} ${-archSize * 0.2}
               L ${archSize / 2} 0"
            fill="none" stroke="#D4A52E" stroke-width="${archStroke}" stroke-linejoin="round"/>
      <!-- Petite pointe de dôme -->
      <line x1="0" y1="${-archSize * 0.85}" x2="0" y2="${-archSize * 1.1}"
            stroke="#D4A52E" stroke-width="${archStroke}" stroke-linecap="round"/>
      <!-- Arc intérieur -->
      <path d="M ${-archSize * 0.32} 0
               Q ${-archSize * 0.32} ${-archSize * 0.45}, 0 ${-archSize * 0.55}
               Q ${archSize * 0.32} ${-archSize * 0.45}, ${archSize * 0.32} 0"
            fill="none" stroke="#D4A52E" stroke-width="${archStroke * 0.7}" opacity="0.85"/>
    </g>

    <!-- "SALAMARKET" gold -->
    <text x="0" y="${titleSize * 0.35}"
          font-family="'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif"
          font-size="${titleSize}"
          font-weight="800"
          fill="#D4A52E"
          text-anchor="middle"
          letter-spacing="${titleSize * 0.04}"
          style="text-transform: uppercase;">SALAMARKET</text>

    <!-- Sous-titre "— STOCK ET GESTION —" -->
    <g transform="translate(0 ${titleSize * 1.15})">
      <line x1="${-subSize * 5}" y1="0" x2="${-subSize * 1.8}" y2="0"
            stroke="#C9A227" stroke-width="${subSize * 0.06}" opacity="0.85"/>
      <line x1="${subSize * 1.8}" y1="0" x2="${subSize * 5}" y2="0"
            stroke="#C9A227" stroke-width="${subSize * 0.06}" opacity="0.85"/>
      <text x="0" y="${subSize * 0.35}"
            font-family="'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif"
            font-size="${subSize}"
            font-weight="600"
            fill="#C9A227"
            text-anchor="middle"
            letter-spacing="${subSize * 0.18}"
            style="text-transform: uppercase;">STOCK ET GESTION</text>
    </g>
  </g>
</svg>`;
}

console.log("→ Génération vectorielle (SVG → PNG)\n");

for (const s of SIZES) {
  const file = `public/splash/splash-${s.name}-${s.w}x${s.h}.png`;
  const buf = Buffer.from(svg(s.w, s.h));
  await sharp(buf)
    .png({ compressionLevel: 9, palette: false })
    .toFile(file);
  console.log(`✓ ${file}  (${s.w}×${s.h})`);
}

console.log("\n✓ 12 splashs SVG-rendered.");
