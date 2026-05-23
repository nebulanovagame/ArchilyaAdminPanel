const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3456';
const OUT_DIR = path.resolve(__dirname, 'screenshots');

const devices = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet-7', width: 1200, height: 1900 },
  { name: 'tablet-10', width: 1600, height: 2560 },
];

const routes = [
  { route: '/login', filename: 'login' },
  { route: '/', filename: 'dashboard' },
  { route: '/projects', filename: 'projects' },
  { route: '/inbox', filename: 'inbox' },
  { route: '/ai', filename: 'ai-studio' },
  { route: '/workspace', filename: 'workspace' },
  { route: '/settings', filename: 'settings' },
  { route: '/credits', filename: 'credits' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  for (const device of devices) {
    const deviceDir = path.join(OUT_DIR, device.name);
    if (!fs.existsSync(deviceDir)) fs.mkdirSync(deviceDir, { recursive: true });

    for (const { route, filename } of routes) {
      const page = await context.newPage();
      await page.setViewportSize({ width: device.width, height: device.height });
      try {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1000); // allow animations
        const outPath = path.join(deviceDir, `${filename}.png`);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log('OK', device.name, filename, outPath);
      } catch (e) {
        console.error('FAIL', device.name, filename, e.message);
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();
})();
