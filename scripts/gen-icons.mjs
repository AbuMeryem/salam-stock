import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0E3B2E"/>
      <stop offset="100%" stop-color="#082A20"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#DDB31C"/>
      <stop offset="100%" stop-color="#C9A227"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="156" fill="url(#gold)" opacity="0.18"/>
  <g transform="translate(256 256)">
    <text x="0" y="0"
      font-family="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
      font-size="240"
      font-weight="800"
      fill="url(#gold)"
      text-anchor="middle"
      dominant-baseline="central">S</text>
  </g>
  <rect x="200" y="372" width="112" height="14" rx="7" fill="#DDB31C" opacity="0.85"/>
</svg>`;

async function build(size, file) {
  mkdirSync(dirname(file), { recursive: true });
  const buf = Buffer.from(svg(size));
  await sharp(buf).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}

await build(192, "public/icons/icon-192.png");
await build(512, "public/icons/icon-512.png");
await build(180, "public/icons/apple-touch-icon.png");

writeFileSync("public/icons/icon.svg", svg(512));
console.log("done");
