import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Apple-touch-startup-image required portrait sizes for iPhones (2018+)
const SIZES = [
  { w: 1290, h: 2796, name: "iphone-14-pro-max" },
  { w: 1179, h: 2556, name: "iphone-14-pro" },
  { w: 1284, h: 2778, name: "iphone-13-pro-max" },
  { w: 1170, h: 2532, name: "iphone-13-pro" },
  { w: 1080, h: 2340, name: "iphone-13-mini" },
  { w: 1242, h: 2688, name: "iphone-11-pro-max" },
  { w: 828,  h: 1792, name: "iphone-11" },
  { w: 1125, h: 2436, name: "iphone-11-pro" },
  { w: 1242, h: 2208, name: "iphone-8-plus" },
  { w: 750,  h: 1334, name: "iphone-se" },
  { w: 640,  h: 1136, name: "iphone-se-1" }, // SE 1st gen
  { w: 1488, h: 2266, name: "ipad-mini" },   // small iPad fallback
];

mkdirSync("public/splash", { recursive: true });

function svg(w, h) {
  // Center logo + text. Scale font based on width.
  const cx = w / 2;
  const cy = h / 2;
  const logoSize = Math.round(w * 0.18);
  const titleSize = Math.round(w * 0.085);
  const subSize = Math.round(w * 0.034);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0A2A20"/>
      <stop offset="100%" stop-color="#0E3B2E"/>
    </linearGradient>
    <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0E3B2E"/>
      <stop offset="100%" stop-color="#14523F"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g transform="translate(${cx - logoSize / 2} ${cy - logoSize - titleSize * 1.4})">
    <rect width="${logoSize}" height="${logoSize}" rx="${logoSize * 0.22}" fill="url(#logo-bg)" stroke="#C9A227" stroke-width="${Math.max(2, logoSize * 0.014)}" stroke-opacity="0.4"/>
    <text x="${logoSize / 2}" y="${logoSize / 2}"
      font-family="Inter, system-ui, sans-serif"
      font-size="${logoSize * 0.55}"
      font-weight="800"
      fill="#C9A227"
      text-anchor="middle"
      dominant-baseline="central"
      letter-spacing="-0.03em">S</text>
  </g>
  <text x="${cx}" y="${cy + titleSize * 0.2}"
    font-family="Inter, system-ui, sans-serif"
    font-size="${titleSize}"
    font-weight="800"
    fill="#FFFFFF"
    text-anchor="middle"
    letter-spacing="-0.02em">Salam Market</text>
  <text x="${cx}" y="${cy + titleSize * 1.35}"
    font-family="Inter, system-ui, sans-serif"
    font-size="${titleSize}"
    font-weight="800"
    fill="#C9A227"
    text-anchor="middle"
    letter-spacing="-0.02em">Stock</text>
  <text x="${cx}" y="${cy + titleSize * 1.35 + subSize * 2}"
    font-family="Inter, system-ui, sans-serif"
    font-size="${subSize}"
    font-weight="500"
    fill="rgba(255,255,255,0.6)"
    text-anchor="middle">Gestion multi-dépôts</text>
</svg>`;
}

for (const s of SIZES) {
  const buf = Buffer.from(svg(s.w, s.h));
  const file = `public/splash/splash-${s.name}-${s.w}x${s.h}.png`;
  await sharp(buf).png().toFile(file);
  console.log("wrote", file);
}
console.log("done");
