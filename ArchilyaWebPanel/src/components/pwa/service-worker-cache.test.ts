import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(__dirname, "../../..");
const publicDir = path.join(projectRoot, "public");
const serviceWorkerPath = path.join(publicDir, "sw.js");
const manifestPath = path.join(publicDir, "manifest.json");

function readStaticAssets() {
  const swSource = fs.readFileSync(serviceWorkerPath, "utf8");
  const match = swSource.match(/const PRECACHE_ASSETS = \[([\s\S]*?)\];/);

  if (!match) {
    throw new Error("PRECACHE_ASSETS list could not be parsed from public/sw.js");
  }

  return Array.from(match[1].matchAll(/"([^"]+)"/g)).map((item) => item[1]);
}

describe("service worker static cache assets", () => {
  it("references manifest icons that actually exist in public/", () => {
    const assets = readStaticAssets();
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      icons?: Array<{ src?: string }>;
    };

    const manifestIcons = (manifest.icons ?? []).map((icon) => icon.src).filter(Boolean) as string[];

    expect(manifestIcons.length).toBeGreaterThan(0);
    expect(assets).toEqual(expect.arrayContaining(manifestIcons));

    for (const assetPath of assets.filter((item) => item.includes("."))) {
      const normalizedPath = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
      expect(fs.existsSync(path.join(publicDir, normalizedPath))).toBe(true);
    }
  });
});
