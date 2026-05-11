import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const MASTER =
  process.argv[2] ??
  join(homedir(), "Downloads", "splash master 3000 x 3000.png");

if (!existsSync(MASTER)) {
  console.error(`✗ master introuvable: ${MASTER}`);
  process.exit(1);
}

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

console.log(`→ master: ${MASTER}`);

for (const s of SIZES) {
  const file = `public/splash/splash-${s.name}-${s.w}x${s.h}.png`;
  await sharp(MASTER)
    .resize(s.w, s.h, {
      fit: "cover",
      position: "center",
    })
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`✓ ${file}`);
}

console.log("\n✓ 12 splashs générés depuis le master.");
