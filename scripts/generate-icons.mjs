#!/usr/bin/env node
import { readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "frontend", "icons");
const svgPath = join(iconsDir, "icon.svg");

mkdirSync(iconsDir, { recursive: true });

if (!readFileSync(svgPath, "utf8")) {
  throw new Error("icon.svg missing");
}

function pngsPresent() {
  return [192, 512].every((size) => existsSync(join(iconsDir, `icon-${size}.png`)));
}

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    if (pngsPresent()) {
      console.log("Using committed PNG icons (sharp not available)");
      return;
    }
    console.warn("Optional: npm install sharp — or commit frontend/icons/icon-192.png and icon-512.png");
    return;
  }

  const svg = readFileSync(svgPath);
  for (const size of [192, 512]) {
    await sharp(svg).resize(size, size).png().toFile(join(iconsDir, `icon-${size}.png`));
    console.log(`Wrote icon-${size}.png`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
